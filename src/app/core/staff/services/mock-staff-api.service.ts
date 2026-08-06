import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { StaffApiPort } from './staff-api.port';
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
 * Store en mémoire (perdu au rechargement — suffisant pour développer
 * l'écran sans backend). Les 3 comptes de démo du module Auth sont repris
 * ici avec les mêmes id pour rester cohérents.
 */
@Injectable({ providedIn: 'root' })
export class MockStaffApiService extends StaffApiPort {
  private static readonly SIMULATED_LATENCY_MS = 450;

  private staff: StaffMember[] = [
    {
      id: 'mock-admin-0001',
      login: 'admin',
      email: 'admin@das.dj',
      phone: '+253 77 00 00 01',
      firstName: 'Ashraf',
      lastName: 'Admin',
      role: 'admin',
      status: 'active',
      enabled: true,
      profilePhotoUrl: null,
      lastLoginAt: new Date().toISOString(),
      createdAt: new Date('2026-01-10').toISOString(),
      updatedAt: new Date('2026-01-10').toISOString(),
    },
    {
      id: 'mock-supervisor-0001',
      login: 'superviseur',
      email: 'superviseur@das.dj',
      phone: '+253 77 00 00 02',
      firstName: 'Fatouma',
      lastName: 'Superviseur',
      role: 'supervisor',
      status: 'active',
      enabled: true,
      profilePhotoUrl: null,
      lastLoginAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date('2026-01-15').toISOString(),
      updatedAt: new Date('2026-01-15').toISOString(),
    },
    {
      id: 'mock-surveyor-0001',
      login: 'agent',
      email: 'agent@das.dj',
      phone: '+253 77 00 00 03',
      firstName: 'Idriss',
      lastName: 'Agent',
      role: 'surveyor',
      status: 'active',
      enabled: true,
      profilePhotoUrl: null,
      lastLoginAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date('2026-02-01').toISOString(),
      updatedAt: new Date('2026-02-01').toISOString(),
    },
    {
      id: 'mock-surveyor-0002',
      login: 'agent2',
      email: 'agent2@das.dj',
      phone: '+253 77 00 00 04',
      firstName: 'Warsama',
      lastName: 'Robleh',
      role: 'surveyor',
      status: 'suspended',
      enabled: false,
      profilePhotoUrl: null,
      lastLoginAt: new Date('2026-05-01').toISOString(),
      createdAt: new Date('2026-02-10').toISOString(),
      updatedAt: new Date('2026-06-01').toISOString(),
    },
  ];

  override list(query: StaffListQuery): Observable<StaffMember[]> {
    const search = query.search.trim().toLowerCase();

    const filtered = this.staff.filter((s) => {
      const matchesSearch =
        !search ||
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(search) ||
        s.login.toLowerCase().includes(search) ||
        s.email.toLowerCase().includes(search);
      const matchesRole = !query.role || s.role === query.role;
      const matchesStatus = !query.status || s.status === query.status;
      return matchesSearch && matchesRole && matchesStatus;
    });

    return of(filtered).pipe(delay(MockStaffApiService.SIMULATED_LATENCY_MS));
  }

  override create(payload: CreateStaffPayload): Observable<CreateStaffResult> {
    if (this.staff.some((s) => s.login.toLowerCase() === payload.login.toLowerCase())) {
      return throwError(() => ({ code: 'login_taken', message: 'staff.loginTaken' })).pipe(
        delay(MockStaffApiService.SIMULATED_LATENCY_MS),
      );
    }

    const now = new Date().toISOString();
    const user: StaffMember = {
      id: crypto.randomUUID(),
      login: payload.login,
      email: payload.email,
      phone: payload.phone,
      firstName: payload.firstName,
      lastName: payload.lastName,
      role: payload.role,
      status: 'active',
      enabled: true,
      profilePhotoUrl: null,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
    };

    this.staff = [...this.staff, user];

    return of({ user, temporaryPassword: this.generateTemporaryPassword() }).pipe(
      delay(MockStaffApiService.SIMULATED_LATENCY_MS),
    );
  }

  override update(id: UUID, payload: UpdateStaffPayload): Observable<StaffMember> {
    const existing = this.staff.find((s) => s.id === id);
    if (!existing) {
      return throwError(() => ({ code: 'not_found', message: 'common.error' }));
    }

    const updated: StaffMember = { ...existing, ...payload, updatedAt: new Date().toISOString() };
    this.staff = this.staff.map((s) => (s.id === id ? updated : s));

    return of(updated).pipe(delay(MockStaffApiService.SIMULATED_LATENCY_MS));
  }

  override setEnabled(id: UUID, enabled: boolean): Observable<StaffMember> {
    const existing = this.staff.find((s) => s.id === id);
    if (!existing) {
      return throwError(() => ({ code: 'not_found', message: 'common.error' }));
    }

    const updated: StaffMember = {
      ...existing,
      enabled,
      status: enabled ? 'active' : 'suspended',
      updatedAt: new Date().toISOString(),
    };
    this.staff = this.staff.map((s) => (s.id === id ? updated : s));

    return of(updated).pipe(delay(300));
  }

  override resetPassword(id: UUID): Observable<ResetPasswordResult> {
    const exists = this.staff.some((s) => s.id === id);
    if (!exists) {
      return throwError(() => ({ code: 'not_found', message: 'common.error' }));
    }

    return of({ temporaryPassword: this.generateTemporaryPassword() }).pipe(delay(300));
  }

  private generateTemporaryPassword(): string {
    return Math.random().toString(36).slice(-10);
  }
}
