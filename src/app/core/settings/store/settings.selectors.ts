import { createSelector } from '@ngrx/store';
import { settingsFeature } from './settings.reducer';

export const selectIsRoadTypesLoading = createSelector(
  settingsFeature.selectRoadTypesStatus,
  (status) => status === 'loading',
);

export const selectIsCreatingRoadType = createSelector(
  settingsFeature.selectCreateRoadTypeStatus,
  (status) => status === 'saving',
);

export const selectIsImporting = createSelector(
  settingsFeature.selectImportStatus,
  (status) => status === 'importing',
);
