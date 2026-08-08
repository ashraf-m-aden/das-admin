import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { StaffApiPort } from './staff-api.port';
import { AppConfigService } from '../../config/app-config.service';
import { CreateStaffPayload, SetRolesPayload, StaffListQuery, StaffMember } from '../models/staff.models';
import { UUID } from '../../models/das.models';

interface RawUserResponse {
  id: string;
  fullName: string;
  username: string;
  roles: string[];
  isActive: boolean;
}

@Injectable({ providedIn: 'root' })
export class StaffApiService extends StaffApiPort {
  private http = inject(HttpClient);
  private config = inject(AppConfigService);

  private get baseUrl(): string {
    return `${this.config.get('apiBaseUrl')}/users`;
  }

  override list(query: StaffListQuery): Observable<StaffMember[]> {
    return this.http.get<RawUserResponse[]>(this.baseUrl).pipe(
      map((raw) => raw.map((u) => this.toStaffMember(u))),
      map((all) =>
        all.filter((s) => {
          const search = query.search.trim().toLowerCase();
          const matchesSearch = !search || s.fullName.toLowerCase().includes(search) || s.username.toLowerCase().includes(search);
          const matchesRole = !query.role || s.roles.includes(query.role);
          return matchesSearch && matchesRole;
        }),
      ),
    );
  }

  override create(payload: CreateStaffPayload): Observable<StaffMember> {
    return this.http
      .post<RawUserResponse>(this.baseUrl, {
        fullName: payload.fullName,
        username: payload.username,
        password: payload.password,
        roleNames: payload.roles,
      })
      .pipe(map((u) => this.toStaffMember(u)));
  }

  override setRoles(id: UUID, payload: SetRolesPayload): Observable<StaffMember> {
    return this.http.patch<void>(`${this.baseUrl}/${id}/roles`, { roleNames: payload.roles }).pipe(
      map(() => ({ id, roles: payload.roles }) as StaffMember),
    );
  }

  override setActive(id: UUID, isActive: boolean): Observable<StaffMember> {
    return this.http.patch<void>(`${this.baseUrl}/${id}/status`, { isActive }).pipe(
      map(() => ({ id, isActive }) as StaffMember),
    );
  }

  private toStaffMember(raw: RawUserResponse): StaffMember {
    return { id: raw.id, fullName: raw.fullName, username: raw.username, roles: raw.roles as StaffMember['roles'], isActive: raw.isActive };
  }
}
