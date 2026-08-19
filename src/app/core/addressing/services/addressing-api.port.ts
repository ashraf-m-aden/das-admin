import { Observable } from 'rxjs';
import { UUID } from '../../models/das.models';
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
} from '../models/addressing.models';

export abstract class AddressingApiPort {
  abstract listBlocksToName(query: BlockNamingQuery): Observable<BlockToName[]>;
  /** Saisie directe par un admin (pas de suggestion agent en attente) — crée + approuve en une action côté backend. */
  abstract setBlockName(id: UUID, name: string): Observable<BlockToName>;
  /** Renvoie un succès nu : l'API répond avec la suggestion, pas le bloc mis à jour — rechargez la liste après coup. */
  abstract approveBlockSuggestion(suggestionId: UUID): Observable<void>;
  abstract rejectBlockSuggestion(suggestionId: UUID, rejectionReason: string): Observable<void>;
  /** File plate des suggestions de nom de bloc en attente — consommée par l'écran review. */
  abstract listPendingBlockSuggestions(): Observable<PendingBlockSuggestion[]>;

  abstract listStreetsToName(query: StreetNamingQuery): Observable<StreetToName[]>;
  abstract setStreetName(id: UUID, name: string): Observable<StreetToName>;
  abstract approveStreetSuggestion(suggestionId: UUID): Observable<void>;
  abstract rejectStreetSuggestion(suggestionId: UUID, rejectionReason: string): Observable<void>;
  /** File plate des suggestions de nom de rue en attente — consommée par l'écran review. */
  abstract listPendingStreetSuggestions(): Observable<PendingStreetSuggestion[]>;

  abstract listPropertiesToNumber(query: PropertyNumberingQuery): Observable<PropertyToNumber[]>;
  abstract assignHouseNumber(id: UUID, payload: AssignHouseNumberPayload): Observable<PropertyToNumber>;
}
