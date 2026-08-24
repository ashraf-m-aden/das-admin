import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { BlocksApiPort } from './blocks-api.port';
import { Block, UpdateBlockPayload, UUID } from '../../models/das.models';
import { BlockListQuery } from '../models/blocks.models';

const QUARTIER_7 = 'deadd2cc-fefc-403b-af2a-b7fcb9b6769f';

@Injectable({ providedIn: 'root' })
export class MockBlocksApiService extends BlocksApiPort {
  private static readonly SIMULATED_LATENCY_MS = 350;

  private blocs: Block[] = [
    { id: 'bloc-0001', code: 'Q7-B01', name: 'Avenue Nasser', number: 1, quartierId: QUARTIER_7, closeId: 'close-0001', boundaryWkt: 'POLYGON((43.140 11.585, 43.146 11.585, 43.146 11.590, 43.140 11.590, 43.140 11.585))' },
    { id: 'bloc-0002', code: 'Q7-B02', name: null, number: 2, quartierId: QUARTIER_7, closeId: null, boundaryWkt: 'POLYGON((43.146 11.585, 43.152 11.585, 43.152 11.590, 43.146 11.590, 43.146 11.585))' },
    { id: 'bloc-0003', code: 'Q7-B03', name: null, number: null, quartierId: QUARTIER_7, closeId: null, boundaryWkt: 'POLYGON((43.140 11.590, 43.146 11.590, 43.146 11.595, 43.140 11.595, 43.140 11.590))' },
  ];

  override list(query: BlockListQuery): Observable<Block[]> {
    const items = query.quartierId ? this.blocs.filter((b) => b.quartierId === query.quartierId) : this.blocs;
    return of(items).pipe(delay(MockBlocksApiService.SIMULATED_LATENCY_MS));
  }

  override getById(id: UUID): Observable<Block> {
    const b = this.blocs.find((x) => x.id === id);
    if (!b) return throwError(() => ({ code: 'not_found', message: 'common.error' }));
    return of(b).pipe(delay(MockBlocksApiService.SIMULATED_LATENCY_MS));
  }

  override update(id: UUID, payload: UpdateBlockPayload): Observable<Block> {
    const existing = this.blocs.find((b) => b.id === id);
    if (!existing) return throwError(() => ({ code: 'not_found', message: 'common.error' }));
    const updated: Block = { ...existing, ...payload };
    this.blocs = this.blocs.map((b) => (b.id === id ? updated : b));
    return of(updated).pipe(delay(MockBlocksApiService.SIMULATED_LATENCY_MS));
  }
}
