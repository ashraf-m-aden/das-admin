import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { DashboardApiPort } from './dashboard-api.port';
import { DashboardSummary } from '../models/dashboard.models';

@Injectable({ providedIn: 'root' })
export class MockDashboardApiService extends DashboardApiPort {
  private static readonly LATENCY = 420;

  override getSummary(): Observable<DashboardSummary> {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const summary: DashboardSummary = {
      kpis: {
        totalProperties: 312458, totalPropertiesDelta: { value: 2.8, direction: 'up' },
        verifiedAddresses: 248193, verifiedPct: 79.5,
        pendingVerification: 41726, pendingPct: 13.4,
        activeFieldTeams: 36, teamsInField: 12,
        newPostcodes: 128, newPostcodesDelta: { value: 15, direction: 'up' },
        dataQualityAlerts: 78,
      },
      workflow: [
        { stage: 'registered', count: 312458, percent: 100 },
        { stage: 'surveyed', count: 268947, percent: 86.1 },
        { stage: 'verified', count: 248193, percent: 79.5 },
        { stage: 'approved', count: 236875, percent: 75.8 },
        { stage: 'published', count: 229341, percent: 73.4 },
      ],
      hierarchy: [
        { levelKey: 'region', count: 5 },
        { levelKey: 'ville', count: 12 },
        { levelKey: 'commune', count: 25 },
        { levelKey: 'quartier', count: 133 },
        { levelKey: 'bloc', count: 542 },
        { levelKey: 'rue', count: 2842 },
        { levelKey: 'parcelle', count: 312458 },
      ],
      registrationsTrend: [
        { label: 'Déc', value: 10 }, { label: 'Jan', value: 16 }, { label: 'Fév', value: 24 },
        { label: 'Mar', value: 26 }, { label: 'Avr', value: 31 }, { label: 'Mai', value: 32 },
      ],
      verification: { verified: 248193, pending: 41726, unverified: 22539 },
      mapPoints: Array.from({ length: 40 }, (_, i) => {
        const stages: any = ['registered', 'surveyed', 'verified', 'approved', 'published'];
        return {
          id: `mp-${i}`,
          location: { type: 'Point', coordinates: [43.128 + (i % 8) * 0.006, 11.585 + Math.floor(i / 8) * 0.006] },
          stage: stages[i % 5],
        };
      }),
      recentActivity: [
        { id: 'a1', kind: 'batch_approved', titleKey: 'dashboard.activity.batchApproved.title', descriptionKey: 'dashboard.activity.batchApproved.desc', params: { code: 'B-2025-0522-001' }, at: new Date(now - 0.4 * day).toISOString() },
        { id: 'a2', kind: 'postcode_created', titleKey: 'dashboard.activity.postcodeCreated.title', descriptionKey: 'dashboard.activity.postcodeCreated.desc', params: { code: 'PC 1006', area: 'Héron Bay' }, at: new Date(now - 0.5 * day).toISOString() },
        { id: 'a3', kind: 'survey_uploaded', titleKey: 'dashboard.activity.surveyUploaded.title', descriptionKey: 'dashboard.activity.surveyUploaded.desc', params: { team: 'Team Alpha 3', count: 152 }, at: new Date(now - 0.6 * day).toISOString() },
        { id: 'a4', kind: 'duplicate_flagged', titleKey: 'dashboard.activity.duplicateFlagged.title', descriptionKey: 'dashboard.activity.duplicateFlagged.desc', params: { location: 'Rue 12, Balbala' }, at: new Date(now - 1 * day).toISOString() },
        { id: 'a5', kind: 'published', titleKey: 'dashboard.activity.published.title', descriptionKey: 'dashboard.activity.published.desc', params: { count: 1245 }, at: new Date(now - 1 * day).toISOString() },
      ],
    };
    return of(summary).pipe(delay(MockDashboardApiService.LATENCY));
  }
}
