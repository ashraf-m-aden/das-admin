import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { catchError, exhaustMap, map, mergeMap, of, tap } from 'rxjs';
import { NotificationsActions } from './notifications.actions';
import { NotificationsApiPort } from '../services/notifications-api.port';
import { NotificationsHubService } from '../services/notifications-hub.service';
import { AppConfigService } from '../../config/app-config.service';
import { AuthActions } from '../../auth/store/auth.actions';

@Injectable()
export class NotificationsEffects {
  private actions$ = inject(Actions);
  private store = inject(Store);
  private notificationsApi = inject(NotificationsApiPort);
  private hub = inject(NotificationsHubService);
  private config = inject(AppConfigService);

  loadList$ = createEffect(() =>
    this.actions$.pipe(
      ofType(NotificationsActions.loadList),
      exhaustMap(() =>
        this.notificationsApi.list().pipe(
          map((items) => NotificationsActions.loadListSuccess({ items })),
          catchError(() => of(NotificationsActions.loadListFailure({ errorMessageKey: 'common.error' }))),
        ),
      ),
    ),
  );

  markAsRead$ = createEffect(() =>
    this.actions$.pipe(
      ofType(NotificationsActions.markAsRead),
      mergeMap(({ id }) =>
        this.notificationsApi.markAsRead(id).pipe(
          map((item) => NotificationsActions.markAsReadSuccess({ item })),
          catchError(() => of(NotificationsActions.markAsReadFailure({ errorMessageKey: 'common.error' }))),
        ),
      ),
    ),
  );

  markAllAsRead$ = createEffect(() =>
    this.actions$.pipe(
      ofType(NotificationsActions.markAllAsRead),
      exhaustMap(() =>
        this.notificationsApi.markAllAsRead().pipe(
          map((items) => NotificationsActions.markAllAsReadSuccess({ items })),
          catchError(() => of(NotificationsActions.markAllAsReadFailure({ errorMessageKey: 'common.error' }))),
        ),
      ),
    ),
  );

  /**
   * Ouvre la connexion SignalR dès que l'utilisateur est authentifié —
   * UNIQUEMENT en mode réel (useMockApi=false), puisqu'il n'existe aucun
   * Hub SignalR à contacter côté mock.
   */
  connectHub$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.loginSuccess, AuthActions.restoreSessionSuccess),
        tap(() => {
          if (this.config.get('useMockApi')) return;

          this.hub.connect((notification) => {
            this.store.dispatch(NotificationsActions.notificationReceived({ notification }));
          });
        }),
      ),
    { dispatch: false },
  );

  disconnectHub$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.logoutComplete),
        tap(() => this.hub.disconnect()),
      ),
    { dispatch: false },
  );
}
