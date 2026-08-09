import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { DashboardApiPort } from './dashboard-api.port';
import { DashboardSummary } from '../models/dashboard.models';

/**
 * Données factices cohérentes avec le domaine. Les totaux se recoupent :
 * la somme des blocs par statut = blocksTotal ; la somme des appels par
 * client = apiCalls30d. Permet de développer tout l'écran sans backend.
 */
@Injectable({ providedIn: 'root' })
export class MockDashboardApiService extends DashboardApiPort {
  private static readonly SIMULATED_LATENCY_MS = 500;

  override getSummary(): Observable<DashboardSummary> {
    const summary: DashboardSummary = {
      blocksTotal: 312,
      streetsRegistered: 1284,
      areaCoveredKm2: 42.6,
      addressesRegistered: 8940,

      activeClients: 5,
      trialClients: 1,
      apiCalls30d: 128420,

      blocksByStatus: [
        { status: 'approved', count: 198 },
        { status: 'in_progress', count: 47 },
        { status: 'not_assigned', count: 35 },
        { status: 'submitted', count: 23 },
        { status: 'needs_redo', count: 9 },
      ],

      weeklyCollections: [
        { weekLabel: 'S-11', count: 28 },
        { weekLabel: 'S-10', count: 34 },
        { weekLabel: 'S-9', count: 24 },
        { weekLabel: 'S-8', count: 42 },
        { weekLabel: 'S-7', count: 48 },
        { weekLabel: 'S-6', count: 40 },
        { weekLabel: 'S-5', count: 56 },
        { weekLabel: 'S-4', count: 52 },
        { weekLabel: 'S-3', count: 66 },
        { weekLabel: 'S-2', count: 60 },
        { weekLabel: 'S-1', count: 76 },
        { weekLabel: 'S-0', count: 84 },
      ],

      apiConsumptionByClient: [
        { clientId: 'client-lp', clientName: 'La Poste de Djibouti', initials: 'LP', calls: 96240, status: 'active' },
        { clientId: 'client-bi', clientName: 'Banque Indosuez', initials: 'BI', calls: 18400, status: 'active' },
        { clientId: 'client-mh', clientName: "Ministère de l'Habitat", initials: 'MH', calls: 9780, status: 'trial' },
        { clientId: 'client-da', clientName: 'Doraleh Terminal', initials: 'DA', calls: 4000, status: 'active' },
      ],

      zoneProgress: [
        { zoneId: 'zone-q7', zoneName: 'Boulaos — Arr. 2 — Q7', approvedCount: 812, totalCount: 950 },
        { zoneId: 'zone-rasdika', zoneName: 'Ras Dika', approvedCount: 615, totalCount: 640 },
        { zoneId: 'zone-q3', zoneName: 'Balbala — Q3', approvedCount: 340, totalCount: 900 },
        { zoneId: 'zone-einguela', zoneName: 'Einguela', approvedCount: 128, totalCount: 500 },
      ],

      totalProperties: 8940,
      pendingReview: 137,
      approvedRecords: 3806,
      activeStaff: 24,
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
      ],
    };

    return of(summary).pipe(delay(MockDashboardApiService.SIMULATED_LATENCY_MS));
  }
}
