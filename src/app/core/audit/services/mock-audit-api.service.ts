import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { AuditApiPort } from './audit-api.port';
import { AuditAction, AuditData, AuditFilters, AuditRow } from '../models/audit.models';

const ACTIONS: AuditAction[] = ['created', 'updated', 'approved', 'rejected', 'published', 'login'];
const ENTITIES = ['Address', 'Block', 'Postcode', 'Street', 'User'];
const ACTORS = ['Admin User', 'Fatouma A.', 'Ibrahim H.', 'Team North', 'Khadija M.'];

@Injectable({ providedIn: 'root' })
export class MockAuditApiService extends AuditApiPort {
  private rows: AuditRow[] = Array.from({ length: 60 }, (_, i) => ({
    id: `log-${i}`,
    action: ACTIONS[i % ACTIONS.length],
    entityType: ENTITIES[i % ENTITIES.length],
    entityLabel: ENTITIES[i % ENTITIES.length] === 'Address' ? `ADDR-${String(12345 + i).padStart(8, '0')}` : `${ENTITIES[i % ENTITIES.length]}-${100 + i}`,
    actor: ACTORS[i % ACTORS.length],
    at: new Date(Date.now() - i * 3600e3).toISOString(),
  }));

  override load(filters: AuditFilters): Observable<AuditData> {
    const s = filters.search.trim().toLowerCase();
    const filtered = this.rows.filter((r) => {
      if (filters.action && r.action !== filters.action) return false;
      if (s && !r.entityLabel.toLowerCase().includes(s) && !r.actor.toLowerCase().includes(s)) return false;
      return true;
    });
    return of({ rows: filtered.slice(0, 40), total: filtered.length }).pipe(delay(320));
  }
}
