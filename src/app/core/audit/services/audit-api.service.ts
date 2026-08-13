import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuditApiPort } from './audit-api.port';
import { AppConfigService } from '../../config/app-config.service';
import { AuditData, AuditFilters } from '../models/audit.models';

@Injectable({ providedIn: 'root' })
export class AuditApiService extends AuditApiPort {
  private http = inject(HttpClient);
  private config = inject(AppConfigService);
  private get baseUrl() { return `${this.config.get('apiBaseUrl')}/audit`; }

  override load(filters: AuditFilters): Observable<AuditData> {
    const params: Record<string, string> = {};
    if (filters.search) params['search'] = filters.search;
    if (filters.action) params['action'] = filters.action;
    if (filters.from) params['from'] = filters.from;
    if (filters.to) params['to'] = filters.to;
    return this.http.get<AuditData>(this.baseUrl, { params });
  }
}
