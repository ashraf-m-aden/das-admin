import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DataQualityApiPort } from './dataquality-api.port';
import { AppConfigService } from '../../config/app-config.service';
import { DataQualityData, QualityRuleRow } from '../models/dataquality.models';

@Injectable({ providedIn: 'root' })
export class DataQualityApiService extends DataQualityApiPort {
  private http = inject(HttpClient);
  private config = inject(AppConfigService);
  private get baseUrl() { return `${this.config.get('apiBaseUrl')}/data-quality`; }

  override load(): Observable<DataQualityData> { return this.http.get<DataQualityData>(this.baseUrl); }
  override toggleRule(id: string, enabled: boolean): Observable<QualityRuleRow> {
    return this.http.patch<QualityRuleRow>(`${this.baseUrl}/rules/${id}`, { enabled });
  }
  override runScan(): Observable<void> { return this.http.post<void>(`${this.baseUrl}/scan`, {}); }
}
