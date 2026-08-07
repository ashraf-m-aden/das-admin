import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { ClientsApiPort } from './clients-api.port';
import { UUID } from '../../models/das.models';
import {
  ApiTokenItem,
  ClientListItem,
  ClientListQuery,
  CreateApiTokenPayload,
  CreateApiTokenResult,
  CreateClientPayload,
  CreateClientResult,
  GrantZoneAccessPayload,
  SubscriptionPlanOption,
  UpdateClientPayload,
  ZoneAccessItem,
  ZoneOption,
} from '../models/clients.models';

@Injectable({ providedIn: 'root' })
export class MockClientsApiService extends ClientsApiPort {
  private static readonly SIMULATED_LATENCY_MS = 400;

  private plans: SubscriptionPlanOption[] = [
    { id: 'plan-trial', name: 'Essai', maxZones: 1 },
    { id: 'plan-standard', name: 'Standard', maxZones: 5 },
    { id: 'plan-enterprise', name: 'Entreprise', maxZones: 50 },
  ];

  private zones: ZoneOption[] = [
    { id: 'zone-q7', name: 'Boulaos — Arr. 2 — Q7' },
    { id: 'zone-q3', name: 'Balbala — Q3' },
    { id: 'zone-rasdika', name: 'Ras Dika' },
    { id: 'zone-einguela', name: 'Einguela' },
  ];

  private clients: ClientListItem[] = [
    {
      id: 'client-0001',
      companyName: 'La Poste de Djibouti',
      contactName: 'Amina Houssein',
      email: 'a.houssein@laposte.dj',
      phone: '+253 21 35 00 00',
      status: 'active',
      enabled: true,
      planId: 'plan-enterprise',
      planName: 'Entreprise',
      createdAt: new Date('2026-04-01').toISOString(),
    },
    {
      id: 'client-0002',
      companyName: 'Djib-Livraison SARL',
      contactName: 'Yonis Farah',
      email: 'yonis@djib-livraison.dj',
      phone: null,
      status: 'trial',
      enabled: true,
      planId: 'plan-trial',
      planName: 'Essai',
      createdAt: new Date('2026-07-10').toISOString(),
    },
  ];

  private zoneAccess: Record<UUID, ZoneAccessItem[]> = {
    'client-0001': [
      { id: 'za-0001', zoneId: 'zone-q7', zoneName: 'Boulaos — Arr. 2 — Q7', accessStatus: 'granted', grantedAt: new Date('2026-04-05').toISOString() },
      { id: 'za-0002', zoneId: 'zone-q3', zoneName: 'Balbala — Q3', accessStatus: 'granted', grantedAt: new Date('2026-04-05').toISOString() },
    ],
    'client-0002': [],
  };

  /** Un seul jeton par client, ou null. */
  private apiTokens: Record<UUID, ApiTokenItem | null> = {
    'client-0001': {
      id: 'tok-0001',
      name: 'Production — Lookup adresse',
      scopes: ['address:lookup'],
      lastUsedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date('2026-04-06').toISOString(),
    },
    'client-0002': null,
  };

  override list(query: ClientListQuery): Observable<ClientListItem[]> {
    const search = query.search.trim().toLowerCase();
    const filtered = this.clients.filter((c) => {
      const matchesSearch =
        !search ||
        c.companyName.toLowerCase().includes(search) ||
        c.contactName.toLowerCase().includes(search) ||
        c.email.toLowerCase().includes(search);
      const matchesStatus = !query.status || c.status === query.status;
      return matchesSearch && matchesStatus;
    });
    return of(filtered).pipe(delay(MockClientsApiService.SIMULATED_LATENCY_MS));
  }

  override getById(id: UUID): Observable<ClientListItem> {
    const client = this.clients.find((c) => c.id === id);
    if (!client) return throwError(() => ({ code: 'not_found', message: 'common.error' }));
    return of(client).pipe(delay(300));
  }

  override create(payload: CreateClientPayload): Observable<CreateClientResult> {
    if (this.clients.some((c) => c.email.toLowerCase() === payload.email.toLowerCase())) {
      return throwError(() => ({ code: 'email_taken', message: 'clients.emailTaken' })).pipe(
        delay(MockClientsApiService.SIMULATED_LATENCY_MS),
      );
    }
    const plan = this.plans.find((p) => p.id === payload.planId);
    const now = new Date().toISOString();
    const client: ClientListItem = {
      id: crypto.randomUUID(),
      companyName: payload.companyName,
      contactName: payload.contactName,
      email: payload.email,
      phone: payload.phone,
      status: 'trial',
      enabled: true,
      planId: payload.planId,
      planName: plan?.name ?? '—',
      createdAt: now,
    };
    this.clients = [...this.clients, client];
    this.zoneAccess[client.id] = [];
    this.apiTokens[client.id] = null;
    return of({ client, temporaryPassword: this.generatePassword() }).pipe(
      delay(MockClientsApiService.SIMULATED_LATENCY_MS),
    );
  }

