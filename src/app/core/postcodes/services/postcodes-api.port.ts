import { Observable } from 'rxjs';
import {
  CityPostcodeRow, QuartierPostcodeRow, UpdateCityCodePayload, UpdateQuartierAreaNumberPayload,
  ZoneOption,
} from '../models/postcodes.models';

/** Ne couvre que ce que l'écran codes postaux a besoin de `/api/quartiers` et `/api/cities` — pas le CRUD complet de ces entités. */
export abstract class PostcodesApiPort {
  abstract listQuartiers(): Observable<QuartierPostcodeRow[]>;
  abstract listCities(): Observable<CityPostcodeRow[]>;
  /** `GET /api/zones` sans filtre — `communeId` y est optionnel. Donne les NOMS, que `Quartier` ne porte pas. */
  abstract listZones(): Observable<ZoneOption[]>;
  abstract updateQuartierAreaNumber(payload: UpdateQuartierAreaNumberPayload): Observable<QuartierPostcodeRow>;
  abstract updateCityCode(payload: UpdateCityCodePayload): Observable<CityPostcodeRow>;
}
