import { createFeature, createReducer, on } from '@ngrx/store';
import { FieldOpsActions } from './fieldops.actions';
import { initialFieldOpsState } from './fieldops.state';

export const fieldOpsFeature = createFeature({
  name: 'fieldOps',
  reducer: createReducer(
    initialFieldOpsState,

    on(FieldOpsActions.loadCampaigns, (state) => ({ ...state, campaignsStatus: 'loading' as const, campaignsErrorMessageKey: null })),
    on(FieldOpsActions.loadCampaignsSuccess, (state, { items }) => ({ ...state, campaigns: items, campaignsStatus: 'loaded' as const })),
    on(FieldOpsActions.loadCampaignsFailure, (state, { errorMessageKey }) => ({ ...state, campaignsStatus: 'error' as const, campaignsErrorMessageKey: errorMessageKey })),
    on(FieldOpsActions.setCampaignFilters, (state, { filters }) => ({ ...state, campaignFilters: { ...state.campaignFilters, ...filters } })),

    on(FieldOpsActions.createCampaign, (state) => ({ ...state, isCreatingCampaign: true, createCampaignErrorMessageKey: null })),
    on(FieldOpsActions.createCampaignSuccess, (state, { campaign }) => ({ ...state, campaigns: [campaign, ...state.campaigns], isCreatingCampaign: false })),
    on(FieldOpsActions.createCampaignFailure, (state, { errorMessageKey }) => ({ ...state, isCreatingCampaign: false, createCampaignErrorMessageKey: errorMessageKey })),

    on(FieldOpsActions.updateCampaign, (state) => ({ ...state, isUpdatingCampaign: true, updateCampaignErrorMessageKey: null })),
    on(FieldOpsActions.updateCampaignSuccess, (state, { campaign }) => ({
      ...state, isUpdatingCampaign: false,
      selectedCampaign: state.selectedCampaign?.id === campaign.id ? campaign : state.selectedCampaign,
      campaigns: state.campaigns.map((c) => (c.id === campaign.id ? campaign : c)),
    })),
    on(FieldOpsActions.updateCampaignFailure, (state, { errorMessageKey }) => ({ ...state, isUpdatingCampaign: false, updateCampaignErrorMessageKey: errorMessageKey })),

    on(FieldOpsActions.loadCampaignDetail, (state) => ({ ...state, selectedCampaignStatus: 'loading' as const })),
    on(FieldOpsActions.loadCampaignDetailSuccess, (state, { campaign }) => ({ ...state, selectedCampaign: campaign, selectedCampaignStatus: 'loaded' as const })),
    on(FieldOpsActions.loadCampaignDetailFailure, (state) => ({ ...state, selectedCampaignStatus: 'error' as const })),
    on(FieldOpsActions.clearSelectedCampaign, (state) => ({
      ...state, selectedCampaign: null, selectedCampaignStatus: 'idle' as const, progress: null, progressStatus: 'idle' as const,
      campaignBlocs: [], campaignBlocsStatus: 'idle' as const, assignments: [], assignmentsStatus: 'idle' as const,
      lastPopulateResult: null, lastTransferResult: null,
    })),

    on(FieldOpsActions.loadCampaignProgress, (state) => ({ ...state, progressStatus: 'loading' as const })),
    on(FieldOpsActions.loadCampaignProgressSuccess, (state, { progress }) => ({ ...state, progress, progressStatus: 'loaded' as const })),
    on(FieldOpsActions.loadCampaignProgressFailure, (state) => ({ ...state, progressStatus: 'error' as const })),

    on(FieldOpsActions.startCampaign, (state) => ({ ...state, isStarting: true, startErrorMessageKey: null })),
    on(FieldOpsActions.startCampaignSuccess, (state, { result }) => ({
      ...state, isStarting: false,
      selectedCampaign: state.selectedCampaign?.id === result.campaign.id ? result.campaign : state.selectedCampaign,
      campaigns: state.campaigns.map((c) => (c.id === result.campaign.id ? result.campaign : c)),
    })),
    on(FieldOpsActions.startCampaignFailure, (state, { errorMessageKey }) => ({ ...state, isStarting: false, startErrorMessageKey: errorMessageKey })),

    on(FieldOpsActions.populateCampaign, (state) => ({ ...state, isPopulating: true, populateErrorMessageKey: null })),
    on(FieldOpsActions.populateCampaignSuccess, (state, { result }) => ({ ...state, isPopulating: false, lastPopulateResult: result })),
    on(FieldOpsActions.populateCampaignFailure, (state, { errorMessageKey }) => ({ ...state, isPopulating: false, populateErrorMessageKey: errorMessageKey })),

    on(FieldOpsActions.extendCampaign, (state) => ({ ...state, isExtending: true, extendErrorMessageKey: null })),
    on(FieldOpsActions.extendCampaignSuccess, (state, { campaign }) => ({
      ...state, isExtending: false,
      selectedCampaign: state.selectedCampaign?.id === campaign.id ? campaign : state.selectedCampaign,
      campaigns: state.campaigns.map((c) => (c.id === campaign.id ? campaign : c)),
    })),
    on(FieldOpsActions.extendCampaignFailure, (state, { errorMessageKey }) => ({ ...state, isExtending: false, extendErrorMessageKey: errorMessageKey })),

    on(FieldOpsActions.closeCampaign, (state) => ({ ...state, isClosing: true, closeErrorMessageKey: null })),
    on(FieldOpsActions.closeCampaignSuccess, (state, { campaign }) => ({
      ...state, isClosing: false,
      selectedCampaign: state.selectedCampaign?.id === campaign.id ? campaign : state.selectedCampaign,
      campaigns: state.campaigns.map((c) => (c.id === campaign.id ? campaign : c)),
    })),
    on(FieldOpsActions.closeCampaignFailure, (state, { errorMessageKey }) => ({ ...state, isClosing: false, closeErrorMessageKey: errorMessageKey })),

    on(FieldOpsActions.loadCampaignBlocs, (state) => ({ ...state, campaignBlocsStatus: 'loading' as const })),
    on(FieldOpsActions.loadCampaignBlocsSuccess, (state, { items }) => ({ ...state, campaignBlocs: items, campaignBlocsStatus: 'loaded' as const })),
    on(FieldOpsActions.loadCampaignBlocsFailure, (state) => ({ ...state, campaignBlocsStatus: 'error' as const })),

    on(FieldOpsActions.assignBloc, (state) => ({ ...state, isAssigningBloc: true, assignBlocErrorMessageKey: null })),
    on(FieldOpsActions.assignBlocSuccess, (state, { campaignBloc }) => ({ ...state, isAssigningBloc: false, campaignBlocs: [...state.campaignBlocs, campaignBloc] })),
    on(FieldOpsActions.assignBlocFailure, (state, { errorMessageKey }) => ({ ...state, isAssigningBloc: false, assignBlocErrorMessageKey: errorMessageKey })),

    on(FieldOpsActions.reassignBloc, (state, { blocId }) => ({ ...state, decidingBlocId: blocId, assignBlocErrorMessageKey: null })),
    on(FieldOpsActions.reassignBlocSuccess, (state, { campaignBloc }) => ({
      ...state, decidingBlocId: null,
      campaignBlocs: state.campaignBlocs.map((cb) => (cb.id === campaignBloc.id ? campaignBloc : cb)),
    })),
    on(FieldOpsActions.reassignBlocFailure, (state, { errorMessageKey }) => ({ ...state, decidingBlocId: null, assignBlocErrorMessageKey: errorMessageKey })),

    on(FieldOpsActions.transferBlocs, (state) => ({ ...state, isTransferringBlocs: true, transferBlocsErrorMessageKey: null })),
    on(FieldOpsActions.transferBlocsSuccess, (state, { result }) => ({ ...state, isTransferringBlocs: false, lastTransferResult: result })),
    on(FieldOpsActions.transferBlocsFailure, (state, { errorMessageKey }) => ({ ...state, isTransferringBlocs: false, transferBlocsErrorMessageKey: errorMessageKey })),

    on(FieldOpsActions.loadAssignments, (state) => ({ ...state, assignmentsStatus: 'loading' as const })),
    on(FieldOpsActions.loadAssignmentsSuccess, (state, { items }) => ({ ...state, assignments: items, assignmentsStatus: 'loaded' as const })),
    on(FieldOpsActions.loadAssignmentsFailure, (state) => ({ ...state, assignmentsStatus: 'error' as const })),
    on(FieldOpsActions.setAssignmentFilters, (state, { filters }) => ({ ...state, assignmentFilters: { ...state.assignmentFilters, ...filters } })),

    on(FieldOpsActions.abandonAssignment, (state, { id }) => ({ ...state, decidingAssignmentId: id, assignmentActionErrorMessageKey: null })),
    on(FieldOpsActions.abandonAssignmentSuccess, (state, { assignment }) => ({
      ...state, decidingAssignmentId: null,
      assignments: state.assignments.map((a) => (a.id === assignment.id ? assignment : a)),
    })),
    on(FieldOpsActions.abandonAssignmentFailure, (state, { errorMessageKey }) => ({ ...state, decidingAssignmentId: null, assignmentActionErrorMessageKey: errorMessageKey })),
  ),
});

