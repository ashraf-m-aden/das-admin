import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { DiscoveriesApiPort } from './discoveries-api.port';
import { UUID } from '../../models/das.models';
import { DiscoveryFeatureCollection, DiscoveryQuery, DiscoveryReport, DiscoveryStatus } from '../models/discoveries.models';

const LATENCY_MS = 340;

/** Même id de campagne que `MockFieldOpsApiService`, pour que le filtre par campagne ait du sens en mock. */
const CAMPAIGN_ID = 'camp-0001';
const REVIEWER_ID = 'user-gestionnaire-0001';

/** Forme d'erreur métier du mock : `{ code, message }` nu, sans enveloppe `.error` (cf. `core/http/error-code.ts`). */
const fail = (code: string, message: string): Observable<never> => throwError(() => ({ code, message }));

const hoursAgo = (h: number): string => new Date(Date.now() - h * 3600_000).toISOString();

@Injectable({ providedIn: 'root' })
export class MockDiscoveriesApiService extends DiscoveriesApiPort {
  private reports: DiscoveryReport[] = [
    {
      id: 'disc-0001', campaignId: CAMPAIGN_ID,
      agentId: 'mock-surveyor-0001', agentFullName: 'Ahmed Ali',
      blocId: 'bloc-0001', blocCode: 'Q7-B01',
      locationWkt: 'POINT(43.1382 11.5904)', gpsAccuracyM: 4.5,
      comment: 'Villa neuve entre les parcelles 12 et 14, pas sur le plan.',
      // Capture bien antérieure à la réception : la saisie s'est faite hors réseau.
      capturedAtUtc: hoursAgo(52), createdAtUtc: hoursAgo(6),
      status: 'Pending', reviewedByUserId: null, reviewedAtUtc: null, rejectionReason: null,
    },
    {
      id: 'disc-0002', campaignId: CAMPAIGN_ID,
      agentId: 'mock-surveyor-0002', agentFullName: 'Fatouma Hassan',
      // Signalement hors de tout bloc connu : `blocId` facultatif, seule la position fait foi.
      blocId: null, blocCode: null,
      locationWkt: 'POINT(43.1421 11.5938)', gpsAccuracyM: 18.2,
      comment: 'Deux bâtiments en tôle, occupés.',
      capturedAtUtc: hoursAgo(30), createdAtUtc: hoursAgo(29),
      status: 'Pending', reviewedByUserId: null, reviewedAtUtc: null, rejectionReason: null,
    },
    {
      id: 'disc-0003', campaignId: CAMPAIGN_ID,
      agentId: 'mock-surveyor-0001', agentFullName: 'Ahmed Ali',
      blocId: 'bloc-0002', blocCode: 'Q7-B02',
      locationWkt: 'POINT(43.1355 11.5871)', gpsAccuracyM: null,
      comment: null,
      capturedAtUtc: hoursAgo(96), createdAtUtc: hoursAgo(95),
      status: 'Accepted', reviewedByUserId: REVIEWER_ID, reviewedAtUtc: hoursAgo(70), rejectionReason: null,
    },
    {
      id: 'disc-0004', campaignId: CAMPAIGN_ID,
      agentId: 'mock-surveyor-0002', agentFullName: 'Fatouma Hassan',
      blocId: 'bloc-0003', blocCode: 'Q7-B03',
      locationWkt: 'POINT(43.1408 11.5852)', gpsAccuracyM: 7.1,
      comment: 'Maison au fond de la ruelle.',
      capturedAtUtc: hoursAgo(120), createdAtUtc: hoursAgo(119),
      status: 'Rejected', reviewedByUserId: REVIEWER_ID, reviewedAtUtc: hoursAgo(100),
      rejectionReason: 'Déjà au référentiel sous la parcelle 12345.',
    },
  ];

  override list(query: DiscoveryQuery): Observable<DiscoveryReport[]> {
    const items = this.reports
      .filter((r) => !query.campaignId || r.campaignId === query.campaignId)
      .filter((r) => !query.status || r.status === query.status);
    return of(items).pipe(delay(LATENCY_MS));
  }

  override accept(id: UUID): Observable<DiscoveryReport> {
    return this.review(id, 'Accepted', null);
  }

  override reject(id: UUID, rejectionReason: string): Observable<DiscoveryReport> {
    return this.review(id, 'Rejected', rejectionReason);
  }

  /**
   * Le back exporte par défaut les seuls signalements **retenus** : l'expert digitalise ce que le
   * Gestionnaire a trié, pas la file brute. Le mock reproduit ce défaut — sinon on croirait à
   * l'écran exporter tout ce qu'on voit.
   */
  override exportGeoJson(query: DiscoveryQuery): Observable<DiscoveryFeatureCollection> {
    const status = query.status ?? 'Accepted';
    const items = this.reports
      .filter((r) => !query.campaignId || r.campaignId === query.campaignId)
      .filter((r) => r.status === status);
    return of({
      type: 'FeatureCollection' as const,
      features: items.map((r) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: parsePoint(r.locationWkt) },
        properties: {
          id: r.id, agentFullName: r.agentFullName, blocCode: r.blocCode,
          gpsAccuracyM: r.gpsAccuracyM, comment: r.comment, capturedAtUtc: r.capturedAtUtc,
        },
      })),
    }).pipe(delay(LATENCY_MS));
  }

  /** Mêmes refus que `AcceptDiscoveryReportHandler` / `RejectDiscoveryReportHandler`, dans le même ordre. */
  private review(id: UUID, status: DiscoveryStatus, rejectionReason: string | null): Observable<DiscoveryReport> {
    const report = this.reports.find((r) => r.id === id);
    if (!report) return fail('DiscoveryReports.NotFound', 'Signalement introuvable.');
    if (report.status !== 'Pending') {
      return fail('DiscoveryReports.AlreadyReviewed', 'Ce signalement a déjà été traité.').pipe(delay(LATENCY_MS));
    }
    const updated: DiscoveryReport = {
      ...report, status, rejectionReason,
      reviewedByUserId: REVIEWER_ID, reviewedAtUtc: new Date().toISOString(),
    };
    this.reports = this.reports.map((r) => (r.id === id ? updated : r));
    return of(updated).pipe(delay(LATENCY_MS));
  }
}

function parsePoint(wkt: string): number[] {
  const nums = wkt.match(/-?\d+(?:\.\d+)?/g) ?? [];
  return [Number(nums[0] ?? 0), Number(nums[1] ?? 0)];
}
