import { Observable } from 'rxjs';
import { UUID } from '../../models/das.models';
import {
  AssignHouseNumberPayload,
  BlockNamingQuery,
  BlockToName,
  PropertyNumberingQuery,
  PropertyToNumber,
  StreetNamingQuery,
  StreetToName,
} from '../models/addressing.models';

export abstract class AddressingApiPort {
  abstract listBlocksToName(query: BlockNamingQuery): Observable<BlockToName[]>;
  /** Saisie directe par un admin (pas de suggestion agent en attente) — crée + approuve en une action côté backend. */
  abstract setBlockName(id: UUID, name: string): Observable<BlockToName>;
  abstract approveBlockSuggestion(id: UUID, suggestionId: UUID): Observable<BlockToName>;
  abstract rejectBlockSuggestion(id: UUID, suggestionId: UUID, reason: string): Observable<BlockToName>;

  abstract listStreetsToName(query: StreetNamingQuery): Observable<StreetToName[]>;
  abstract setStreetName(id: UUID, name: string): Observable<StreetToName>;
  abstract approveStreetSuggestion(id: UUID, suggestionId: UUID): Observable<StreetToName>;
  abstract rejectStreetSuggestion(id: UUID, suggestionId: UUID, reason: string): Observable<StreetToName>;

  abstract listPropertiesToNumber(query: PropertyNumberingQuery): Observable<PropertyToNumber[]>;
  abstract assignHouseNumber(id: UUID, payload: AssignHouseNumberPayload): Observable<PropertyToNumber>;
}
