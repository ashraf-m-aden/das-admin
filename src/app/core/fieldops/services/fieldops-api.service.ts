import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { FieldOpsApiPort } from './fieldops-api.port';
import { AppConfigService } from '../../config/app-config.service';
import { FieldOpsData } from '../models/fieldops.models';

@Injectable({ providedIn: 'root' })
export class FieldOpsApiService extends FieldOpsApiPort {
  private http = inject(HttpClient);
  private config = inject(AppConfigService);
  private get baseUrl() { return `${this.config.get('apiBaseUrl')}/field-operations`; }

  override load(): Observable<FieldOpsData> { return this.http.get<FieldOpsData>(this.baseUrl); }
}
