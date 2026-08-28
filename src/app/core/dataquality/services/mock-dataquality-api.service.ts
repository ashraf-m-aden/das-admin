import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { DataQualityApiPort } from './dataquality-api.port';
import { SuspiciousSurveysData } from '../models/dataquality.models';
import { UUID } from '../../models/das.models';

@Injectable({ providedIn: 'root' })
export class MockDataQualityApiService extends DataQualityApiPort {
  private static readonly SIMULATED_LATENCY_MS = 400;

  private data: SuspiciousSurveysData = {
    surveys: [
      {
        // Même relevé que `survey-0002` du module review (mêmes GPS/photos) : adresse et agent doivent coïncider.
        id: 'survey-0002',
        adresseId: 'addr-12351',
        agentId: 'mock-surveyor-0001',
        outcome: 'Surveyed',
        notSurveyableReason: null,
        capturedAtUtc: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        distanceFromAddressM: 138,
        gpsAccuracyM: 18.7,
        isMockLocation: true,
        photoCount: 1,
        reasons: [
          { code: 'mock_location', args: {} },
          { code: 'too_far', args: { distance: 138, threshold: 100 } },
        ],
        agentFullName: 'Warsama Robleh',
        adresseLibelle: '4, close 3, Balbala Ancien Djibouti',
        quartierNom: 'Balbala Ancien',
        suspicionDismissedAtUtc: null,
        suspicionDismissReason: null,
      },
      {
        id: 'survey-0009',
        adresseId: 'addr-12366',
        agentId: 'mock-surveyor-0002',
        outcome: 'Surveyed',
        notSurveyableReason: null,
        capturedAtUtc: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        distanceFromAddressM: 12,
        gpsAccuracyM: 5.1,
        isMockLocation: false,
        photoCount: 2,
        reasons: [{ code: 'pushed_after_close', args: {} }],
        agentFullName: 'Warsama Robleh',
        adresseLibelle: '9, bloc 5, PK12 Djibouti',
        quartierNom: 'PK12',
        suspicionDismissedAtUtc: null,
        suspicionDismissReason: null,
      },
    ],
    pushedAfterCloseByAgent: [{ agentId: 'mock-surveyor-0002', agentFullName: 'Warsama Robleh', pushedAfterClose: 6 }],
    suspiciousDistanceM: 100,
  };

  override dismissSuspicion(surveyId: UUID, reason: string): Observable<void> {
    const survey = this.data.surveys.find((s) => s.id === surveyId);
    if (survey) {
      survey.suspicionDismissedAtUtc = new Date().toISOString();
      survey.suspicionDismissReason = reason;
    }
    return of(undefined).pipe(delay(MockDataQualityApiService.SIMULATED_LATENCY_MS));
  }

  override load(includeDismissed: boolean): Observable<SuspiciousSurveysData> {
    // Le filtre est APPLIQUÉ, comme côté back : sans cela, écarter un relevé en mock ne le
    // ferait pas sortir de la liste et la fonctionnalité paraîtrait cassée.
    const surveys = includeDismissed
      ? this.data.surveys
      : this.data.surveys.filter((s) => s.suspicionDismissedAtUtc === null);
    return of({ ...this.data, surveys }).pipe(delay(MockDataQualityApiService.SIMULATED_LATENCY_MS));
  }
}
