import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { StaffApiPort } from './staff-api.port';
import { CreateStaffPayload, SetRolesPayload, StaffListQuery, StaffMember } from '../models/staff.models';
import { UUID } from '../../models/das.models';

@Injectable({ providedIn: 'root' })
export class MockStaffApiService extends StaffApiPort {
  private static readonly SIMULATED_LATENCY_MS = 450;

  private staff: StaffMember[] = [
    { id: 'mock-admin-0001', fullName: 'Ashraf Admin', username: 'admin', roles: ['Admin'], isActive: true },
    { id: 'mock-supervisor-0001', fullName: 'Fatouma Superviseur', username: 'superviseur', roles: ['Superviseur'], isActive: true },
    { id: 'mock-surveyor-0001', fullName: 'Idriss Agent', username: 'agent', roles: ['AgentTerrain'], isActive: true },
    { id: 'mock-surveyor-0002', fullName: 'Warsama Robleh', username: 'agent2', roles: ['AgentTerrain'], isActive: false },
  ];

  override list(query: StaffListQuery): Observable<StaffMember[]> {
    const search = query.search.trim().toLowerCase();
    const filtered = this.staff.filter((s) => {
      const matchesSearch =
        !search || s.fullName.toLowerCase().includes(search) || s.username.toLowerCase().includes(search);
      const matchesRole = !query.role || s.roles.includes(query.role);
      return matchesSearch && matchesRole;
    });
    return of(filtered).pipe(delay(MockStaffApiService.SIMULATED_LATENCY_MS));
  }

  override create(payload: CreateStaffPayload): Observable<StaffMember> {
    if (this.staff.some((s) => s.username.toLowerCase() === payload.username.toLowerCase())) {
      return throwError(() => ({ code: 'username_taken', message: 'staff.usernameTaken' })).pipe(
        delay(MockStaffApiService.SIMULATED_LATENCY_MS),
      );
    }
    const user: StaffMember = {
      id: crypto.randomUUID(),
      fullName: payload.fullName,
      username: payload.username,
      roles: payload.roles,
      isActive: true,
    };
    this.staff = [...this.staff, user];
    return of(user).pipe(delay(MockStaffApiService.SIMULATED_LATENCY_MS));
  }

  override setRoles(id: UUID, payload: SetRolesPayload): Observable<StaffMember> {
    const existing = this.staff.find((s) => s.id === id);
    if (!existing) return throwError(() => ({ code: 'not_found', message: 'common.error' }));
    const updated: StaffMember = { ...existing, roles: payload.roles };
    this.staff = this.staff.map((s) => (s.id === id ? updated : s));
    return of(updated).pipe(delay(300));
  }

  override setActive(id: UUID, isActive: boolean): Observable<StaffMember> {
    const existing = this.staff.find((s) => s.id === id);
    if (!existing) return throwError(() => ({ code: 'not_found', message: 'common.error' }));
    const updated: StaffMember = { ...existing, isActive };
    this.staff = this.staff.map((s) => (s.id === id ? updated : s));
    return of(updated).pipe(delay(300));
  }
}
