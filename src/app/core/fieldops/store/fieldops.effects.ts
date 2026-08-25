import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { catchError, map, mergeMap, of, withLatestFrom } from 'rxjs';
import { FieldOpsActions } from './fieldops.actions';
import { fieldOpsFeature } from './fieldops.reducer';
import { FieldOpsApiPort } from '../services/fieldops-api.port';
import { ErrorKeyMap, toErrorKey } from '../../http/error-code';

/**
 * Codes métier de `/api/campaigns`, `/api/campaign-blocs` et `/api/campaign-assignments`,
 * relevés dans la source `dasApi` le 2026-08-25. Testés sur `code`, jamais sur `message`
 * (CLAUDE.md §6).
 *
 * C'est l'écran où le repli générique coûtait le plus cher : presque tous ces refus sont des
 * règles de séquencement (« démarrez d'abord », « clôturez d'abord », « affectez un bloc
 * d'abord ») que l'opérateur lève lui-même en une action — mais seulement s'il sait laquelle.
 *
 * `Campaigns.NotFound`, `CampaignBlocs.NotFound` et `Assignments.NotFound` partagent une clé :
 * dans les trois cas l'écran est désynchronisé et le geste utile est le même, recharger.
 */
const ERROR_KEY_BY_CODE: ErrorKeyMap = {
  // Cycle de vie de la campagne
  'Campaigns.PlannedAlreadyExists': 'fieldops.errorPlannedAlreadyExists',
  'Campaigns.CodeCollision': 'fieldops.errorCodeCollision',
  'Campaigns.NotPlanned': 'fieldops.errorNotPlanned',
  'Campaigns.AnotherInProgress': 'fieldops.errorAnotherInProgress',
  'Campaigns.NoBlocAssigned': 'fieldops.errorNoBlocAssigned',
  'Campaigns.IneligibleAgents': 'fieldops.errorIneligibleAgents',
  'Campaigns.NotStarted': 'fieldops.errorNotStarted',
  'Campaigns.NotInProgress': 'fieldops.errorNotInProgress',
  'Campaigns.AlreadyExtended': 'fieldops.errorAlreadyExtended',
  'Campaigns.AlreadyClosed': 'fieldops.errorAlreadyClosed',
  'Campaigns.Closed': 'fieldops.errorCampaignClosed',
  'Campaigns.PopulateConflict': 'fieldops.errorPopulateConflict',
  // Affectation des blocs
  'CampaignBlocs.InvalidAgent': 'fieldops.errorInvalidAgent',
  'CampaignBlocs.AlreadyAssigned': 'fieldops.errorBlocAlreadyAssigned',
  'CampaignBlocs.SameAgent': 'fieldops.errorSameAgent',
  // Affectations d'agent
  'Assignments.NotPending': 'fieldops.errorAssignmentNotPending',
  'Assignments.HasActiveSurvey': 'fieldops.errorAssignmentHasSurvey',
  // Écran désynchronisé — même conseil dans les trois cas.
  'Campaigns.NotFound': 'fieldops.errorNotFound',
  'CampaignBlocs.NotFound': 'fieldops.errorNotFound',
  'Assignments.NotFound': 'fieldops.errorNotFound',
};

const toKey = (err: unknown): string => toErrorKey(err, ERROR_KEY_BY_CODE);

@Injectable()
export class FieldOpsEffects {
  private actions$ = inject(Actions);
  private store = inject(Store);
  private fieldOpsApi = inject(FieldOpsApiPort);

  loadCampaigns$ = createEffect(() =>
    this.actions$.pipe(
      ofType(FieldOpsActions.loadCampaigns, FieldOpsActions.setCampaignFilters),
      withLatestFrom(this.store.select(fieldOpsFeature.selectCampaignFilters)),
      mergeMap(([, filters]) =>
        this.fieldOpsApi.listCampaigns(filters.status).pipe(
          map((items) => FieldOpsActions.loadCampaignsSuccess({ items })),
          catchError(() => of(FieldOpsActions.loadCampaignsFailure({ errorMessageKey: 'common.error' }))),
        ),
      ),
    ),
  );

  createCampaign$ = createEffect(() =>
    this.actions$.pipe(
      ofType(FieldOpsActions.createCampaign),
      mergeMap(({ payload }) =>
        this.fieldOpsApi.createCampaign(payload).pipe(
          map((campaign) => FieldOpsActions.createCampaignSuccess({ campaign })),
          catchError((err: unknown) => of(FieldOpsActions.createCampaignFailure({ errorMessageKey: toKey(err) }))),
        ),
      ),
    ),
  );

