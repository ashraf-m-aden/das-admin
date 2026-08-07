import { Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { SettingsActions } from './settings.actions';
import { settingsFeature } from './settings.reducer';
import { selectIsCreatingRoadType, selectIsImporting, selectIsRoadTypesLoading } from './settings.selectors';
import { CreateRoadTypePayload, ImportMapDataPayload } from '../models/settings.models';

@Injectable({ providedIn: 'root' })
export class SettingsFacade {
  private store = inject(Store);

  roadTypes$ = this.store.select(settingsFeature.selectRoadTypes);
  isRoadTypesLoading$ = this.store.select(selectIsRoadTypesLoading);
  roadTypesErrorMessageKey$ = this.store.select(settingsFeature.selectRoadTypesErrorMessageKey);

  isCreatingRoadType$ = this.store.select(selectIsCreatingRoadType);
  createRoadTypeErrorMessageKey$ = this.store.select(settingsFeature.selectCreateRoadTypeErrorMessageKey);

  isImporting$ = this.store.select(selectIsImporting);
  importResult$ = this.store.select(settingsFeature.selectImportResult);
  importErrorMessageKey$ = this.store.select(settingsFeature.selectImportErrorMessageKey);

  loadRoadTypes(): void {
    this.store.dispatch(SettingsActions.loadRoadTypes());
  }

  createRoadType(payload: CreateRoadTypePayload): void {
    this.store.dispatch(SettingsActions.createRoadType({ payload }));
  }

  importMapData(payload: ImportMapDataPayload): void {
    this.store.dispatch(SettingsActions.importMapData({ payload }));
  }

  resetImport(): void {
    this.store.dispatch(SettingsActions.resetImport());
  }
}
