import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { AdresseApiService } from './adresse-api.service';
import { AppConfigService } from '../../config/app-config.service';

const BASE = 'http://test-api/api';

/**
 * Verrouille deux pièges de contrat déjà rencontrés (contrat-api-registry.md) : la casse
 * PascalCase de `stage` sur `/bulk`, et `list()` qui doit rester un POST, jamais un GET.
 */
describe('AdresseApiService', () => {
  let service: AdresseApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AppConfigService, useValue: { get: (key: string) => (key === 'apiBaseUrl' ? BASE : '') } },
      ],
    });
    service = TestBed.inject(AdresseApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('list() envoie un POST sur /search, jamais un GET', () => {
    service.list({ filters: { search: '', postcode: null, zone: null, region: null, status: null, team: null, cityId: null, communeId: null, zoneId: null, quartierId: null, blocId: null }, page: 1, pageSize: 10 })
      .subscribe();

    const req = httpMock.expectOne(`${BASE}/adresses/search`);
    expect(req.request.method).toBe('POST');
    req.flush({ items: [], total: 0, page: 1, pageSize: 10 });
  });

  it('bulkUpdate() envoie stage en PascalCase sur PATCH /bulk', () => {
    service.bulkUpdate({ ids: ['a', 'b'], stage: 'Approved' }).subscribe();

    const req = httpMock.expectOne(`${BASE}/adresses/bulk`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body.stage).toBe('Approved');
    req.flush(null);
  });

  it('summary() cible /adresses/summary', () => {
    service.summary().subscribe();
    httpMock.expectOne(`${BASE}/adresses/summary`).flush({ totalRecords: 0, pendingReview: 0, duplicatesFlagged: 0, publishedToday: 0 });
  });
});
