import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { catchError, map, mergeMap, of, withLatestFrom } from 'rxjs';
import { FieldOpsActions } from './fieldops.actions';
import { fieldOpsFeature } from './fieldops.reducer';
import { FieldOpsApiPort } from '../services/fieldops-api.port';

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
          catchError(() => of(FieldOpsActions.createCampaignFailure({ errorMessageKey: 'common.error' }))),
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
          catchError(() => of(FieldOpsActions.updateCampaignFailure({ errorMessageKey: 'common.error' }))),
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
          catchError(() => of(FieldOpsActions.startCampaignFailure({ errorMessageKey: 'common.error' }))),
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
          catchError(() => of(FieldOpsActions.populateCampaignFailure({ errorMessageKey: 'common.error' }))),
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
          catchError(() => of(FieldOpsActions.extendCampaignFailure({ errorMessageKey: 'common.error' }))),
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
          catchError(() => of(FieldOpsActions.closeCampaignFailure({ errorMessageKey: 'common.error' }))),
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
          catchError(() => of(FieldOpsActions.assignBlocFailure({ errorMessageKey: 'common.error' }))),
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
          catchError(() => of(FieldOpsActions.reassignBlocFailure({ errorMessageKey: 'common.error' }))),
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
          catchError(() => of(FieldOpsActions.transferBlocsFailure({ errorMessageKey: 'common.error' }))),
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
          catchError(() => of(FieldOpsActions.abandonAssignmentFailure({ errorMessageKey: 'common.error' }))),
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
