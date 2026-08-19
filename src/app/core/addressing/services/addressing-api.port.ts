import { Observable } from 'rxjs';
import { UUID, UpdateBlockPayload } from '../../models/das.models';
import {
  AssignHouseNumberPayload,
  BlockNamingQuery,
  BlockToName,
  PendingBlockSuggestion,
  PendingStreetSuggestion,
  PropertyNumberingQuery,
  PropertyToNumber,
  StreetNamingQuery,
  StreetToName,
  UpdateStreetNamePayload,
} from '../models/addressing.models';

export abstract class AddressingApiPort {
  abstract listBlocksToName(query: BlockNamingQuery): Observable<BlockToName[]>;
  /** `PATCH /api/blocs/{id}` — dossier complet. Refusé si `number` est `null` (bloc non repris). */
  abstract setBlockName(id: UUID, payload: UpdateBlockPayload): Observable<BlockToName>;
  /** Renvoie un succès nu : l'API répond avec la suggestion, pas le bloc mis à jour — rechargez la liste après coup. */
  abstract approveBlockSuggestion(suggestionId: UUID): Observable<void>;
  abstract rejectBlockSuggestion(suggestionId: UUID, rejectionReason: string): Observable<void>;
  /** File plate des suggestions de nom de bloc en attente — consommée par l'écran review. */
  abstract listPendingBlockSuggestions(): Observable<PendingBlockSuggestion[]>;

  abstract listStreetsToName(query: StreetNamingQuery): Observable<StreetToName[]>;
  /** `PATCH /api/streets/{id}` — dossier complet. */
  abstract setStreetName(id: UUID, payload: UpdateStreetNamePayload): Observable<StreetToName>;
  abstract approveStreetSuggestion(suggestionId: UUID): Observable<void>;
  abstract rejectStreetSuggestion(suggestionId: UUID, rejectionReason: string): Observable<void>;
  /** File plate des suggestions de nom de rue en attente — consommée par l'écran review. */
  abstract listPendingStreetSuggestions(): Observable<PendingStreetSuggestion[]>;

  abstract listPropertiesToNumber(query: PropertyNumberingQuery): Observable<PropertyToNumber[]>;
  abstract assignHouseNumber(id: UUID, payload: AssignHouseNumberPayload): Observable<PropertyToNumber>;
}
