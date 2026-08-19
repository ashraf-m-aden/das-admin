import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { tap } from 'rxjs';
import { ToastService } from './toast/toast.service';
import { BlocksActions } from '../blocks/store/blocks.actions';
import { ReviewActions } from '../review/store/review.actions';
import { ClientsActions } from '../clients/store/clients.actions';
import { StaffActions } from '../staff/store/staff.actions';
import { AddressingActions } from '../addressing/store/addressing.actions';

/**
 * Effets transverses de retour utilisateur : traduisent les actions de
 * succès/échec en toasts. Tous en { dispatch: false } (effets de bord purs).
 */
@Injectable()
export class FeedbackEffects {
  private actions$ = inject(Actions);
  private toast = inject(ToastService);

  // ----- Blocs -----
  blockAssigned$ = createEffect(
    () => this.actions$.pipe(
      ofType(BlocksActions.assignBlockSuccess),
      tap(() => this.toast.success('feedback.blockAssigned')),
    ),
    { dispatch: false },
  );

  blockNamed$ = createEffect(
    () => this.actions$.pipe(
      ofType(BlocksActions.setBlockNameSuccess),
      tap(() => this.toast.success('feedback.blockNamed')),
    ),
    { dispatch: false },
  );

  blockErrors$ = createEffect(
    () => this.actions$.pipe(
      ofType(BlocksActions.assignBlockFailure, BlocksActions.setBlockNameFailure),
      tap(({ errorMessageKey }) => this.toast.error(errorMessageKey || 'feedback.error')),
    ),
    { dispatch: false },
  );

  // ----- Revue -----
  reviewApproved$ = createEffect(
    () => this.actions$.pipe(
      ofType(ReviewActions.validateSuccess, ReviewActions.approveSuggestionSuccess),
      tap(() => this.toast.success('feedback.reviewApproved')),
    ),
    { dispatch: false },
  );

  reviewRejected$ = createEffect(
    () => this.actions$.pipe(
      ofType(ReviewActions.rejectSuccess, ReviewActions.requestCorrectionSuccess),
      tap(() => this.toast.success('feedback.reviewRejected')),
    ),
    { dispatch: false },
  );

  reviewErrors$ = createEffect(
    () => this.actions$.pipe(
      ofType(
        ReviewActions.validateFailure,
        ReviewActions.rejectFailure,
        ReviewActions.requestCorrectionFailure,
        ReviewActions.approveSuggestionFailure,
      ),
      tap(({ errorMessageKey }) => this.toast.error(errorMessageKey || 'feedback.error')),
    ),
    { dispatch: false },
  );

  // ----- Clients -----
  clientCreated$ = createEffect(
    () => this.actions$.pipe(
      ofType(ClientsActions.createClientSuccess),
      tap(() => this.toast.success('feedback.clientCreated')),
    ),
    { dispatch: false },
  );

  clientUpdated$ = createEffect(
    () => this.actions$.pipe(
      ofType(ClientsActions.updateClientSuccess),
      tap(() => this.toast.success('feedback.clientUpdated')),
    ),
    { dispatch: false },
  );

  clientEnabledChanged$ = createEffect(
    () => this.actions$.pipe(
      ofType(ClientsActions.setEnabledSuccess),
      tap(() => this.toast.success('feedback.saved')),
    ),
    { dispatch: false },
  );

  clientZoneGranted$ = createEffect(
    () => this.actions$.pipe(
      ofType(ClientsActions.grantZoneAccessSuccess),
      tap(() => this.toast.success('feedback.zoneGranted')),
    ),
    { dispatch: false },
  );

  clientZoneRevoked$ = createEffect(
    () => this.actions$.pipe(
      ofType(ClientsActions.revokeZoneAccessSuccess),
      tap(() => this.toast.success('feedback.zoneRevoked')),
    ),
    { dispatch: false },
  );

  clientTokenRegenerated$ = createEffect(
    () => this.actions$.pipe(
      ofType(ClientsActions.regenerateApiTokenSuccess),
      tap(() => this.toast.success('feedback.tokenRegenerated')),
    ),
    { dispatch: false },
  );

  clientTokenRevoked$ = createEffect(
    () => this.actions$.pipe(
      ofType(ClientsActions.revokeApiTokenSuccess),
      tap(() => this.toast.success('feedback.tokenRevoked')),
    ),
    { dispatch: false },
  );

  clientErrors$ = createEffect(
    () => this.actions$.pipe(
      ofType(
        ClientsActions.createClientFailure,
        ClientsActions.updateClientFailure,
        ClientsActions.setEnabledFailure,
        ClientsActions.grantZoneAccessFailure,
        ClientsActions.revokeZoneAccessFailure,
        ClientsActions.regenerateApiTokenFailure,
        ClientsActions.revokeApiTokenFailure,
      ),
      tap(({ errorMessageKey }) => this.toast.error(errorMessageKey || 'feedback.error')),
    ),
    { dispatch: false },
  );

  // ----- Personnel -----
  staffCreated$ = createEffect(
    () => this.actions$.pipe(
      ofType(StaffActions.createStaffSuccess),
      tap(() => this.toast.success('feedback.staffCreated')),
    ),
    { dispatch: false },
  );

  staffUpdated$ = createEffect(
    () => this.actions$.pipe(
      ofType(StaffActions.setRolesSuccess, StaffActions.setActiveSuccess),
      tap(() => this.toast.success('feedback.saved')),
    ),
    { dispatch: false },
  );

  staffErrors$ = createEffect(
    () => this.actions$.pipe(
      ofType(
        StaffActions.createStaffFailure,
        StaffActions.setRolesFailure,
        StaffActions.setActiveFailure,
      ),
      tap(({ errorMessageKey }) => this.toast.error(errorMessageKey || 'feedback.error')),
    ),
    { dispatch: false },
  );

  // ----- Adressage -----
  addressingNamed$ = createEffect(
    () => this.actions$.pipe(
      ofType(
        AddressingActions.blockNameActionSuccess,
        AddressingActions.streetNameActionSuccess,
        AddressingActions.blockSuggestionDecided,
        AddressingActions.streetSuggestionDecided,
      ),
      tap(() => this.toast.success('feedback.saved')),
    ),
    { dispatch: false },
  );

  addressingNumbered$ = createEffect(
    () => this.actions$.pipe(
      ofType(AddressingActions.assignHouseNumberSuccess),
      tap(() => this.toast.success('feedback.numbered')),
    ),
    { dispatch: false },
  );

  addressingErrors$ = createEffect(
    () => this.actions$.pipe(
      ofType(
        AddressingActions.blockNameActionFailure,
        AddressingActions.streetNameActionFailure,
        AddressingActions.assignHouseNumberFailure,
      ),
      tap(({ errorMessageKey }) => this.toast.error(errorMessageKey || 'feedback.error')),
    ),
    { dispatch: false },
  );
}
