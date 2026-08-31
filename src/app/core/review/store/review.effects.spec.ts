import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { provideMockActions } from '@ngrx/effects/testing';
import { provideMockStore } from '@ngrx/store/testing';
import { Observable, of, throwError, firstValueFrom } from 'rxjs';
import { toArray, take } from 'rxjs/operators';
import { ReviewEffects } from './review.effects';
import { ReviewActions } from './review.actions';
import { ReviewApiPort } from '../services/review-api.port';
import { reviewFeatureKey } from './review.reducer';
import { initialReviewState, ReviewState } from './review.state';
import { AddressingApiPort } from '../../addressing/services/addressing-api.port';
import { ReferenceApiPort } from '../../reference/services/reference-api.port';
import { SurveyReviewItem } from '../models/review.models';
import { OccupationCatalogItem } from '../../reference/models/reference.models';
import { PendingBlockSuggestion, PendingStreetSuggestion } from '../../addressing/models/addressing.models';

const survey: SurveyReviewItem = {
  submissionType: 'property', id: 's1', adresseId: 'addr-1', agentId: 'agent-1',
  capturedAtUtc: '2026-08-19T10:00:00Z', outcome: 'Surveyed', notSurveyableReason: null,
  typeOccupationId: 'type-1', etatOccupationId: 'etat-1', name: null,
  floorCount: 1, apartmentCount: 0, shopCount: 0, wheelchairAccessible: false,
  gpsAccuracyM: 4, distanceFromAddressM: 2, photoCount: 3, isMockLocation: false,
  // Champs d'identité et de position ajoutés au contrat le 2026-08-28. Renseignés ici — et non
  // laissés à `null` — parce que la file de validation les affiche : un fixture qui les tait
  // laisserait passer une régression sur l'écran qu'il est censé couvrir.
  agentFullName: 'Warsama Robleh', adresseLibelle: '12, Rue Ayaan, Quartier 7 Djibouti',
  addressCode: '77-007-3-12', quartierNom: 'Quartier 7',
  gpsCaptureWkt: 'POINT(43.1462 11.5788)', adresseLocationWkt: 'POINT(43.1463 11.5789)',
};

const typeOccupationOptions: OccupationCatalogItem[] = [{ id: 'type-1', nom: 'Villa' }];
const etatOccupationOptions: OccupationCatalogItem[] = [{ id: 'etat-1', nom: 'Bon état' }];

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
  let referenceApi: ReferenceApiPort;

  function setup() {
    TestBed.configureTestingModule({
      providers: [
        ReviewEffects,
        provideMockActions(() => actions$),
        // `ReviewEffects` relit l'état depuis le 2026-08-31 (rechargement de la campagne
        // après une décision), il lui faut donc un Store même pour les effets qui l'ignorent.
        provideMockStore({ initialState: { [reviewFeatureKey]: initialReviewState } }),
        { provide: ReviewApiPort, useValue: reviewApi },
        { provide: AddressingApiPort, useValue: addressingApi },
        { provide: ReferenceApiPort, useValue: referenceApi },
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
    referenceApi = stubApi<ReferenceApiPort>(['getTypesOccupation', 'getEtatsOccupation']);
    vi.mocked(referenceApi.getTypesOccupation).mockReturnValue(of(typeOccupationOptions));
    vi.mocked(referenceApi.getEtatsOccupation).mockReturnValue(of(etatOccupationOptions));
  });

  it('fusionne les 3 sources (relevés + suggestions bloc + suggestions rue) en une seule file, avec les catalogues d\'occupation', async () => {
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
        typeOccupationOptions,
        etatOccupationOptions,
      }),
    ]);
  });

  it('émet loadQueueFailure si une des sources échoue', async () => {
    vi.mocked(reviewApi.listSubmittedSurveys).mockReturnValue(of([survey]));
    vi.mocked(addressingApi.listPendingBlockSuggestions).mockReturnValue(throwError(() => new Error('boom')));
    vi.mocked(addressingApi.listPendingStreetSuggestions).mockReturnValue(of([]));
    actions$ = of(ReviewActions.loadQueue());

    const effects = setup();
    const result = await firstValueFrom(effects.loadQueue$.pipe(take(1), toArray()));

    expect(result).toEqual([ReviewActions.loadQueueFailure({ errorMessageKey: 'common.error' })]);
  });
});

/**
 * Verrouille le rechargement de la liste de campagne après une décision.
 *
 * Sans lui, un relevé validé depuis le détail de campagne gardait sa pastille « Soumis » :
 * l'écran affirmait le contraire de ce qui venait d'être fait. Et la condition inverse compte
 * autant — une décision prise dans la file de vérification ne doit RIEN recharger, sinon chaque
 * validation déclenche un appel pour un écran que personne ne regarde.
 */
describe('ReviewEffects — reloadCampaignSurveysAfterDecision$', () => {
  let actions$: Observable<unknown>;

  function setup(campaignId: string | null) {
    const etat: ReviewState = { ...initialReviewState, campaignSurveysCampaignId: campaignId };
    TestBed.configureTestingModule({
      providers: [
        ReviewEffects,
        provideMockActions(() => actions$),
        provideMockStore({ initialState: { [reviewFeatureKey]: etat } }),
        { provide: ReviewApiPort, useValue: stubApi<ReviewApiPort>(['listCampaignSurveys']) },
        { provide: AddressingApiPort, useValue: stubApi<AddressingApiPort>([]) },
        { provide: ReferenceApiPort, useValue: stubApi<ReferenceApiPort>([]) },
      ],
    });
    return TestBed.inject(ReviewEffects);
  }

  afterEach(() => TestBed.resetTestingModule());

  it('recharge la campagne ouverte après une validation', async () => {
    actions$ = of(ReviewActions.validateSuccess({ id: 's1' }));
    const emis = await firstValueFrom(setup('camp-1').reloadCampaignSurveysAfterDecision$.pipe(take(1)));
    expect(emis).toEqual(ReviewActions.loadCampaignSurveys({ campaignId: 'camp-1' }));
  });

  it('recharge aussi après un rejet et après un renvoi en correction', async () => {
    actions$ = of(
      ReviewActions.rejectSuccess({ id: 's1' }),
      ReviewActions.requestCorrectionSuccess({ id: 's2' }),
    );
    const emis = await firstValueFrom(setup('camp-1').reloadCampaignSurveysAfterDecision$.pipe(toArray()));
    expect(emis).toHaveLength(2);
  });

  it("ne recharge rien quand l'écran de campagne est fermé", async () => {
    actions$ = of(ReviewActions.validateSuccess({ id: 's1' }));
    const emis = await firstValueFrom(setup(null).reloadCampaignSurveysAfterDecision$.pipe(toArray()));
    expect(emis).toEqual([]);
  });
});