  updateCampaign$ = createEffect(() =>
    this.actions$.pipe(
      ofType(FieldOpsActions.updateCampaign),
      mergeMap(({ id, payload }) =>
        this.fieldOpsApi.updateCampaign(id, payload).pipe(
          map((campaign) => FieldOpsActions.updateCampaignSuccess({ campaign })),
          catchError((err: unknown) => of(FieldOpsActions.updateCampaignFailure({ errorMessageKey: toKey(err) }))),
        ),
      ),
    ),
  );

  loadCampaignDetail$ = createEffect(() =>
    this.actions$.pipe(
      ofType(FieldOpsActions.loadCampaignDetail),
      mergeMap(({ id }) =>
        this.fieldOpsApi.getCampaign(id).pipe(
          map((campaign) => FieldOpsActions.loadCampaignDetailSuccess({ campaign })),
          catchError(() => of(FieldOpsActions.loadCampaignDetailFailure({ errorMessageKey: 'common.error' }))),
        ),
      ),
    ),
  );

  loadCampaignProgress$ = createEffect(() =>
    this.actions$.pipe(
      ofType(FieldOpsActions.loadCampaignProgress),
      mergeMap(({ id }) =>
        this.fieldOpsApi.getCampaignProgress(id).pipe(
          map((progress) => FieldOpsActions.loadCampaignProgressSuccess({ progress })),
          catchError(() => of(FieldOpsActions.loadCampaignProgressFailure({ errorMessageKey: 'common.error' }))),
        ),
      ),
    ),
  );

  startCampaign$ = createEffect(() =>
    this.actions$.pipe(
      ofType(FieldOpsActions.startCampaign),
      mergeMap(({ id }) =>
        this.fieldOpsApi.startCampaign(id).pipe(
          map((result) => FieldOpsActions.startCampaignSuccess({ result })),
          catchError((err: unknown) => of(FieldOpsActions.startCampaignFailure({ errorMessageKey: toKey(err) }))),
        ),
      ),
    ),
  );

  populateCampaign$ = createEffect(() =>
    this.actions$.pipe(
      ofType(FieldOpsActions.populateCampaign),
      mergeMap(({ id }) =>
        this.fieldOpsApi.populateCampaign(id).pipe(
          map((result) => FieldOpsActions.populateCampaignSuccess({ result })),
          catchError((err: unknown) => of(FieldOpsActions.populateCampaignFailure({ errorMessageKey: toKey(err) }))),
        ),
      ),
    ),
  );

  extendCampaign$ = createEffect(() =>
    this.actions$.pipe(
      ofType(FieldOpsActions.extendCampaign),
      mergeMap(({ id }) =>
        this.fieldOpsApi.extendCampaign(id).pipe(
          map((campaign) => FieldOpsActions.extendCampaignSuccess({ campaign })),
          catchError((err: unknown) => of(FieldOpsActions.extendCampaignFailure({ errorMessageKey: toKey(err) }))),
        ),
      ),
    ),
  );

  closeCampaign$ = createEffect(() =>
    this.actions$.pipe(
      ofType(FieldOpsActions.closeCampaign),
      mergeMap(({ id }) =>
        this.fieldOpsApi.closeCampaign(id).pipe(
          map((campaign) => FieldOpsActions.closeCampaignSuccess({ campaign })),
          catchError((err: unknown) => of(FieldOpsActions.closeCampaignFailure({ errorMessageKey: toKey(err) }))),
        ),
      ),
    ),
  );

  reloadProgressAfterStart$ = createEffect(() =>
    this.actions$.pipe(
      ofType(FieldOpsActions.startCampaignSuccess),
      map(({ result }) => FieldOpsActions.loadCampaignProgress({ id: result.campaign.id })),
    ),
  );

  reloadProgressAfterExtendOrClose$ = createEffect(() =>
    this.actions$.pipe(
      ofType(FieldOpsActions.extendCampaignSuccess, FieldOpsActions.closeCampaignSuccess),
      map(({ campaign }) => FieldOpsActions.loadCampaignProgress({ id: campaign.id })),
    ),
  );

  reloadAfterPopulate$ = createEffect(() =>
    this.actions$.pipe(
      ofType(FieldOpsActions.populateCampaignSuccess),
      mergeMap(({ result }) => of(
        FieldOpsActions.loadCampaignProgress({ id: result.campaignId }),
        FieldOpsActions.loadAssignments(),
      )),
    ),
  );

  loadCampaignBlocs$ = createEffect(() =>
    this.actions$.pipe(
      ofType(FieldOpsActions.loadCampaignBlocs),
      mergeMap(({ campaignId }) =>
        this.fieldOpsApi.listCampaignBlocs(campaignId, null).pipe(
          map((items) => FieldOpsActions.loadCampaignBlocsSuccess({ items })),
          catchError(() => of(FieldOpsActions.loadCampaignBlocsFailure({ errorMessageKey: 'common.error' }))),
        ),
      ),
    ),
  );

