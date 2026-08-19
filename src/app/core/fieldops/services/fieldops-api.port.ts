import { Observable } from 'rxjs';
import { Assignment, Campaign, CampaignBloc, CampaignProgress, CampaignStatus, UUID } from '../../models/das.models';
import {
  AddCampaignAddressesResult,
  AssignmentQuery,
  CreateCampaignPayload,
  PopulateCampaignResult,
  StartCampaignResult,
  TransferBlocsResult,
} from '../models/fieldops.models';

export abstract class FieldOpsApiPort {
  abstract listCampaigns(status: CampaignStatus | null): Observable<Campaign[]>;
  abstract getCampaign(id: UUID): Observable<Campaign>;
  abstract createCampaign(payload: CreateCampaignPayload): Observable<Campaign>;
  /** Corrige nom/date limite — refusé sur une campagne clôturée. */
  abstract updateCampaign(id: UUID, payload: CreateCampaignPayload): Observable<Campaign>;
  abstract getCampaignProgress(id: UUID): Observable<CampaignProgress>;
  /** Planned → InProgress, pas de body — génère aussi la feuille de route initiale. */
  abstract startCampaign(id: UUID): Observable<StartCampaignResult>;
  /** Rejoue la génération de la feuille de route, pas de body — 409 tant que la campagne est Planned. */
  abstract populateCampaign(id: UUID): Observable<PopulateCampaignResult>;
  abstract addCampaignAddresses(id: UUID, adresseIds: UUID[]): Observable<AddCampaignAddressesResult>;
  abstract extendCampaign(id: UUID): Observable<Campaign>;
  abstract closeCampaign(id: UUID): Observable<Campaign>;

  /** Blocs affectés d'une campagne — LA maille d'affectation réelle. */
  abstract listCampaignBlocs(campaignId: UUID, agentId: UUID | null): Observable<CampaignBloc[]>;
  abstract assignBloc(campaignId: UUID, blocId: UUID, agentId: UUID): Observable<CampaignBloc>;
  abstract reassignBloc(campaignId: UUID, blocId: UUID, agentId: UUID): Observable<CampaignBloc>;
  abstract transferBlocs(fromAgentId: UUID, toAgentId: UUID, campaignId: UUID | null): Observable<TransferBlocsResult>;

  abstract listAssignments(query: AssignmentQuery): Observable<Assignment[]>;
  abstract abandonAssignment(id: UUID, abandonReason: string): Observable<Assignment>;

  /** Emprise (WKT) des blocs demandés — pour cadrer la carte, pas pour le rendu (les tuiles s'en chargent). */
  abstract getBlocBoundaries(blocIds: UUID[]): Observable<Record<UUID, string>>;
}