  override update(id: UUID, payload: UpdateClientPayload): Observable<ClientListItem> {
    const existing = this.clients.find((c) => c.id === id);
    if (!existing) return throwError(() => ({ code: 'not_found', message: 'common.error' }));
    const plan = this.plans.find((p) => p.id === payload.planId);
    const updated: ClientListItem = { ...existing, ...payload, planName: plan?.name ?? existing.planName };
    this.clients = this.clients.map((c) => (c.id === id ? updated : c));
    return of(updated).pipe(delay(MockClientsApiService.SIMULATED_LATENCY_MS));
  }

  override setEnabled(id: UUID, enabled: boolean): Observable<ClientListItem> {
    const existing = this.clients.find((c) => c.id === id);
    if (!existing) return throwError(() => ({ code: 'not_found', message: 'common.error' }));
    const updated: ClientListItem = { ...existing, enabled, status: enabled ? 'active' : 'suspended' };
    this.clients = this.clients.map((c) => (c.id === id ? updated : c));
    return of(updated).pipe(delay(300));
  }

  override listPlans(): Observable<SubscriptionPlanOption[]> {
    return of(this.plans).pipe(delay(200));
  }

  override listZoneAccess(clientId: UUID): Observable<ZoneAccessItem[]> {
    return of(this.zoneAccess[clientId] ?? []).pipe(delay(MockClientsApiService.SIMULATED_LATENCY_MS));
  }

  override listAvailableZones(): Observable<ZoneOption[]> {
    return of(this.zones).pipe(delay(200));
  }

  override grantZoneAccess(clientId: UUID, payload: GrantZoneAccessPayload): Observable<ZoneAccessItem> {
    const zone = this.zones.find((z) => z.id === payload.zoneId);
    if (!zone) return throwError(() => ({ code: 'not_found', message: 'common.error' }));
    const current = this.zoneAccess[clientId] ?? [];
    if (current.some((za) => za.zoneId === payload.zoneId && za.accessStatus === 'granted')) {
      return throwError(() => ({ code: 'already_granted', message: 'clients.zoneAlreadyGranted' }));
    }
    const created: ZoneAccessItem = {
      id: crypto.randomUUID(),
      zoneId: zone.id,
      zoneName: zone.name,
      accessStatus: 'granted',
      grantedAt: new Date().toISOString(),
    };
    this.zoneAccess[clientId] = [...current, created];
    return of(created).pipe(delay(300));
  }

  override revokeZoneAccess(clientId: UUID, zoneAccessId: UUID): Observable<ZoneAccessItem> {
    const current = this.zoneAccess[clientId] ?? [];
    const existing = current.find((za) => za.id === zoneAccessId);
    if (!existing) return throwError(() => ({ code: 'not_found', message: 'common.error' }));
    const updated: ZoneAccessItem = { ...existing, accessStatus: 'blocked' };
    this.zoneAccess[clientId] = current.map((za) => (za.id === zoneAccessId ? updated : za));
    return of(updated).pipe(delay(300));
  }

  override getApiToken(clientId: UUID): Observable<ApiTokenItem | null> {
    return of(this.apiTokens[clientId] ?? null).pipe(delay(MockClientsApiService.SIMULATED_LATENCY_MS));
  }

  override regenerateApiToken(clientId: UUID, payload: CreateApiTokenPayload): Observable<CreateApiTokenResult> {
    const token: ApiTokenItem = {
      id: crypto.randomUUID(),
      name: payload.name,
      scopes: payload.scopes,
      lastUsedAt: null,
      createdAt: new Date().toISOString(),
    };
    // Remplace directement l'ancien jeton — c'est le backend qui, en réel,
    // révoque l'ancien avant d'émettre le nouveau, dans la même transaction.
    this.apiTokens[clientId] = token;
    const rawToken = `das_${crypto.randomUUID().replace(/-/g, '')}`;
    return of({ token, rawToken }).pipe(delay(MockClientsApiService.SIMULATED_LATENCY_MS));
  }

  override revokeApiToken(clientId: UUID): Observable<void> {
    this.apiTokens[clientId] = null;
    return of(undefined).pipe(delay(300));
  }

  private generatePassword(): string {
    return Math.random().toString(36).slice(-10);
  }
}
