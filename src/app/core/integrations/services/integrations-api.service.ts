import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { IntegrationsApiPort } from './integrations-api.port';
import { AppConfigService } from '../../config/app-config.service';
import { Integration, IntegrationsData } from '../models/integrations.models';

@Injectable({ providedIn: 'root' })
export class IntegrationsApiService extends IntegrationsApiPort {
  private http = inject(HttpClient);
  private config = inject(AppConfigService);
  private get baseUrl() { return `${this.config.get('apiBaseUrl')}/integrations`; }

  override load(): Observable<IntegrationsData> { return this.http.get<IntegrationsData>(this.baseUrl); }
  override toggle(id: string, connect: boolean): Observable<Integration> {
    return this.http.patch<Integration>(`${this.baseUrl}/${id}`, { connect });
  }
}
