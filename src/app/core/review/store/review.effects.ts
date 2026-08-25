import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, exhaustMap, forkJoin, map, mergeMap, of } from 'rxjs';
import { ReviewActions } from './review.actions';
import { ReviewApiPort } from '../services/review-api.port';
import { AddressingApiPort } from '../../addressing/services/addressing-api.port';
import { ReferenceApiPort } from '../../reference/services/reference-api.port';
import { ReviewItem } from '../models/review.models';
import { ErrorKeyMap, toErrorKey } from '../../http/error-code';

/**
 * Codes métier de `/api/surveys` et des deux files de suggestions, relevés dans la source
 * `dasApi` le 2026-08-25. Testés sur `code`, jamais sur `message` (CLAUDE.md §6).
 *
 * Une seule table pour tout le module : les codes sont préfixés par leur famille, donc les
 * décisions relevé et suggestion ne peuvent pas se marcher dessus, et `reject$` — qui appelle
 * l'une OU l'autre selon `submissionType` — n'a qu'une table à consulter.
 *
 * `Surveys.SelfReview` et `*.NotPending` sont les deux refus qu'un superviseur rencontre
 * vraiment : le premier est une règle métier (on ne valide pas son propre relevé, `B1` des
 * failles), le second signale une file périmée — un collègue a statué entre-temps.
 *
 * `Surveys.InvalidValidationType` reste volontairement non mappé : c'est un bug du front (type
 * de validation inconnu envoyé), pas une situation que l'opérateur peut corriger. Le repli
 * générique est la bonne réponse.
 */
const ERROR_KEY_BY_CODE: ErrorKeyMap = {
  'Surveys.SelfReview': 'review.errorSelfReview',
  'Surveys.NotSubmitted': 'review.errorNotSubmitted',
  'Surveys.NotFound': 'review.errorSurveyNotFound',
  // Sort de `requestCorrection` seulement : sur campagne clôturée l'agent ne peut plus saisir,
  // il reste à valider ou rejeter (`RequestSurveyCorrectionHandler`).
  'Campaigns.Closed': 'review.errorCampaignClosed',
  'BlocSuggestions.NotPending': 'review.errorSuggestionNotPending',
  'StreetSuggestions.NotPending': 'review.errorSuggestionNotPending',
  'BlocSuggestions.NotFound': 'review.errorSuggestionNotFound',
  'StreetSuggestions.NotFound': 'review.errorSuggestionNotFound',
};

const toKey = (err: unknown): string => toErrorKey(err, ERROR_KEY_BY_CODE);

@Injectable()
export class ReviewEffects {
  private actions$ = inject(Actions);
  private reviewApi = inject(ReviewApiPort);
  private addressingApi = inject(AddressingApiPort);
  private referenceApi = inject(ReferenceApiPort);

