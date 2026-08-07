import { Observable } from 'rxjs';
import { RoadType } from '../../models/das.models';
import { CreateRoadTypePayload, ImportMapDataPayload, ImportMapDataResult } from '../models/settings.models';

export abstract class SettingsApiPort {
  abstract listRoadTypes(): Observable<RoadType[]>;
  abstract createRoadType(payload: CreateRoadTypePayload): Observable<RoadType>;
  abstract importMapData(payload: ImportMapDataPayload): Observable<ImportMapDataResult>;
}
