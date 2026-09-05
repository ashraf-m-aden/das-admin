import { createFeature, createReducer, on } from '@ngrx/store';
import { CloseGenerationActions } from './close-generation.actions';
import { initialCloseGenerationState, ProposedCloseEdit } from './close-generation.state';
import { UUID } from '../../models/das.models';

/** Liste des blocs d'une proposition APRÈS corrections — base de tout retrait ou déplacement. */
function currentBlocIds(
  edits: Record<string, ProposedCloseEdit>,
  proposals: { key: string; blocs: { id: UUID }[] }[],
  key: string,
): UUID[] {
  const edited = edits[key]?.blocIds;
  if (edited) return edited;
  return proposals.find((p) => p.key === key)?.blocs.map((b) => b.id) ?? [];
}

export const closeGenerationFeature = createFeature({
  name: 'closeGeneration',
  reducer: createReducer(
    initialCloseGenerationState,

    on(CloseGenerationActions.loadProgress, (s) => ({ ...s, progressStatus: 'loading' as const })),
    on(CloseGenerationActions.loadProgressSuccess, (s, { progress }) => ({
      ...s, progress, progressStatus: 'loaded' as const,
    })),
    on(CloseGenerationActions.loadProgressFailure, (s, { errorMessageKey }) => ({
      ...s, progressStatus: 'error' as const, errorMessageKey,
    })),

    on(CloseGenerationActions.loadStreetsSuccess, (s, { streets }) => ({ ...s, streets })),

    // Changer de quartier efface TOUT le travail de relecture : les clés de proposition sont
    // locales à un aperçu, les garder les appliquerait à d'autres closes.
    on(CloseGenerationActions.selectQuartier, (s, { quartierId }) => ({
      ...s, quartierId, plan: null, edits: {}, discardedKeys: [], reviewedKeys: [],
      numberingKey: null, numbering: null, numberingEdits: {}, errorMessageKey: null,
    })),

    on(CloseGenerationActions.setParameters, (s, { parameters }) => ({
      ...s, parameters, edits: {}, discardedKeys: [], reviewedKeys: [],
      numberingKey: null, numbering: null, numberingEdits: {},
    })),

    on(CloseGenerationActions.preview, (s) => ({ ...s, isPreviewing: true, errorMessageKey: null })),
    // Un nouvel aperçu renumérote et regroupe autrement : garder les corrections les appliquerait
    // à des propositions qui ont changé de contenu.
    on(CloseGenerationActions.previewSuccess, (s, { plan }) => ({
      ...s, isPreviewing: false, plan, edits: {}, discardedKeys: [], reviewedKeys: [],
      numberingKey: null, numbering: null, numberingEdits: {},
    })),
    on(CloseGenerationActions.previewFailure, (s, { errorMessageKey }) => ({
      ...s, isPreviewing: false, errorMessageKey,
    })),

    on(CloseGenerationActions.changeStreet, (s, { key, streetId }) => ({
      ...s,
      edits: { ...s.edits, [key]: { ...s.edits[key], streetId } },
      // Changer la rue change la close : la relecture précédente ne vaut plus.
      reviewedKeys: s.reviewedKeys.filter((k) => k !== key),
    })),
    on(CloseGenerationActions.changeNumber, (s, { key, number }) => ({
      ...s, edits: { ...s.edits, [key]: { ...s.edits[key], number } },
    })),
    on(CloseGenerationActions.changeCode, (s, { key, code }) => ({
      ...s, edits: { ...s.edits, [key]: { ...s.edits[key], code } },
    })),

    on(CloseGenerationActions.removeBloc, (s, { key, blocId }) => {
      const blocIds = currentBlocIds(s.edits, s.plan?.proposed ?? [], key).filter((id) => id !== blocId);
      return {
        ...s,
        edits: { ...s.edits, [key]: { ...s.edits[key], blocIds } },
        // Le périmètre a changé : le plan de numérotation relu ne couvre plus les bonnes parcelles.
        reviewedKeys: s.reviewedKeys.filter((k) => k !== key),
        numbering: s.numberingKey === key ? null : s.numbering,
        numberingKey: s.numberingKey === key ? null : s.numberingKey,
      };
    }),

    on(CloseGenerationActions.moveBloc, (s, { fromKey, toKey, blocId }) => {
      const from = currentBlocIds(s.edits, s.plan?.proposed ?? [], fromKey).filter((id) => id !== blocId);
      const to = [...currentBlocIds(s.edits, s.plan?.proposed ?? [], toKey), blocId];
      return {
        ...s,
        edits: {
          ...s.edits,
          [fromKey]: { ...s.edits[fromKey], blocIds: from },
          [toKey]: { ...s.edits[toKey], blocIds: to },
        },
        reviewedKeys: s.reviewedKeys.filter((k) => k !== fromKey && k !== toKey),
        numbering: null,
        numberingKey: null,
        numberingEdits: {},
      };
    }),

    on(CloseGenerationActions.discardProposal, (s, { key }) => ({
      ...s,
      discardedKeys: s.discardedKeys.includes(key) ? s.discardedKeys : [...s.discardedKeys, key],
      reviewedKeys: s.reviewedKeys.filter((k) => k !== key),
    })),
    on(CloseGenerationActions.restoreProposal, (s, { key }) => ({
      ...s, discardedKeys: s.discardedKeys.filter((k) => k !== key),
    })),

    on(CloseGenerationActions.renameStreetSuccess, (s, { street }) => ({
      ...s, streets: s.streets.map((x) => (x.id === street.id ? street : x)),
    })),
    on(CloseGenerationActions.renameStreetFailure, (s, { errorMessageKey }) => ({ ...s, errorMessageKey })),

    on(CloseGenerationActions.openNumbering, (s, { key, reverse }) => ({
      ...s, isNumbering: true, numberingKey: key, numberingReverse: reverse, errorMessageKey: null,
    })),
    // Corrections effacées à chaque ouverture : un plan rejoué dans l'autre sens renumérote tout,
    // reporter les anciennes corrections les appliquerait à des positions inversées.
    on(CloseGenerationActions.openNumberingSuccess, (s, { key, numbering }) => ({
      ...s, isNumbering: false, numberingKey: key, numbering, numberingEdits: {},
    })),
    on(CloseGenerationActions.openNumberingFailure, (s, { errorMessageKey }) => ({
      ...s, isNumbering: false, errorMessageKey,
    })),
    on(CloseGenerationActions.editPlannedNumero, (s, { adresseId, numero }) => ({
      ...s, numberingEdits: { ...s.numberingEdits, [adresseId]: numero },
    })),
    on(CloseGenerationActions.closeNumbering, (s) => ({
      ...s, numberingKey: null, numbering: null, numberingEdits: {},
    })),
    on(CloseGenerationActions.markReviewed, (s, { key }) => ({
      ...s, reviewedKeys: s.reviewedKeys.includes(key) ? s.reviewedKeys : [...s.reviewedKeys, key],
    })),

    on(CloseGenerationActions.clearError, (s) => ({ ...s, errorMessageKey: null })),
  ),
});
