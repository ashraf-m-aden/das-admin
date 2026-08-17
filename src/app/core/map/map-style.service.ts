import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, shareReplay } from 'rxjs';
import type { StyleSpecification, VectorSourceSpecification } from 'maplibre-gl';
import { AppConfigService } from '../config/app-config.service';

/** Sources tuiles scopables par client (multi-tenant). */
const TENANT_SCOPED_SOURCES = ['blocs', 'adresses'] as const;

@Injectable({ providedIn: 'root' })
export class MapStyleService {
  private http = inject(HttpClient);
  private config = inject(AppConfigService);

  private style$?: Observable<StyleSpecification>;

  getStyle(): Observable<StyleSpecification> {
    if (!this.style$) {
      this.style$ = this.http
        .get<string>('assets/map-style.json', { responseType: 'text' as 'json' })
        .pipe(
          map((raw) => {
            const tilesBaseUrl = this.config.get('mapTileUrl') || '';
            const resolved = (raw as unknown as string).replaceAll('__TILES_BASE_URL__', tilesBaseUrl);
            return JSON.parse(resolved) as StyleSpecification;
          }),
          shareReplay(1),
        );
    }
    return this.style$;
  }

  /**
   * Style dérivé pour un client commercial : chaque source scopable reçoit
   * un `client_id` que le backend/Martin utilise pour restreindre les tuiles.
   * Remplace l'ancien reroutage `das_ilots` (source supprimée).
   */
  getClientStyle(clientId: string): Observable<StyleSpecification> {
    return this.getStyle().pipe(
      map((style) => {
        const cloned = structuredClone(style);
        for (const name of TENANT_SCOPED_SOURCES) {
          const source = cloned.sources[name] as VectorSourceSpecification | undefined;
          if (source?.tiles) {
            source.tiles = source.tiles.map((tile) =>
              tile.includes('?')
                ? `${tile}&client_id=${encodeURIComponent(clientId)}`
                : `${tile}?client_id=${encodeURIComponent(clientId)}`,
            );
          }
        }
        return cloned;
      }),
    );
  }
}
