import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { ErrorKeyMap, toErrorKey } from '../../http/error-code';
import { concatLatestFrom } from '@ngrx/operators';
import { Store } from '@ngrx/store';
import { catchError, exhaustMap, map, mergeMap, of, switchMap } from 'rxjs';
import { StaffActions } from './staff.actions';
import { staffFeature } from './staff.reducer';
import { StaffApiPort } from '../services/staff-api.port';

/**
 * Codes métier de `/api/users`. Ils se testent, jamais le `message` (CLAUDE.md §6) — c'est
 * précisément ce que faisait cet effet : il passait `error.message` d'une `HttpErrorResponse`
 * comme CLÉ i18n, ce qui affichait « Http failure response for … : 400 Bad Request » en clair
 * là où l'utilisateur attendait la raison du refus.
 */
const ERROR_KEY_BY_CODE: ErrorKeyMap = {
  // Relevés dans `dasApi` (`grep '"Users\.' src`), pas devinés : mes deux premières valeurs
  // étaient fausses, et une clé qui ne correspond à rien retombe en silence sur `common.error`.
  'Users.UsernameTaken': 'staff.errorUsernameTaken',
  'Users.UnknownRole': 'staff.errorRoleUnknown',
};

/**
 * `POST /api/users` refuse de deux façons distinctes, et l'utilisateur doit pouvoir les
 * distinguer :
 *   · 400 `ValidationProblemDetails` — la saisie ne passe pas les règles du back. Pas de `code`,
 *     donc `toErrorKey` ne peut rien en faire : on le reconnaît à son enveloppe `errors`.
 *   · 403 — le groupe `/api/users` exige le rôle Admin EN ENTIER. Un Superviseur ou un
 *     Gestionnaire n'a simplement pas le droit de créer un compte, et un message générique
 *     laisserait chercher une faute de saisie inexistante.
 */
function toCreateErrorKey(err: unknown): string {
  const e = err as { status?: number; error?: { errors?: unknown } } | null | undefined;
  if (e?.status === 403) return 'staff.errorForbidden';
  if (e?.status === 400 && e?.error?.errors) return 'staff.errorInvalid';
  return toErrorKey(err, ERROR_KEY_BY_CODE);
}

@Injectable()
export class StaffEffects {
  private actions$ = inject(Actions);
  private store = inject(Store);
  private staffApi = inject(StaffApiPort);

  /**
   * Les filtres sont RELUS DANS L'ÉTAT (CLAUDE.md §4), pas passés en payload.
   *
   * ⚠️ Cet effet appelait `list({ search: '', role: null })` **en dur** : `setFilters` mettait
   * bien l'état à jour, mais rien ne rechargeait avec, et l'API — qui filtre pourtant, en mock
   * comme en réel — recevait toujours un filtre vide. Ni la recherche ni le rôle n'ont donc
   * jamais rien filtré, sans qu'aucune erreur ne le signale : la liste répondait, complète.
   *
   * `switchMap` et non `exhaustMap` : sur un filtre, c'est la DERNIÈRE demande qui compte.
   * `exhaustMap` aurait ignoré la nouvelle frappe tant que la précédente n'était pas revenue.
   */
  loadStaff$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StaffActions.loadStaff, StaffActions.setFilters),
      concatLatestFrom(() => this.store.select(staffFeature.selectFilters)),
      switchMap(([, filters]) =>
        this.staffApi.list(filters).pipe(
          map((items) => StaffActions.loadStaffSuccess({ items })),
          catchError(() => of(StaffActions.loadStaffFailure({ errorMessageKey: 'common.error' }))),
        ),
      ),
    ),
  );

  createStaff$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StaffActions.createStaff),
      exhaustMap(({ payload }) =>
        this.staffApi.create(payload).pipe(
          map((user) => StaffActions.createStaffSuccess({ user })),
          catchError((err: unknown) =>
            of(StaffActions.createStaffFailure({ errorMessageKey: toCreateErrorKey(err) })),
          ),
        ),
      ),
    ),
  );

  setRoles$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StaffActions.setRoles),
      mergeMap(({ id, payload }) =>
        this.staffApi.setRoles(id, payload).pipe(
          map(() => StaffActions.setRolesSuccess({ id, roles: payload.roles })),
          catchError(() => of(StaffActions.setRolesFailure({ errorMessageKey: 'common.error' }))),
        ),
      ),
    ),
  );

  setActive$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StaffActions.setActive),
      mergeMap(({ id, isActive }) =>
        this.staffApi.setActive(id, isActive).pipe(
          map(() => StaffActions.setActiveSuccess({ id, isActive })),
          catchError(() => of(StaffActions.setActiveFailure({ errorMessageKey: 'common.error' }))),
        ),
      ),
    ),
  );

  loadProductivity$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StaffActions.loadProductivity),
      exhaustMap(({ campaignId, agentId }) =>
        this.staffApi.getProductivity(campaignId, agentId).pipe(
          map((items) => StaffActions.loadProductivitySuccess({ items })),
          catchError(() => of(StaffActions.loadProductivityFailure({ errorMessageKey: 'common.error' }))),
        ),
      ),
    ),
  );
}
