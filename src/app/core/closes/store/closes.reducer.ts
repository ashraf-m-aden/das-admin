import { createFeature, createReducer, on } from '@ngrx/store';
import { ClosesActions } from './closes.actions';
import { initialClosesState } from './closes.state';

export const closesFeature = createFeature({
  name: 'closes',
  reducer: createReducer(
    initialClosesState,

    // Changer de quartier vide la liste ET les blocs : garder les anciens afficherait, le temps
    // du chargement, des blocs qui n'appartiennent pas au quartier choisi.
    on(ClosesActions.selectQuartier, (s, { quartierId }) => ({
      ...s, quartierId, closes: [], blocs: [], saveErrorMessageKey: null,
    })),

    on(ClosesActions.loadList, (s) => ({ ...s, listStatus: 'loading' as const })),
    on(ClosesActions.loadListSuccess, (s, { closes }) => ({ ...s, closes, listStatus: 'loaded' as const })),
    on(ClosesActions.loadListFailure, (s, { errorMessageKey }) => ({
      ...s, listStatus: 'error' as const, saveErrorMessageKey: errorMessageKey,
    })),

    on(ClosesActions.loadBlocsSuccess, (s, { blocs }) => ({ ...s, blocs })),
    on(ClosesActions.loadStreetsSuccess, (s, { streets }) => ({ ...s, streets })),

    on(
      ClosesActions.saveClose, ClosesActions.removeClose, ClosesActions.attachBlocs, ClosesActions.detachBloc,
      (s) => ({ ...s, isSaving: true, saveErrorMessageKey: null }),
    ),
    on(
      ClosesActions.saveCloseSuccess, ClosesActions.removeCloseSuccess,
      ClosesActions.attachBlocsSuccess, ClosesActions.detachBlocSuccess,
      (s) => ({ ...s, isSaving: false, saveTick: s.saveTick + 1 }),
    ),
    on(
      ClosesActions.saveCloseFailure, ClosesActions.removeCloseFailure,
      ClosesActions.attachBlocsFailure, ClosesActions.detachBlocFailure,
      (s, { errorMessageKey }) => ({ ...s, isSaving: false, saveErrorMessageKey: errorMessageKey }),
    ),
  ),
});

export const {
  name: closesFeatureKey,
  reducer: closesReducer,
  selectCloses, selectBlocs, selectStreets, selectQuartierId,
  selectListStatus, selectIsSaving, selectSaveErrorMessageKey, selectSaveTick,
} = closesFeature;
