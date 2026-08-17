import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, shareReplay } from 'rxjs';
import type { StyleSpecification, VectorSourceSpecification } from 'maplibre-gl';
import { AppConfigService } from '../config/app-config.service';

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

getClientStyle(clientId: string): Observable<StyleSpecification> {
  return this.getStyle().pipe(
    map((style) => {
      const cloned = structuredClone(style);
      const source = cloned.sources['das_ilots'] as VectorSourceSpecification | undefined;
      if (source) {
        source.tiles = [
          `${this.config.get('mapTileUrl')}/das_ilots/{z}/{x}/{y}?client_id=${clientId}`,
        ];
      }
      return cloned;
    }),
  );
}
}
