import { Observable } from 'rxjs';
import {
  CityPostcodeRow, QuartierPostcodeRow, UpdateCityCodePayload, UpdateQuartierAreaNumberPayload,
} from '../models/postcodes.models';

/** Ne couvre que ce que l'écran codes postaux a besoin de `/api/quartiers` et `/api/cities` — pas le CRUD complet de ces entités. */
export abstract class PostcodesApiPort {
  abstract listQuartiers(): Observable<QuartierPostcodeRow[]>;
  abstract listCities(): Observable<CityPostcodeRow[]>;
  abstract updateQuartierAreaNumber(payload: UpdateQuartierAreaNumberPayload): Observable<QuartierPostcodeRow>;
  abstract updateCityCode(payload: UpdateCityCodePayload): Observable<CityPostcodeRow>;
}
