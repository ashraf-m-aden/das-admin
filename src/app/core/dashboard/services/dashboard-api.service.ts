import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { DashboardApiPort } from './dashboard-api.port';
import { AdresseApiPort } from '../../adresse/services/adresse-api.port';
import { FieldOpsApiPort } from '../../fieldops/services/fieldops-api.port';
import { ClosesApiPort } from '../../closes/services/closes-api.port';
import { BlocksApiPort } from '../../blocks/services/blocks-api.port';
import { PostcodesApiPort } from '../../postcodes/services/postcodes-api.port';
import { ReviewApiPort } from '../../review/services/review-api.port';
import { EMPTY_HIERARCHY_SELECTION } from '../../hierarchy/models/hierarchy.models';
import {
  AddressingCoverage, CoverageBlocker, DashboardSummary, VerificationDebt,
} from '../models/dashboard.models';

/** Aucune dette mesurable : sert de valeur de repli quand il n'y a pas de campagne en cours. */
const NO_DEBT: VerificationDebt = {
  temporaryAwaitingRecheck: 0, stalledSubmissions: 0, oldestStalledDays: null,
};

const NO_COVERAGE: AddressingCoverage = { totalAdresses: 0, adressesWithClose: 0, blockers: [] };

/**
 * Compose le dashboard à partir des ports MÉTIER existants — il n'y a pas, et il n'y aura pas,
 * de route `/dashboard/summary` côté back.
 *
 * Chaque source est protégée par son propre `catchError` : un dashboard est une page de synthèse,
 * un bloc indisponible doit se dégrader tout seul plutôt que faire échouer la page entière. Un
 * `403` sur les relevés (rôle sans `surveys.view`) est un cas NORMAL, pas une panne.
 *
 * Pas de bascule mock/réel ici : tous les ports composés basculent déjà individuellement.
 */
@Injectable({ providedIn: 'root' })
export class DashboardApiService extends DashboardApiPort {
  private adresseApi = inject(AdresseApiPort);
  private fieldOpsApi = inject(FieldOpsApiPort);
  private closesApi = inject(ClosesApiPort);
  private blocksApi = inject(BlocksApiPort);
  private postcodesApi = inject(PostcodesApiPort);
  private reviewApi = inject(ReviewApiPort);

  override getSummary(): Observable<DashboardSummary> {
    // `summary()` d'abord et SEUL : `coverage()` a besoin de son `totalRecords` comme assiette.
    // Le lancer en parallèle obligerait à l'appeler deux fois — deux requêtes pour une donnée.
    return this.adresseApi.summary().pipe(
      switchMap((adresses) => forkJoin({
        adresses: of(adresses),
        coverage: this.coverage(adresses.totalRecords).pipe(catchError(() => of(NO_COVERAGE))),
        stalled: this.reviewApi.listStalledSurveys().pipe(catchError(() => of([]))),
        inProgress: this.fieldOpsApi.listCampaigns('InProgress').pipe(catchError(() => of([]))),
      })),
    ).pipe(
      switchMap(({ adresses, coverage, stalled, inProgress }) => {
        // `oldestStalledDays` vient de la LISTE des relevés en souffrance, pas de la campagne :
        // `stalledSubmissions` en donne le nombre, jamais l'ancienneté — or c'est l'ancienneté
        // qui alerte. Deux jours de retard et deux mois ne se traitent pas pareil.
        const oldestStalledDays = stalled.length === 0
          ? null
          : Math.max(...stalled.map((s) => s.daysWaiting));

        const base = {
          totalRecords: adresses.totalRecords,
          pendingReview: adresses.pendingReview,
          duplicatesFlagged: adresses.duplicatesFlagged,
          workflowBreakdown: adresses.workflowBreakdown,
          coverage,
        };

        const campaign = inProgress[0] ?? null;
        if (!campaign) {
          return of<DashboardSummary>({
            ...base,
            verificationDebt: { ...NO_DEBT, oldestStalledDays },
            activeCampaign: null,
          });
        }

        return this.fieldOpsApi.getCampaignProgress(campaign.id).pipe(
          map((p): DashboardSummary => ({
            ...base,
            verificationDebt: {
              temporaryAwaitingRecheck: p.temporaryAwaitingRecheck,
              stalledSubmissions: p.stalledSubmissions,
              oldestStalledDays,
            },
            activeCampaign: {
              id: campaign.id,
              code: campaign.code,
              name: campaign.name,
              deadline: campaign.deadline,
              status: campaign.status,
              assignedBlocs: p.assignedBlocs,
              charge: { total: p.totalAssignments, done: p.done, toDo: p.toDo, abandoned: p.abandoned },
              production: {
                total: p.surveysDraft + p.surveysSubmitted + p.surveysValidated + p.surveysRejected,
                draft: p.surveysDraft,
                submitted: p.surveysSubmitted,
                validated: p.surveysValidated,
                rejected: p.surveysRejected,
              },
              canBeClosed: p.canBeClosed,
              byAgent: p.byAgent,
            },
          })),
          // Une campagne listée dont la progression échoue ne doit pas emporter la page : on
          // rend la campagne sans ses chiffres plutôt que rien du tout.
          catchError(() => of<DashboardSummary>({
            ...base,
            verificationDebt: { ...NO_DEBT, oldestStalledDays },
            activeCampaign: null,
          })),
        );
      }),
    );
  }

  /**
   * Couverture d'adressage : quatre appels de liste, tous sur des volumes minuscules (quelques
   * centaines de lignes au plus) et non paginés côté back.
   *
   * `adressesWithClose` se lit sur `Close.adresseCount`, que `GET /api/closes` renvoie déjà par
   * close : une seule requête, là où compter les adresses close par close serait un N+1. Il n'y
   * a pas de filtre « sans close » dans `AdresseFilters`, donc c'est bien par ce complément
   * qu'il faut passer.
   */
  private coverage(totalAdresses: number): Observable<AddressingCoverage> {
    return forkJoin({
      closes: this.closesApi.list({ quartierId: null }),
      blocs: this.blocksApi.list({ ...EMPTY_HIERARCHY_SELECTION }),
      streets: this.closesApi.listStreets(),
      quartiers: this.postcodesApi.listQuartiers(),
      cities: this.postcodesApi.listCities(),
    }).pipe(
      map(({ closes, blocs, streets, quartiers, cities }) => {
        const adressesWithClose = closes.reduce((n, c) => n + c.adresseCount, 0);

        const blockers: CoverageBlocker[] = [
          {
            key: 'adressesWithoutClose',
            remaining: Math.max(0, totalAdresses - adressesWithClose),
            total: totalAdresses,
            route: '/closes',
          },
          {
            key: 'blocsWithoutClose',
            remaining: blocs.filter((b) => b.closeId === null).length,
            total: blocs.length,
            route: '/closes',
          },
          {
            key: 'streetsUnnamed',
            remaining: streets.filter((s) => s.name === null).length,
            total: streets.length,
            route: '/closes',
          },
          {
            key: 'quartiersWithoutArea',
            remaining: quartiers.filter((q) => q.areaNumber === null).length,
            total: quartiers.length,
            route: '/postcodes',
          },
          {
            key: 'citiesWithoutCode',
            remaining: cities.filter((c) => c.code === null).length,
            total: cities.length,
            route: '/postcodes',
          },
        ];

        return { totalAdresses, adressesWithClose, blockers };
      }),
    );
  }
}
