import { createSelector } from '@ngrx/store';
import { UUID } from '../../models/das.models';
import { fieldOpsFeature } from './fieldops.reducer';

export const selectIsCampaignsLoading = createSelector(fieldOpsFeature.selectCampaignsStatus, (s) => s === 'loading');
export const selectIsAssignmentsLoading = createSelector(fieldOpsFeature.selectAssignmentsStatus, (s) => s === 'loading');
export const selectIsProgressLoading = createSelector(fieldOpsFeature.selectProgressStatus, (s) => s === 'loading');
export const selectIsCampaignBlocsLoading = createSelector(fieldOpsFeature.selectCampaignBlocsStatus, (s) => s === 'loading');

export const selectIsDecidingAssignment = (id: UUID) =>
  createSelector(fieldOpsFeature.selectDecidingAssignmentId, (decidingId) => decidingId === id);

export const selectIsDecidingBloc = (blocId: UUID) =>
  createSelector(fieldOpsFeature.selectDecidingBlocId, (decidingId) => decidingId === blocId);
