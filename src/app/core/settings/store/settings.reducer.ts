import { createFeature, createReducer, on } from '@ngrx/store';
import { SettingsActions } from './settings.actions';
import { initialSettingsState } from './settings.state';

export const settingsFeature = createFeature({
  name: 'settings',
  reducer: createReducer(
    initialSettingsState,

    on(SettingsActions.loadRoadTypes, (state) => ({
      ...state,
      roadTypesStatus: 'loading' as const,
      roadTypesErrorMessageKey: null,
    })),
    on(SettingsActions.loadRoadTypesSuccess, (state, { items }) => ({
      ...state,
      roadTypes: items,
      roadTypesStatus: 'loaded' as const,
    })),
    on(SettingsActions.loadRoadTypesFailure, (state, { errorMessageKey }) => ({
      ...state,
      roadTypesStatus: 'error' as const,
      roadTypesErrorMessageKey: errorMessageKey,
    })),

    on(SettingsActions.createRoadType, (state) => ({
      ...state,
      createRoadTypeStatus: 'saving' as const,
      createRoadTypeErrorMessageKey: null,
    })),
    on(SettingsActions.createRoadTypeSuccess, (state, { item }) => ({
      ...state,
      roadTypes: [...state.roadTypes, item],
      createRoadTypeStatus: 'idle' as const,
    })),
    on(SettingsActions.createRoadTypeFailure, (state, { errorMessageKey }) => ({
      ...state,
      createRoadTypeStatus: 'error' as const,
      createRoadTypeErrorMessageKey: errorMessageKey,
    })),

    on(SettingsActions.importMapData, (state) => ({
      ...state,
      importStatus: 'importing' as const,
      importResult: null,
      importErrorMessageKey: null,
    })),
    on(SettingsActions.importMapDataSuccess, (state, { result }) => ({
      ...state,
      importStatus: 'success' as const,
      importResult: result,
    })),
    on(SettingsActions.importMapDataFailure, (state, { errorMessageKey }) => ({
      ...state,
      importStatus: 'error' as const,
      importErrorMessageKey: errorMessageKey,
    })),
    on(SettingsActions.resetImport, (state) => ({
      ...state,
      importStatus: 'idle' as const,
      importResult: null,
      importErrorMessageKey: null,
    })),
  ),
});

export const {
  name: settingsFeatureKey,
  reducer: settingsReducer,
  selectRoadTypes,
  selectRoadTypesStatus,
  selectRoadTypesErrorMessageKey,
  selectCreateRoadTypeStatus,
  selectCreateRoadTypeErrorMessageKey,
  selectImportStatus,
  selectImportResult,
  selectImportErrorMessageKey,
} = settingsFeature;
