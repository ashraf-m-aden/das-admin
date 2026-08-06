import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { StaffApiPort } from './staff-api.port';
import { AppConfigService } from '../../config/app-config.service';
import {
  CreateStaffPayload,
  CreateStaffResult,
  ResetPasswordResult,
  StaffListQuery,
  StaffMember,
  UpdateStaffPayload,
} from '../models/staff.models';
import { UUID } from '../../models/das.models';

/**
 * Implémentation réelle. Endpoints attendus côté API .NET :
 *   GET    /staff?search=&role=&status=   -> StaffMember[]
 *   POST   /staff                         -> CreateStaffResult
 *   PATCH  /staff/{id}                    -> StaffMember
 *   PATCH  /staff/{id}/enabled            -> StaffMember
 *   POST   /staff/{id}/reset-password     -> ResetPasswordResult
 */
@Injectable({ providedIn: 'root' })
export class StaffApiService extends StaffApiPort {
  private http = inject(HttpClient);
  private config = inject(AppConfigService);

  private get baseUrl(): string {
    return `${this.config.get('apiBaseUrl')}/staff`;
  }

  override list(query: StaffListQuery): Observable<StaffMember[]> {
    const params: Record<string, string> = {};
    if (query.search) params['search'] = query.search;
    if (query.role) params['role'] = query.role;
    if (query.status) params['status'] = query.status;

    return this.http.get<StaffMember[]>(this.baseUrl, { params });
  }

  override create(payload: CreateStaffPayload): Observable<CreateStaffResult> {
    return this.http.post<CreateStaffResult>(this.baseUrl, payload);
  }

  override update(id: UUID, payload: UpdateStaffPayload): Observable<StaffMember> {
    return this.http.patch<StaffMember>(`${this.baseUrl}/${id}`, payload);
  }

  override setEnabled(id: UUID, enabled: boolean): Observable<StaffMember> {
    return this.http.patch<StaffMember>(`${this.baseUrl}/${id}/enabled`, { enabled });
  }

  override resetPassword(id: UUID): Observable<ResetPasswordResult> {
    return this.http.post<ResetPasswordResult>(`${this.baseUrl}/${id}/reset-password`, {});
  }
}
