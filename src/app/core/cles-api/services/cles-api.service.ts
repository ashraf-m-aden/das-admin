import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ClesApiPort } from './cles-api.port';
import { AppConfigService } from '../../config/app-config.service';
import { UUID } from '../../models/das.models';
import { CleApi, CreerCleApiPayload } from '../models/cles-api.models';

@Injectable({ providedIn: 'root' })
export class ClesApiService extends ClesApiPort {
  private http = inject(HttpClient);
  private config = inject(AppConfigService);

  private get baseUrl(): string {
    return `${this.config.get('apiBaseUrl')}/cles-api`;
  }

  override list(): Observable<CleApi[]> {
    return this.http.get<CleApi[]>(this.baseUrl);
  }

  override creer(payload: CreerCleApiPayload): Observable<CleApi> {
    return this.http.post<CleApi>(this.baseUrl, payload);
  }

  override revoquer(id: UUID): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${id}/revoquer`, {});
  }
}