export const {
  name: fieldOpsFeatureKey,
  reducer: fieldOpsReducer,
  selectCampaigns,
  selectCampaignsStatus,
  selectCampaignsErrorMessageKey,
  selectCampaignFilters,
  selectIsCreatingCampaign,
  selectCreateCampaignErrorMessageKey,
  selectIsUpdatingCampaign,
  selectUpdateCampaignErrorMessageKey,
  selectSelectedCampaign,
  selectSelectedCampaignStatus,
  selectProgress,
  selectProgressStatus,
  selectIsStarting,
  selectStartErrorMessageKey,
  selectIsPopulating,
  selectPopulateErrorMessageKey,
  selectLastPopulateResult,
  selectIsExtending,
  selectExtendErrorMessageKey,
  selectIsClosing,
  selectCloseErrorMessageKey,
  selectCampaignBlocs,
  selectCampaignBlocsStatus,
  selectIsAssigningBloc,
  selectAssignBlocErrorMessageKey,
  selectDecidingBlocId,
  selectIsTransferringBlocs,
  selectTransferBlocsErrorMessageKey,
  selectLastTransferResult,
  selectAssignments,
  selectAssignmentsStatus,
  selectAssignmentFilters,
  selectDecidingAssignmentId,
  selectAssignmentActionErrorMessageKey,
} = fieldOpsFeature;