  assignBloc$ = createEffect(() =>
    this.actions$.pipe(
      ofType(FieldOpsActions.assignBloc),
      mergeMap(({ campaignId, blocId, agentId }) =>
        this.fieldOpsApi.assignBloc(campaignId, blocId, agentId).pipe(
          map((campaignBloc) => FieldOpsActions.assignBlocSuccess({ campaignBloc })),
          catchError((err: unknown) => of(FieldOpsActions.assignBlocFailure({ errorMessageKey: toKey(err) }))),
        ),
      ),
    ),
  );

  reassignBloc$ = createEffect(() =>
    this.actions$.pipe(
      ofType(FieldOpsActions.reassignBloc),
      mergeMap(({ campaignId, blocId, agentId }) =>
        this.fieldOpsApi.reassignBloc(campaignId, blocId, agentId).pipe(
          map((campaignBloc) => FieldOpsActions.reassignBlocSuccess({ campaignBloc })),
          catchError((err: unknown) => of(FieldOpsActions.reassignBlocFailure({ errorMessageKey: toKey(err) }))),
        ),
      ),
    ),
  );

  reloadProgressAfterBlocChange$ = createEffect(() =>
    this.actions$.pipe(
      ofType(FieldOpsActions.assignBlocSuccess, FieldOpsActions.reassignBlocSuccess),
      map(({ campaignBloc }) => FieldOpsActions.loadCampaignProgress({ id: campaignBloc.campaignId })),
    ),
  );

  /**
   * Affecter/réaffecter un bloc à une campagne déjà InProgress ne fait apparaître aucune
   * parcelle dans la feuille de route tant que personne n'a cliqué "Régénérer" — repeupler
   * est explicitement conçu pour être rejoué sans risque (idempotent, createdAssignments = 0
   * est normal), donc on l'enchaîne automatiquement plutôt que de laisser un bloc affecté
   * sans tâche visible. Sans effet sur une campagne encore Planned : /assignments y répond 409,
   * la génération initiale n'a lieu qu'au démarrage.
   */
  regeneratePopulateAfterBlocChange$ = createEffect(() =>
    this.actions$.pipe(
      ofType(FieldOpsActions.assignBlocSuccess, FieldOpsActions.reassignBlocSuccess),
      withLatestFrom(this.store.select(fieldOpsFeature.selectSelectedCampaign)),
      mergeMap(([{ campaignBloc }, selectedCampaign]) =>
        selectedCampaign?.id === campaignBloc.campaignId && selectedCampaign.status === 'InProgress'
          ? of(FieldOpsActions.populateCampaign({ id: campaignBloc.campaignId }))
          : [],
      ),
    ),
  );

  transferBlocs$ = createEffect(() =>
    this.actions$.pipe(
      ofType(FieldOpsActions.transferBlocs),
      mergeMap(({ fromAgentId, toAgentId, campaignId }) =>
        this.fieldOpsApi.transferBlocs(fromAgentId, toAgentId, campaignId).pipe(
          map((result) => FieldOpsActions.transferBlocsSuccess({ result })),
          catchError((err: unknown) => of(FieldOpsActions.transferBlocsFailure({ errorMessageKey: toKey(err) }))),
        ),
      ),
    ),
  );

  loadAssignments$ = createEffect(() =>
    this.actions$.pipe(
      ofType(FieldOpsActions.loadAssignments, FieldOpsActions.setAssignmentFilters),
      withLatestFrom(this.store.select(fieldOpsFeature.selectAssignmentFilters)),
      mergeMap(([, filters]) =>
        this.fieldOpsApi.listAssignments(filters).pipe(
          map((items) => FieldOpsActions.loadAssignmentsSuccess({ items })),
          catchError(() => of(FieldOpsActions.loadAssignmentsFailure({ errorMessageKey: 'common.error' }))),
        ),
      ),
    ),
  );

  abandonAssignment$ = createEffect(() =>
    this.actions$.pipe(
      ofType(FieldOpsActions.abandonAssignment),
      mergeMap(({ id, abandonReason }) =>
        this.fieldOpsApi.abandonAssignment(id, abandonReason).pipe(
          map((assignment) => FieldOpsActions.abandonAssignmentSuccess({ assignment })),
          catchError((err: unknown) => of(FieldOpsActions.abandonAssignmentFailure({ errorMessageKey: toKey(err) }))),
        ),
      ),
    ),
  );

  reloadProgressAfterAbandon$ = createEffect(() =>
    this.actions$.pipe(
      ofType(FieldOpsActions.abandonAssignmentSuccess),
      map(({ assignment }) => FieldOpsActions.loadCampaignProgress({ id: assignment.campaignId })),
    ),
  );
}
