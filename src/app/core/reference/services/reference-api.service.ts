import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay } from 'rxjs';
import { ReferenceApiPort } from './reference-api.port';
import { AppConfigService } from '../../config/app-config.service';
import { OccupationCatalogItem } from '../models/reference.models';

@Injectable({ providedIn: 'root' })
export class ReferenceApiService extends ReferenceApiPort {
  private http = inject(HttpClient);
  private config = inject(AppConfigService);
  private get baseUrl() { return this.config.get('apiBaseUrl'); }

  /** Catalogues seedés au démarrage, jamais modifiés en session : un seul appel par onglet suffit. */
  private typesOccupation$?: Observable<OccupationCatalogItem[]>;
  private etatsOccupation$?: Observable<OccupationCatalogItem[]>;

  override getTypesOccupation(): Observable<OccupationCatalogItem[]> {
    this.typesOccupation$ ??= this.http
      .get<OccupationCatalogItem[]>(`${this.baseUrl}/types-occupation`)
      .pipe(shareReplay(1));
    return this.typesOccupation$;
  }

  override getEtatsOccupation(): Observable<OccupationCatalogItem[]> {
    this.etatsOccupation$ ??= this.http
      .get<OccupationCatalogItem[]>(`${this.baseUrl}/etats-occupation`)
      .pipe(shareReplay(1));
    return this.etatsOccupation$;
  }
}
