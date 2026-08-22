import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { ReportsApiPort } from './reports-api.port';
import { ReportExportFormat, ReportsData } from '../models/reports.models';
import { GeoJSONMultiPolygon } from '../../models/das.models';
function box(minLng: number, minLat: number, maxLng: number, maxLat: number): GeoJSONMultiPolygon {
  return { type: 'MultiPolygon', coordinates: [[[
    [minLng, minLat], [maxLng, minLat], [maxLng, maxLat], [minLng, maxLat], [minLng, minLat],
  ]]] };
}
const MONTHS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
// Les 6 derniers mois relatifs à aujourd'hui, plutôt que des libellés figés.
function lastSixMonthLabels(): string[] {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return MONTHS_FR[d.getMonth()];
  });
}
@Injectable({ providedIn: 'root' })
export class MockReportsApiService extends ReportsApiPort {
  private data(): ReportsData {
    const [m0, m1, m2, m3, m4, m5] = lastSixMonthLabels();
    return {
      kpis: {
        coverageRate: 92.4, coverageDelta: 3.2,
        accuracyScore: 96.7, accuracyDelta: 2.1,
        verificationSla: 94.1, slaDelta: 4.7,
        avgTurnaroundDays: 2.4,
      },
      regionShapes: [
        { region: 'Obock', completionPct: 78.6, geom: box(43.0, 11.9, 43.6, 12.4) },
        { region: 'Tadjourah', completionPct: 84.7, geom: box(42.2, 11.7, 43.0, 12.4) },
        { region: 'Dikhil', completionPct: 88.3, geom: box(41.8, 11.0, 42.8, 11.7) },
        { region: 'Arta', completionPct: 92.1, geom: box(42.6, 11.3, 43.2, 11.7) },
        { region: 'Djibouti', completionPct: 96.5, geom: box(43.0, 11.5, 43.4, 11.8) },
      ],
      growth: [
        { label: m0, total: 130, verified: 60 },
        { label: m1, total: 180, verified: 110 },
        { label: m2, total: 230, verified: 150 },
        { label: m3, total: 255, verified: 190 },
        { label: m4, total: 290, verified: 240 },
        { label: m5, total: 312, verified: 294 },
      ],
      regional: [
        { region: 'Djibouti', completionPct: 96.5 },
        { region: 'Arta', completionPct: 92.1 },
        { region: 'Dikhil', completionPct: 88.3 },
        { region: 'Tadjourah', completionPct: 84.7 },
        { region: 'Obock', completionPct: 78.6 },
      ],
      turnaround: [
        { label: m0, days: 4.0 }, { label: m1, days: 3.2 }, { label: m2, days: 3.4 },
        { label: m3, days: 2.6 }, { label: m4, days: 2.3 }, { label: m5, days: 2.6 },
      ],
      totalAddresses: 312458,
      verifiedAddresses: 294341,
    };
  }

  override load(): Observable<ReportsData> {
    return of(this.data()).pipe(delay(420));
  }

  override exportReport(_format: ReportExportFormat): Observable<void> {
    return of(void 0).pipe(delay(500));
  }

  override generateReport(): Observable<void> {
    return of(void 0).pipe(delay(700));
  }
}
