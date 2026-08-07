import { Observable } from 'rxjs';
import { UUID } from '../../models/das.models';
import {
  AssignBlockNamePayload,
  AssignHouseNumberPayload,
  AssignStreetNamePayload,
  BlockNamingQuery,
  BlockToName,
  PropertyNumberingQuery,
  PropertyToNumber,
  StreetNamingQuery,
  StreetToName,
} from '../models/addressing.models';

export abstract class AddressingApiPort {
  abstract listBlocksToName(query: BlockNamingQuery): Observable<BlockToName[]>;
  abstract assignBlockName(id: UUID, payload: AssignBlockNamePayload): Observable<BlockToName>;

  abstract listStreetsToName(query: StreetNamingQuery): Observable<StreetToName[]>;
  abstract assignStreetName(id: UUID, payload: AssignStreetNamePayload): Observable<StreetToName>;

  abstract listPropertiesToNumber(query: PropertyNumberingQuery): Observable<PropertyToNumber[]>;
  abstract assignHouseNumber(id: UUID, payload: AssignHouseNumberPayload): Observable<PropertyToNumber>;
}
