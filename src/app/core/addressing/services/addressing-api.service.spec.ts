import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { AddressingApiService } from './addressing-api.service';
import { AppConfigService } from '../../config/app-config.service';
import { Block } from '../../models/das.models';
import { BlockToName } from '../models/addressing.models';

const BASE = 'http://test-api/api';

const blocs: Block[] = [
  { id: 'bloc-1', code: 'BLK-1', name: null, number: 1, quartierId: 'q1', closeId: null, boundaryWkt: null },
  { id: 'bloc-2', code: 'BLK-2', name: null, number: 2, quartierId: 'q1', closeId: null, boundaryWkt: null },
];

/**
 * Verrouille le fix anti-doublon de cette session : un bloc avec une suggestion en attente ne
 * doit JAMAIS apparaître dans le nommage direct — il se traite exclusivement dans /verification.
 */
describe('AddressingApiService — listBlocksToName', () => {
  let service: AddressingApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AppConfigService, useValue: { get: (key: string) => (key === 'apiBaseUrl' ? BASE : '') } },
      ],
    });
    service = TestBed.inject(AddressingApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('exclut un bloc ayant une suggestion en attente', () => {
    let result: BlockToName[] | undefined;
    service.listBlocksToName({ search: '', onlyUnnamed: false }).subscribe((r) => (result = r));

    httpMock.expectOne(`${BASE}/blocs`).flush(blocs);
    httpMock.expectOne((r) => r.url === `${BASE}/blocs/suggestions`).flush([
      { id: 'sugg-1', blocId: 'bloc-1', suggestedName: 'Avenue Nasser', comment: null, proposedAtUtc: '2026-08-19T00:00:00Z' },
    ]);

    expect(result?.map((b) => b.id)).toEqual(['bloc-2']);
  });

  it('sans aucune suggestion en attente, tous les blocs demandés ressortent', () => {
    let result: BlockToName[] | undefined;
    service.listBlocksToName({ search: '', onlyUnnamed: false }).subscribe((r) => (result = r));

    httpMock.expectOne(`${BASE}/blocs`).flush(blocs);
    httpMock.expectOne((r) => r.url === `${BASE}/blocs/suggestions`).flush([]);

    expect(result?.map((b) => b.id)).toEqual(['bloc-1', 'bloc-2']);
  });

  it('setBlockName() envoie un PATCH sur /blocs/{id} avec le dossier complet', () => {
    service.setBlockName('bloc-1', { code: 'BLK-1', name: 'Avenue Nasser', number: 1, boundaryWkt: null }).subscribe();

    const req = httpMock.expectOne(`${BASE}/blocs/bloc-1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ code: 'BLK-1', name: 'Avenue Nasser', number: 1, boundaryWkt: null });
    req.flush({ id: 'bloc-1', code: 'BLK-1', name: 'Avenue Nasser', number: 1, quartierId: 'q1', closeId: null, boundaryWkt: null });
  });
});
