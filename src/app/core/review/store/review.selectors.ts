import { createSelector } from '@ngrx/store';
import { UUID } from '../../models/das.models';
import { reviewFeature } from './review.reducer';
import { CampaignSurveyItem } from '../models/review.models';

/** Validé, mais provisoirement : livrable et pourtant en attente d'un recontrôle. */
const isProvisional = (i: CampaignSurveyItem): boolean =>
  i.status === 'Validated' && i.validationType === 'Temporary';

export const selectIsReviewListLoading = createSelector(reviewFeature.selectListStatus, (s) => s === 'loading');

export const selectFilteredItems = createSelector(
  reviewFeature.selectItems,
  reviewFeature.selectFilters,
  (items, filters) => (filters.submissionType ? items.filter((i) => i.submissionType === filters.submissionType) : items),
);

export const selectIsDeciding = (id: UUID) => createSelector(reviewFeature.selectDecidingId, (decidingId) => decidingId === id);

export const selectPhotosFor = (surveyId: UUID) =>
  createSelector(reviewFeature.selectPhotosBySurveyId, (photosBySurveyId) => photosBySurveyId[surveyId] ?? null);

export const selectIsLoadingPhotos = (surveyId: UUID) =>
  createSelector(reviewFeature.selectLoadingPhotosId, (loadingId) => loadingId === surveyId);

/**
 * Relevés de la campagne réduits à l'onglet courant. Le filtre est ici et non côté API : c'est
 * ce qui garantit que les compteurs d'onglets et les lignes affichées viennent du MÊME jeu de
 * données. Deux sources (compteurs de `progress`, lignes de `/surveys`) pouvaient se
 * contredire — « Brouillon 2 » au-dessus d'une liste vide ne se diagnostique pas à l'écran.
 */
export const selectFilteredCampaignSurveys = createSelector(
  reviewFeature.selectCampaignSurveys,
  reviewFeature.selectCampaignSurveyStatus,
  (items, filtre) => {
    if (!filtre) return items;
    // Seul onglet qui ne se lit pas sur `status` : le provisoire se distingue par
    // `validationType`, et c'est justement ce qui le rendait introuvable.
    if (filtre === 'ValidatedTemporary') return items.filter(isProvisional);
    return items.filter((i) => i.status === filtre);
  },
);

/** Compteurs d'onglets comptés sur la liste rapatriée — jamais sur une autre requête. */
export const selectCampaignSurveyCounts = createSelector(
  reviewFeature.selectCampaignSurveys,
  (items) => ({
    all: items.length,
    Draft: items.filter((i) => i.status === 'Draft').length,
    Submitted: items.filter((i) => i.status === 'Submitted').length,
    Validated: items.filter((i) => i.status === 'Validated').length,
    // Compté DANS `Validated`, pas à côté : la somme des onglets dépasse donc `all`. C'est
    // voulu — l'avancement serveur ne sépare pas les deux, et un onglet « Validé » qui
    // afficherait moins que son propre compteur serait le vrai problème.
    ValidatedTemporary: items.filter(isProvisional).length,
    Rejected: items.filter((i) => i.status === 'Rejected').length,
  }),
);
