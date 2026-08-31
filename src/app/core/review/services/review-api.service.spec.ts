import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ReviewApiService } from './review-api.service';
import { AppConfigService } from '../../config/app-config.service';

const BASE = 'http://test-api/api';

/**
 * Verrouille le correctif du 2026-08-31 sur la validation d'un relevé.
 *
 * Le front postait un corps VIDE sur `/validate`. Côté back, `ValidateSurveyBody` est un record
 * positionnel dont le paramètre `ValidationType` est un enum ayant `Definitive` pour premier
 * membre : `{}` se désérialise donc en `Definitive` (valeur 0), et `Enum.IsDefined` l'accepte.
 * Chaque validation — y compris la validation groupée — **figeait le `addressCode`** de la
 * parcelle et la sortait des campagnes suivantes, sans que personne ne l'ait demandé.
 *
 * Ces tests portent sur le CORPS ENVOYÉ, pas sur la réponse : c'est un octet de payload qui a
 * le pouvoir de rendre une donnée nationale irréversible, et rien dans une réponse `200` ne le
 * signale. Une régression ici serait de nouveau silencieuse.
 */
describe('ReviewApiService — validateSurvey', () => {
  let service: ReviewApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AppConfigService, useValue: { get: (key: string) => (key === 'apiBaseUrl' ? BASE : '') } },
      ],
    });
    service = TestBed.inject(ReviewApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('envoie Temporary tel quel, et jamais un corps vide', () => {
    service.validateSurvey('survey-1', 'Temporary').subscribe();

    const req = httpMock.expectOne(`${BASE}/surveys/survey-1/validate`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ validationType: 'Temporary' });
    req.flush({});
  });

  /**
   * `Definitive` doit partir quand — et seulement quand — l'appelant l'a demandé. Le tester
   * explicitement évite le correctif inverse : replier tout sur `Temporary` « par sécurité »
   * priverait le superviseur de la seule issue qui fige un code, sans que rien ne le signale.
   */
  it('envoie Definitive lorsque cette issue est demandée', () => {
    service.validateSurvey('survey-2', 'Definitive').subscribe();

    const req = httpMock.expectOne(`${BASE}/surveys/survey-2/validate`);
    expect(req.request.body).toEqual({ validationType: 'Definitive' });
    req.flush({});
  });
});
