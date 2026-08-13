import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { catchError, exhaustMap, map, of, withLatestFrom,mergeMap } from 'rxjs';
import { ReviewActions } from './review.actions';
import { reviewFeature } from './review.reducer';
import { ReviewApiPort } from '../services/review-api.port';

@Injectable()
export class ReviewEffects {
  private actions$ = inject(Actions);
  private store = inject(Store);
  private reviewApi = inject(ReviewApiPort);

  loadQueue$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ReviewActions.loadQueue),
      withLatestFrom(this.store.select(reviewFeature.selectFilters)),
      exhaustMap(([, filters]) =>
        this.reviewApi.listQueue(filters).pipe(
          map((items) => ReviewActions.loadQueueSuccess({ items })),
          catchError(() => of(ReviewActions.loadQueueFailure({ errorMessageKey: 'common.error' }))),
        ),
      ),
    ),
  );

requestResurvey$ = createEffect(() => this.actions$.pipe(
    ofType(ReviewActions.requestResurvey),
    mergeMap(({ id, submissionType }) => this.reviewApi.requestResurvey(id, submissionType).pipe(
      map((item) => ReviewActions.requestResurveySuccess({ item })),
      catchError(() => of(ReviewActions.requestResurveyFailure({ errorMessageKey: 'common.error' }))),
    )),
  ));
  reloadOnFilterChange$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ReviewActions.setFilters),
      map(() => ReviewActions.loadQueue()),
    ),
  );

  approve$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ReviewActions.approve),
      exhaustMap(({ id, submissionType }) =>
        this.reviewApi.approve(id, submissionType).pipe(
          map((item) => ReviewActions.approveSuccess({ item })),
          catchError(() => of(ReviewActions.approveFailure({ errorMessageKey: 'common.error' }))),
        ),
      ),
    ),
  );

  reject$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ReviewActions.reject),
      exhaustMap(({ id, submissionType, payload }) =>
        this.reviewApi.reject(id, submissionType, payload).pipe(
          map((item) => ReviewActions.rejectSuccess({ item })),
          catchError(() => of(ReviewActions.rejectFailure({ errorMessageKey: 'common.error' }))),
        ),
      ),
    ),
  );
}
