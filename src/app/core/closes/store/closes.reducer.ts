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

    on(ClosesActions.previewNumbering, (s) => ({ ...s, isPreviewing: true, saveErrorMessageKey: null })),
    // Les corrections manuelles sont VOLONTAIREMENT effacées à chaque nouvel aperçu : un plan
    // rejoué (sens inversé, bloc ajouté) renumérote tout, garder les anciennes corrections les
    // appliquerait à des positions qui ont changé de sens.
    on(ClosesActions.previewNumberingSuccess, (s, { plan, blocIds }) => ({
      ...s, isPreviewing: false, plan, planBlocIds: blocIds, planEdits: {},
    })),
    on(ClosesActions.previewNumberingFailure, (s, { errorMessageKey }) => ({
      ...s, isPreviewing: false, saveErrorMessageKey: errorMessageKey,
    })),
    on(ClosesActions.editPlannedNumero, (s, { adresseId, numero }) => ({
      ...s, planEdits: { ...s.planEdits, [adresseId]: numero },
    })),
    on(ClosesActions.discardPlan, (s) => ({ ...s, plan: null, planEdits: {}, planBlocIds: [] })),

    on(
      ClosesActions.saveClose, ClosesActions.removeClose, ClosesActions.attachBlocs, ClosesActions.detachBloc,
      (s) => ({ ...s, isSaving: true, saveErrorMessageKey: null }),
    ),
    on(
      ClosesActions.saveCloseSuccess, ClosesActions.removeCloseSuccess,
      ClosesActions.attachBlocsSuccess, ClosesActions.detachBlocSuccess,
      (s) => ({ ...s, isSaving: false, saveTick: s.saveTick + 1, plan: null, planEdits: {}, planBlocIds: [] }),
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
  selectPlan, selectPlanEdits, selectPlanBlocIds, selectIsPreviewing,
  selectListStatus, selectIsSaving, selectSaveErrorMessageKey, selectSaveTick,
} = closesFeature;
