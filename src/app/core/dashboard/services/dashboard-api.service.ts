import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, of, switchMap } from 'rxjs';
import { DashboardApiPort } from './dashboard-api.port';
import { AdresseApiPort } from '../../adresse/services/adresse-api.port';
import { FieldOpsApiPort } from '../../fieldops/services/fieldops-api.port';
import { DashboardSummary } from '../models/dashboard.models';

/**
 * Aucune route `/dashboard/summary` côté back, et il n'y en aura pas (voir
 * docs/plans/contrat-api-dashboard-notifications.md). Ce port n'est pas un client HTTP : il
 * compose `AdresseApiPort.summary()` (dont `workflowBreakdown`) et `FieldOpsApiPort` (campagne
 * en cours + sa progression) — deux ports déjà branchés mock/réel, donc pas de contrepartie
 * mock séparée ici, elle suivrait automatiquement celle des deux ports composés.
 */
@Injectable({ providedIn: 'root' })
export class DashboardApiService extends DashboardApiPort {
  private adresseApi = inject(AdresseApiPort);
  private fieldOpsApi = inject(FieldOpsApiPort);

  override getSummary(): Observable<DashboardSummary> {
    return forkJoin({
      adresses: this.adresseApi.summary(),
      inProgress: this.fieldOpsApi.listCampaigns('InProgress'),
    }).pipe(
      switchMap(({ adresses, inProgress }) => {
        const campaign = inProgress[0] ?? null;
        if (!campaign) return of<DashboardSummary>({ ...adresses, activeCampaign: null });

        return this.fieldOpsApi.getCampaignProgress(campaign.id).pipe(
          map((progress) => ({
            ...adresses,
            activeCampaign: {
              code: campaign.code,
              name: campaign.name,
              deadline: campaign.deadline,
              status: campaign.status,
              charge: { total: progress.totalAssignments, done: progress.done },
              production: {
                total: progress.surveysDraft + progress.surveysSubmitted + progress.surveysValidated + progress.surveysRejected,
                draft: progress.surveysDraft,
                submitted: progress.surveysSubmitted,
                validated: progress.surveysValidated,
                rejected: progress.surveysRejected,
              },
            },
          })),
        );
      }),
    );
  }
}
