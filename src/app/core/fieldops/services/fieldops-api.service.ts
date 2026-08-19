import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map, of } from 'rxjs';
import { FieldOpsApiPort } from './fieldops-api.port';
import { AppConfigService } from '../../config/app-config.service';
import { Assignment, Campaign, CampaignBloc, CampaignProgress, CampaignStatus, UUID } from '../../models/das.models';
import {
  AddCampaignAddressesResult,
  AssignmentQuery,
  CreateCampaignPayload,
  PopulateCampaignResult,
  StartCampaignResult,
  TransferBlocsResult,
} from '../models/fieldops.models';

@Injectable({ providedIn: 'root' })
export class FieldOpsApiService extends FieldOpsApiPort {
  private http = inject(HttpClient);
  private config = inject(AppConfigService);
  private get campaignsUrl() { return `${this.config.get('apiBaseUrl')}/campaigns`; }
  private get assignmentsUrl() { return `${this.config.get('apiBaseUrl')}/campaign-assignments`; }
  private get blocsTransferUrl() { return `${this.config.get('apiBaseUrl')}/campaign-blocs/transfer`; }
  private get blocsUrl() { return `${this.config.get('apiBaseUrl')}/blocs`; }

  override listCampaigns(status: CampaignStatus | null): Observable<Campaign[]> {
    const params: Record<string, string> = {};
    if (status) params['status'] = status;
    return this.http.get<Campaign[]>(this.campaignsUrl, { params });
  }

  override getCampaign(id: UUID): Observable<Campaign> {
    return this.http.get<Campaign>(`${this.campaignsUrl}/${id}`);
  }

  override createCampaign(payload: CreateCampaignPayload): Observable<Campaign> {
    return this.http.post<Campaign>(this.campaignsUrl, payload);
  }

  override updateCampaign(id: UUID, payload: CreateCampaignPayload): Observable<Campaign> {
    return this.http.patch<Campaign>(`${this.campaignsUrl}/${id}`, payload);
  }

  override getCampaignProgress(id: UUID): Observable<CampaignProgress> {
    return this.http.get<CampaignProgress>(`${this.campaignsUrl}/${id}/progress`);
  }

  override startCampaign(id: UUID): Observable<StartCampaignResult> {
    return this.http.post<StartCampaignResult>(`${this.campaignsUrl}/${id}/start`, {});
  }

  override populateCampaign(id: UUID): Observable<PopulateCampaignResult> {
    return this.http.post<PopulateCampaignResult>(`${this.campaignsUrl}/${id}/assignments`, {});
  }

  override addCampaignAddresses(id: UUID, adresseIds: UUID[]): Observable<AddCampaignAddressesResult> {
    return this.http.post<AddCampaignAddressesResult>(`${this.campaignsUrl}/${id}/addresses`, { adresseIds });
  }

  override extendCampaign(id: UUID): Observable<Campaign> {
    return this.http.post<Campaign>(`${this.campaignsUrl}/${id}/extend`, {});
  }

  override closeCampaign(id: UUID): Observable<Campaign> {
    return this.http.post<Campaign>(`${this.campaignsUrl}/${id}/close`, {});
  }

  override listCampaignBlocs(campaignId: UUID, agentId: UUID | null): Observable<CampaignBloc[]> {
    const params: Record<string, string> = {};
    if (agentId) params['agentId'] = agentId;
    return this.http.get<CampaignBloc[]>(`${this.campaignsUrl}/${campaignId}/blocs`, { params });
  }

  override assignBloc(campaignId: UUID, blocId: UUID, agentId: UUID): Observable<CampaignBloc> {
    return this.http.post<CampaignBloc>(`${this.campaignsUrl}/${campaignId}/blocs`, { blocId, agentId });
  }

  override reassignBloc(campaignId: UUID, blocId: UUID, agentId: UUID): Observable<CampaignBloc> {
    return this.http.patch<CampaignBloc>(`${this.campaignsUrl}/${campaignId}/blocs/${blocId}/agent`, { agentId });
  }

  override transferBlocs(fromAgentId: UUID, toAgentId: UUID, campaignId: UUID | null): Observable<TransferBlocsResult> {
    return this.http.post<TransferBlocsResult>(this.blocsTransferUrl, { fromAgentId, toAgentId, campaignId });
  }

  override listAssignments(query: AssignmentQuery): Observable<Assignment[]> {
    const params: Record<string, string> = {};
    if (query.campaignId) params['campaignId'] = query.campaignId;
    if (query.agentId) params['agentId'] = query.agentId;
    if (query.status) params['status'] = query.status;
    return this.http.get<Assignment[]>(this.assignmentsUrl, { params });
  }

  override abandonAssignment(id: UUID, abandonReason: string): Observable<Assignment> {
    return this.http.post<Assignment>(`${this.assignmentsUrl}/${id}/abandon`, { abandonReason });
  }

  override getBlocBoundaries(blocIds: UUID[]): Observable<Record<UUID, string>> {
    if (!blocIds.length) return of({});
    return forkJoin(
      blocIds.map((id) =>
        this.http.get<{ id: UUID; boundaryWkt: string | null }>(`${this.blocsUrl}/${id}`).pipe(map((b) => [id, b.boundaryWkt] as const)),
      ),
    ).pipe(map((pairs) => Object.fromEntries(pairs.filter((p): p is [UUID, string] => p[1] !== null))));
  }
}
