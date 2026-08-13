import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PostcodesApiPort } from './postcodes-api.port';
import { AppConfigService } from '../../config/app-config.service';
import { AllocatePostcodePayload, PostcodeRow, PostcodesData } from '../models/postcodes.models';

@Injectable({ providedIn: 'root' })
export class PostcodesApiService extends PostcodesApiPort {
  private http = inject(HttpClient);
  private config = inject(AppConfigService);
  private get baseUrl() { return `${this.config.get('apiBaseUrl')}/postcodes`; }

  override load(): Observable<PostcodesData> { return this.http.get<PostcodesData>(this.baseUrl); }
  override allocate(p: AllocatePostcodePayload): Observable<PostcodeRow> { return this.http.post<PostcodeRow>(this.baseUrl, p); }
}