  loadQueue$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ReviewActions.loadQueue),
      exhaustMap(() =>
        forkJoin({
          surveys: this.reviewApi.listSubmittedSurveys(),
          blocSuggestions: this.addressingApi.listPendingBlockSuggestions(),
          streetSuggestions: this.addressingApi.listPendingStreetSuggestions(),
          typeOccupationOptions: this.referenceApi.getTypesOccupation(),
          etatOccupationOptions: this.referenceApi.getEtatsOccupation(),
        }).pipe(
          map(({ surveys, blocSuggestions, streetSuggestions, typeOccupationOptions, etatOccupationOptions }) => {
            const items: ReviewItem[] = [
              ...surveys,
              ...blocSuggestions.map((s) => ({
                submissionType: 'block' as const,
                id: s.id,
                targetId: s.blocId,
                suggestedName: s.suggestedName,
                comment: s.comment,
                proposedAtUtc: s.proposedAtUtc,
              })),
              ...streetSuggestions.map((s) => ({
                submissionType: 'street' as const,
                id: s.id,
                targetId: s.streetId,
                suggestedName: s.suggestedName,
                comment: s.comment,
                proposedAtUtc: s.proposedAtUtc,
              })),
            ];
            return ReviewActions.loadQueueSuccess({ items, typeOccupationOptions, etatOccupationOptions });
          }),
          catchError(() => of(ReviewActions.loadQueueFailure({ errorMessageKey: 'common.error' }))),
        ),
      ),
    ),
  );

  validate$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ReviewActions.validate),
      mergeMap(({ id }) =>
        this.reviewApi.validateSurvey(id).pipe(
          map(() => ReviewActions.validateSuccess({ id })),
          catchError((err: unknown) => of(ReviewActions.validateFailure({ errorMessageKey: toKey(err) }))),
        ),
      ),
    ),
  );

  reject$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ReviewActions.reject),
      mergeMap(({ id, submissionType, rejectionReason }) => {
        const decision$ =
          submissionType === 'property'
            ? this.reviewApi.rejectSurvey(id, rejectionReason)
            : submissionType === 'block'
              ? this.addressingApi.rejectBlockSuggestion(id, rejectionReason)
              : this.addressingApi.rejectStreetSuggestion(id, rejectionReason);
        return decision$.pipe(
          map(() => ReviewActions.rejectSuccess({ id })),
          catchError((err: unknown) => of(ReviewActions.rejectFailure({ errorMessageKey: toKey(err) }))),
        );
      }),
    ),
  );

  requestCorrection$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ReviewActions.requestCorrection),
      mergeMap(({ id }) =>
        this.reviewApi.requestSurveyCorrection(id).pipe(
          map(() => ReviewActions.requestCorrectionSuccess({ id })),
          catchError((err: unknown) => of(ReviewActions.requestCorrectionFailure({ errorMessageKey: toKey(err) }))),
        ),
      ),
    ),
  );

  approveSuggestion$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ReviewActions.approveSuggestion),
      mergeMap(({ id, submissionType }) => {
        const decision$ =
          submissionType === 'block' ? this.addressingApi.approveBlockSuggestion(id) : this.addressingApi.approveStreetSuggestion(id);
        return decision$.pipe(
          map(() => ReviewActions.approveSuggestionSuccess({ id })),
          catchError((err: unknown) => of(ReviewActions.approveSuggestionFailure({ errorMessageKey: toKey(err) }))),
        );
      }),
    ),
  );

  loadPhotos$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ReviewActions.loadPhotos),
      mergeMap(({ surveyId }) =>
        this.reviewApi.getSurveyPhotos(surveyId).pipe(
          map((photos) => ReviewActions.loadPhotosSuccess({ surveyId, photos })),
          catchError((err: unknown) => of(ReviewActions.loadPhotosFailure({ surveyId, errorMessageKey: toKey(err) }))),
        ),
      ),
    ),
  );

  loadStalled$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ReviewActions.loadStalled),
      exhaustMap(() =>
        this.reviewApi.listStalledSurveys().pipe(
          map((items) => ReviewActions.loadStalledSuccess({ items })),
          catchError(() => of(ReviewActions.loadStalledFailure({ errorMessageKey: 'common.error' }))),
        ),
      ),
    ),
  );

  loadCurrentSurveys$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ReviewActions.loadCurrentSurveys),
      exhaustMap(({ blocId, surveyedOnly }) =>
        forkJoin({
          items: this.reviewApi.listCurrentSurveys(blocId, surveyedOnly),
          typeOccupationOptions: this.referenceApi.getTypesOccupation(),
          etatOccupationOptions: this.referenceApi.getEtatsOccupation(),
        }).pipe(
          map(({ items, typeOccupationOptions, etatOccupationOptions }) =>
            ReviewActions.loadCurrentSurveysSuccess({ items, typeOccupationOptions, etatOccupationOptions }),
          ),
          catchError(() => of(ReviewActions.loadCurrentSurveysFailure({ errorMessageKey: 'common.error' }))),
        ),
      ),
    ),
  );
}
