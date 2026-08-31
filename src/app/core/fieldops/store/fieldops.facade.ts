import { Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { FieldOpsActions } from './fieldops.actions';
import { fieldOpsFeature } from './fieldops.reducer';
import {
  selectIsAssignmentsLoading,
  selectIsCampaignBlocsLoading,
  selectIsCampaignsLoading,
  selectIsDecidingAssignment,
  selectIsDecidingBloc,
  selectIsProgressLoading,
} from './fieldops.selectors';
import { UUID } from '../../models/das.models';
import { CreateCampaignPayload } from '../models/fieldops.models';
import { AssignmentFilters, CampaignFilters } from './fieldops.state';
import { FieldOpsApiPort } from '../services/fieldops-api.port';

@Injectable({ providedIn: 'root' })
export class FieldOpsFacade {
  private store = inject(Store);
  private api = inject(FieldOpsApiPort);

  campaigns$ = this.store.select(fieldOpsFeature.selectCampaigns);
  isCampaignsLoading$ = this.store.select(selectIsCampaignsLoading);
  isCreatingCampaign$ = this.store.select(fieldOpsFeature.selectIsCreatingCampaign);
  createCampaignErrorMessageKey$ = this.store.select(fieldOpsFeature.selectCreateCampaignErrorMessageKey);
  /** Compteur de créations réussies — sert à ne vider le formulaire qu'en cas de succès. */
  createTick$ = this.store.select(fieldOpsFeature.selectCreateTick);
  isUpdatingCampaign$ = this.store.select(fieldOpsFeature.selectIsUpdatingCampaign);
  updateCampaignErrorMessageKey$ = this.store.select(fieldOpsFeature.selectUpdateCampaignErrorMessageKey);

  selectedCampaign$ = this.store.select(fieldOpsFeature.selectSelectedCampaign);
  progress$ = this.store.select(fieldOpsFeature.selectProgress);
  isProgressLoading$ = this.store.select(selectIsProgressLoading);

  isStarting$ = this.store.select(fieldOpsFeature.selectIsStarting);
  startErrorMessageKey$ = this.store.select(fieldOpsFeature.selectStartErrorMessageKey);

  isPopulating$ = this.store.select(fieldOpsFeature.selectIsPopulating);
  populateErrorMessageKey$ = this.store.select(fieldOpsFeature.selectPopulateErrorMessageKey);
  lastPopulateResult$ = this.store.select(fieldOpsFeature.selectLastPopulateResult);

  isExtending$ = this.store.select(fieldOpsFeature.selectIsExtending);
  isClosing$ = this.store.select(fieldOpsFeature.selectIsClosing);
  closeErrorMessageKey$ = this.store.select(fieldOpsFeature.selectCloseErrorMessageKey);

  campaignBlocs$ = this.store.select(fieldOpsFeature.selectCampaignBlocs);
  isCampaignBlocsLoading$ = this.store.select(selectIsCampaignBlocsLoading);
  isAssigningBloc$ = this.store.select(fieldOpsFeature.selectIsAssigningBloc);
  assignBlocErrorMessageKey$ = this.store.select(fieldOpsFeature.selectAssignBlocErrorMessageKey);

  isTransferringBlocs$ = this.store.select(fieldOpsFeature.selectIsTransferringBlocs);
  lastTransferResult$ = this.store.select(fieldOpsFeature.selectLastTransferResult);

  assignments$ = this.store.select(fieldOpsFeature.selectAssignments);
  isAssignmentsLoading$ = this.store.select(selectIsAssignmentsLoading);
  assignmentActionErrorMessageKey$ = this.store.select(fieldOpsFeature.selectAssignmentActionErrorMessageKey);

  loadCampaigns(): void { this.store.dispatch(FieldOpsActions.loadCampaigns()); }
  setCampaignFilters(filters: Partial<CampaignFilters>): void { this.store.dispatch(FieldOpsActions.setCampaignFilters({ filters })); }
  createCampaign(payload: CreateCampaignPayload): void { this.store.dispatch(FieldOpsActions.createCampaign({ payload })); }
  updateCampaign(id: UUID, payload: CreateCampaignPayload): void { this.store.dispatch(FieldOpsActions.updateCampaign({ id, payload })); }

  loadCampaignDetail(id: UUID): void { this.store.dispatch(FieldOpsActions.loadCampaignDetail({ id })); }
  loadCampaignProgress(id: UUID): void { this.store.dispatch(FieldOpsActions.loadCampaignProgress({ id })); }
  clearSelectedCampaign(): void { this.store.dispatch(FieldOpsActions.clearSelectedCampaign()); }

  startCampaign(id: UUID): void { this.store.dispatch(FieldOpsActions.startCampaign({ id })); }
  populateCampaign(id: UUID): void { this.store.dispatch(FieldOpsActions.populateCampaign({ id })); }
  extendCampaign(id: UUID): void { this.store.dispatch(FieldOpsActions.extendCampaign({ id })); }
  closeCampaign(id: UUID): void { this.store.dispatch(FieldOpsActions.closeCampaign({ id })); }

  loadCampaignBlocs(campaignId: UUID): void { this.store.dispatch(FieldOpsActions.loadCampaignBlocs({ campaignId })); }
  assignBloc(campaignId: UUID, blocId: UUID, agentId: UUID): void { this.store.dispatch(FieldOpsActions.assignBloc({ campaignId, blocId, agentId })); }
  reassignBloc(campaignId: UUID, blocId: UUID, agentId: UUID): void { this.store.dispatch(FieldOpsActions.reassignBloc({ campaignId, blocId, agentId })); }
  isDecidingBloc$(blocId: UUID) { return this.store.select(selectIsDecidingBloc(blocId)); }
  transferBlocs(fromAgentId: UUID, toAgentId: UUID, campaignId: UUID | null): void {
    this.store.dispatch(FieldOpsActions.transferBlocs({ fromAgentId, toAgentId, campaignId }));
  }

  setAssignmentFilters(filters: Partial<AssignmentFilters>): void { this.store.dispatch(FieldOpsActions.setAssignmentFilters({ filters })); }
  isDecidingAssignment$(id: UUID) { return this.store.select(selectIsDecidingAssignment(id)); }
  abandonAssignment(id: UUID, abandonReason: string): void { this.store.dispatch(FieldOpsActions.abandonAssignment({ id, abandonReason })); }

  /** Cadrage carte uniquement — pas un état applicatif, pas de passage par le store. */
  getBlocBoundaries(blocIds: UUID[]): Observable<Record<UUID, string>> { return this.api.getBlocBoundaries(blocIds); }
}
