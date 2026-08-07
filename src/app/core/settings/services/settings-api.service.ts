import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { SettingsApiPort } from './settings-api.port';
import { AppConfigService } from '../../config/app-config.service';
import { RoadType } from '../../models/das.models';
import { CreateRoadTypePayload, ImportMapDataPayload, ImportMapDataResult } from '../models/settings.models';

/**
 * Implémentation réelle. Endpoints attendus côté API .NET :
 *   GET  /road-types                  -> RoadType[]
 *   POST /road-types                  -> RoadType
 *   POST /map-import (multipart/form-data) -> ImportMapDataResult
 */
@Injectable({ providedIn: 'root' })
export class SettingsApiService extends SettingsApiPort {
  private http = inject(HttpClient);
  private config = inject(AppConfigService);

  private get baseUrl(): string {
    return this.config.get('apiBaseUrl');
  }

  override listRoadTypes(): Observable<RoadType[]> {
    return this.http.get<RoadType[]>(`${this.baseUrl}/road-types`);
  }

  override createRoadType(payload: CreateRoadTypePayload): Observable<RoadType> {
    return this.http.post<RoadType>(`${this.baseUrl}/road-types`, payload);
  }

  override importMapData(payload: ImportMapDataPayload): Observable<ImportMapDataResult> {
    const formData = new FormData();
    formData.append('targetType', payload.targetType);
    if (payload.adminUnitId) formData.append('adminUnitId', payload.adminUnitId);
    formData.append('file', payload.file);

    return this.http.post<ImportMapDataResult>(`${this.baseUrl}/map-import`, formData);
  }
}
