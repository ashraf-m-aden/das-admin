import { Observable } from 'rxjs';
import {
  AssignQuartierZonePayload, CityPostcodeRow, QuartierPostcodeRow, UpdateCityCodePayload,
  UpdateQuartierAreaNumberPayload, ZoneRow,
} from '../models/postcodes.models';

/** Ne couvre que ce que l'écran codes postaux a besoin de `/api/quartiers`, `/api/cities` et `/api/zones` — pas le CRUD complet de ces entités. */
export abstract class PostcodesApiPort {
  abstract listQuartiers(): Observable<QuartierPostcodeRow[]>;
  abstract listCities(): Observable<CityPostcodeRow[]>;
  /** `GET /api/zones` sans filtre — `communeId` y est optionnel. Donne les NOMS, que `Quartier` ne porte pas. */
  abstract listZones(): Observable<ZoneRow[]>;
  abstract updateQuartierAreaNumber(payload: UpdateQuartierAreaNumberPayload): Observable<QuartierPostcodeRow>;
  /** Rattache ou détache un quartier. Pas de route côté zone : la composition se pilote depuis le quartier. */
  abstract assignQuartierZone(payload: AssignQuartierZonePayload): Observable<QuartierPostcodeRow>;
  abstract updateCityCode(payload: UpdateCityCodePayload): Observable<CityPostcodeRow>;
}
