import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { DataQualityApiPort } from './dataquality-api.port';
import { SuspiciousSurveysData } from '../models/dataquality.models';

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
          'Position GPS simulée signalée par l’appareil.',
          'Relevé effectué à 138 m de l’adresse (seuil : 100 m).',
        ],
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
        reasons: ['Remonté après la clôture, pendant la fenêtre de remontée.'],
      },
    ],
    pushedAfterCloseByAgent: [{ agentId: 'mock-surveyor-0002', agentFullName: 'Warsama Robleh', pushedAfterClose: 6 }],
  };

  override load(): Observable<SuspiciousSurveysData> {
    return of(this.data).pipe(delay(MockDataQualityApiService.SIMULATED_LATENCY_MS));
  }
}
