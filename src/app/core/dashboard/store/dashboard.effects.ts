import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, exhaustMap, map, of } from 'rxjs';
import { DashboardActions } from './dashboard.actions';
import { DashboardApiPort } from '../services/dashboard-api.port';

@Injectable()
export class DashboardEffects {
  private actions$ = inject(Actions);
  private dashboardApi = inject(DashboardApiPort);

  loadSummary$ = createEffect(() =>
    this.actions$.pipe(
      ofType(DashboardActions.loadSummary),
      exhaustMap(() =>
        this.dashboardApi.getSummary().pipe(
          map((summary) => DashboardActions.loadSummarySuccess({ summary })),
          catchError(() => of(DashboardActions.loadSummaryFailure({ errorMessageKey: 'common.error' }))),
        ),
      ),
    ),
  );
}
