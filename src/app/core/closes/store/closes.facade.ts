import { Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { ClosesActions } from './closes.actions';
import { closesFeature } from './closes.reducer';
import { selectBlocOwner, selectIsListLoading, selectTakenNumbers } from './closes.selectors';
import { UUID } from '../../models/das.models';
import { SaveClosePayload } from '../models/closes.models';

@Injectable({ providedIn: 'root' })
export class ClosesFacade {
  private store = inject(Store);

  closes$ = this.store.select(closesFeature.selectCloses);
  blocs$ = this.store.select(closesFeature.selectBlocs);
  quartierId$ = this.store.select(closesFeature.selectQuartierId);
  isListLoading$ = this.store.select(selectIsListLoading);
  isSaving$ = this.store.select(closesFeature.selectIsSaving);
  errorMessageKey$ = this.store.select(closesFeature.selectSaveErrorMessageKey);
  saveTick$ = this.store.select(closesFeature.selectSaveTick);

  blocOwner$ = this.store.select(selectBlocOwner);
  takenNumbers$ = this.store.select(selectTakenNumbers);

  selectQuartier(quartierId: UUID | null): void {
    this.store.dispatch(ClosesActions.selectQuartier({ quartierId }));
  }

  save(id: UUID | null, payload: SaveClosePayload): void {
    this.store.dispatch(ClosesActions.saveClose({ id, payload }));
  }

  remove(id: UUID): void {
    this.store.dispatch(ClosesActions.removeClose({ id }));
  }
}
