import { Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { ClosesActions } from './closes.actions';
import { closesFeature } from './closes.reducer';
import { selectBlocOwner, selectIsListLoading, selectTakenNumbers } from './closes.selectors';
import { UUID } from '../../models/das.models';
import { CreateClosePayload } from '../models/closes.models';

@Injectable({ providedIn: 'root' })
export class ClosesFacade {
  private store = inject(Store);

  closes$ = this.store.select(closesFeature.selectCloses);
  blocs$ = this.store.select(closesFeature.selectBlocs);
  streets$ = this.store.select(closesFeature.selectStreets);
  quartierId$ = this.store.select(closesFeature.selectQuartierId);
  isListLoading$ = this.store.select(selectIsListLoading);
  isSaving$ = this.store.select(closesFeature.selectIsSaving);
  errorMessageKey$ = this.store.select(closesFeature.selectSaveErrorMessageKey);
  saveTick$ = this.store.select(closesFeature.selectSaveTick);

  blocOwner$ = this.store.select(selectBlocOwner);
  takenNumbers$ = this.store.select(selectTakenNumbers);

  loadStreets(): void { this.store.dispatch(ClosesActions.loadStreets()); }

  selectQuartier(quartierId: UUID | null): void {
    this.store.dispatch(ClosesActions.selectQuartier({ quartierId }));
  }

  /** `id === null` → création. En modification, `quartierId` est ignoré (non modifiable côté back). */
  save(id: UUID | null, payload: CreateClosePayload): void {
    this.store.dispatch(ClosesActions.saveClose({ id, payload }));
  }

  remove(id: UUID): void {
    this.store.dispatch(ClosesActions.removeClose({ id }));
  }

  /** Rattachement : endpoint dédié, jamais un champ de `PATCH`. Porte les 3 gardes côté back. */
  attachBlocs(closeId: UUID, blocIds: UUID[]): void {
    this.store.dispatch(ClosesActions.attachBlocs({ closeId, blocIds }));
  }

  detachBloc(closeId: UUID, blocId: UUID): void {
    this.store.dispatch(ClosesActions.detachBloc({ closeId, blocId }));
  }
}
