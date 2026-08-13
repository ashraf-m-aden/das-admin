import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ReportsApiPort } from './reports-api.port';
import { AppConfigService } from '../../config/app-config.service';
import { ReportExportFormat, ReportsData } from '../models/reports.models';

@Injectable({ providedIn: 'root' })
export class ReportsApiService extends ReportsApiPort {
  private http = inject(HttpClient);
  private config = inject(AppConfigService);
  private get baseUrl() { return `${this.config.get('apiBaseUrl')}/reports`; }

  override load(): Observable<ReportsData> { return this.http.get<ReportsData>(this.baseUrl); }
  override exportReport(format: ReportExportFormat): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/export`, { format });
  }
  override generateReport(): Observable<void> { return this.http.post<void>(`${this.baseUrl}/generate`, {}); }
}
