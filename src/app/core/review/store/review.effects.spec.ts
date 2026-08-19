import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { provideMockActions } from '@ngrx/effects/testing';
import { Observable, of, throwError, firstValueFrom } from 'rxjs';
import { toArray, take } from 'rxjs/operators';
import { ReviewEffects } from './review.effects';
import { ReviewActions } from './review.actions';
import { ReviewApiPort } from '../services/review-api.port';
import { AddressingApiPort } from '../../addressing/services/addressing-api.port';
import { SurveyReviewItem } from '../models/review.models';
import { PendingBlockSuggestion, PendingStreetSuggestion } from '../../addressing/models/addressing.models';

const survey: SurveyReviewItem = {
  submissionType: 'property', id: 's1', adresseId: 'addr-1', agentId: 'agent-1',
  capturedAtUtc: '2026-08-19T10:00:00Z', outcome: 'Surveyed', notSurveyableReason: null,
  gpsAccuracyM: 4, distanceFromAddressM: 2, photoCount: 3, isMockLocation: false,
};

const blocSuggestion: PendingBlockSuggestion = {
  id: 'bs1', blocId: 'bloc-1', suggestedName: 'Avenue Nasser', comment: null, proposedAtUtc: '2026-08-19T09:00:00Z',
};

const streetSuggestion: PendingStreetSuggestion = {
  id: 'ss1', streetId: 'street-1', suggestedName: 'Rue du Marché', comment: null, proposedAtUtc: '2026-08-19T08:00:00Z',
};

function stubApi<T extends object>(methods: (keyof T)[]): T {
  return Object.fromEntries(methods.map((m) => [m, vi.fn()])) as T;
}

describe('ReviewEffects — loadQueue$', () => {
  let actions$: Observable<unknown>;
  let reviewApi: ReviewApiPort;
  let addressingApi: AddressingApiPort;

  function setup() {
    TestBed.configureTestingModule({
      providers: [
        ReviewEffects,
        provideMockActions(() => actions$),
        { provide: ReviewApiPort, useValue: reviewApi },
        { provide: AddressingApiPort, useValue: addressingApi },
      ],
    });
    return TestBed.inject(ReviewEffects);
  }

  beforeEach(() => {
    reviewApi = stubApi<ReviewApiPort>(['listSubmittedSurveys', 'validateSurvey', 'rejectSurvey', 'requestSurveyCorrection', 'getSurveyPhotos']);
    addressingApi = stubApi<AddressingApiPort>([
      'listPendingBlockSuggestions', 'listPendingStreetSuggestions',
      'approveBlockSuggestion', 'rejectBlockSuggestion', 'approveStreetSuggestion', 'rejectStreetSuggestion',
      'listBlocksToName', 'setBlockName', 'listStreetsToName', 'setStreetName',
      'listPropertiesToNumber', 'assignHouseNumber',
    ]);
  });

  it('fusionne les 3 sources (relevés + suggestions bloc + suggestions rue) en une seule file', async () => {
    vi.mocked(reviewApi.listSubmittedSurveys).mockReturnValue(of([survey]));
    vi.mocked(addressingApi.listPendingBlockSuggestions).mockReturnValue(of([blocSuggestion]));
    vi.mocked(addressingApi.listPendingStreetSuggestions).mockReturnValue(of([streetSuggestion]));
    actions$ = of(ReviewActions.loadQueue());

    const effects = setup();
    const result = await firstValueFrom(effects.loadQueue$.pipe(take(1), toArray()));

    expect(result).toEqual([
      ReviewActions.loadQueueSuccess({
        items: [
          survey,
          { submissionType: 'block', id: 'bs1', targetId: 'bloc-1', suggestedName: 'Avenue Nasser', comment: null, proposedAtUtc: '2026-08-19T09:00:00Z' },
          { submissionType: 'street', id: 'ss1', targetId: 'street-1', suggestedName: 'Rue du Marché', comment: null, proposedAtUtc: '2026-08-19T08:00:00Z' },
        ],
      }),
    ]);
  });

  it('émet loadQueueFailure si une des trois sources échoue', async () => {
    vi.mocked(reviewApi.listSubmittedSurveys).mockReturnValue(of([survey]));
    vi.mocked(addressingApi.listPendingBlockSuggestions).mockReturnValue(throwError(() => new Error('boom')));
    vi.mocked(addressingApi.listPendingStreetSuggestions).mockReturnValue(of([]));
    actions$ = of(ReviewActions.loadQueue());

    const effects = setup();
    const result = await firstValueFrom(effects.loadQueue$.pipe(take(1), toArray()));

    expect(result).toEqual([ReviewActions.loadQueueFailure({ errorMessageKey: 'common.error' })]);
  });
});
