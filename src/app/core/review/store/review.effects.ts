import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, exhaustMap, forkJoin, map, mergeMap, of } from 'rxjs';
import { ReviewActions } from './review.actions';
import { ReviewApiPort } from '../services/review-api.port';
import { AddressingApiPort } from '../../addressing/services/addressing-api.port';
import { ReviewItem } from '../models/review.models';

@Injectable()
export class ReviewEffects {
  private actions$ = inject(Actions);
  private reviewApi = inject(ReviewApiPort);
  private addressingApi = inject(AddressingApiPort);

  loadQueue$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ReviewActions.loadQueue),
      exhaustMap(() =>
        forkJoin({
          surveys: this.reviewApi.listSubmittedSurveys(),
          blocSuggestions: this.addressingApi.listPendingBlockSuggestions(),
          streetSuggestions: this.addressingApi.listPendingStreetSuggestions(),
        }).pipe(
          map(({ surveys, blocSuggestions, streetSuggestions }) => {
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
            return ReviewActions.loadQueueSuccess({ items });
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
          catchError(() => of(ReviewActions.validateFailure({ errorMessageKey: 'common.error' }))),
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
          catchError(() => of(ReviewActions.rejectFailure({ errorMessageKey: 'common.error' }))),
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
          catchError(() => of(ReviewActions.requestCorrectionFailure({ errorMessageKey: 'common.error' }))),
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
          catchError(() => of(ReviewActions.approveSuggestionFailure({ errorMessageKey: 'common.error' }))),
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
          catchError(() => of(ReviewActions.loadPhotosFailure({ surveyId, errorMessageKey: 'common.error' }))),
        ),
      ),
    ),
  );
}
