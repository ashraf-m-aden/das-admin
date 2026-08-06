import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DashboardApiPort } from './dashboard-api.port';
import { AppConfigService } from '../../config/app-config.service';
import { DashboardSummary } from '../models/dashboard.models';

/**
 * Implémentation réelle. Endpoint attendu côté API .NET :
 *   GET /dashboard/summary -> DashboardSummary
 */
@Injectable({ providedIn: 'root' })
export class DashboardApiService extends DashboardApiPort {
  private http = inject(HttpClient);
  private config = inject(AppConfigService);

  override getSummary(): Observable<DashboardSummary> {
    return this.http.get<DashboardSummary>(`${this.config.get('apiBaseUrl')}/dashboard/summary`);
  }
}
