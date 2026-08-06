import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { DashboardApiPort } from './dashboard-api.port';
import { DashboardSummary } from '../models/dashboard.models';

/**
 * Données factices cohérentes avec le domaine (quartiers de Djibouti-ville
 * et de Balbala, types d'alertes réels : reprise en retard, tâche en
 * retard, bloc bloqué). Permet de développer tout l'écran sans backend.
 */
@Injectable({ providedIn: 'root' })
export class MockDashboardApiService extends DashboardApiPort {
  private static readonly SIMULATED_LATENCY_MS = 500;

  override getSummary(): Observable<DashboardSummary> {
    const summary: DashboardSummary = {
      totalProperties: 4218,
      pendingReview: 137,
      approvedRecords: 3806,
      activeStaff: 24,
      zoneProgress: [
        { zoneId: 'zone-q7', zoneName: 'Boulaos — Arr. 2 — Q7', approvedCount: 812, totalCount: 950 },
        { zoneId: 'zone-q3', zoneName: 'Balbala — Q3', approvedCount: 340, totalCount: 900 },
        { zoneId: 'zone-rasdika', zoneName: 'Ras Dika', approvedCount: 615, totalCount: 640 },
        { zoneId: 'zone-einguela', zoneName: 'Einguela', approvedCount: 128, totalCount: 500 },
      ],
      urgentAlerts: [
        {
          id: 'alert-0001',
          type: 'redo_overdue',
          severity: 'high',
          messageKey: 'alerts.redo_overdue',
          messageParams: { code: 'DJ-BOU-ARR2-Q7-B012-A-045' },
          relatedEntityId: 'redo-0001',
          createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 'alert-0002',
          type: 'task_overdue',
          severity: 'medium',
          messageKey: 'alerts.task_overdue',
          messageParams: { code: 'BLK-Q3-014' },
          relatedEntityId: 'task-0002',
          createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 'alert-0003',
          type: 'block_stalled',
          severity: 'medium',
          messageKey: 'alerts.block_stalled',
          messageParams: { code: 'BLK-EIN-007' },
          relatedEntityId: 'block-0003',
          createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
    };

    return of(summary).pipe(delay(MockDashboardApiService.SIMULATED_LATENCY_MS));
  }
}
