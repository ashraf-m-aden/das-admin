import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DiscoveriesApiPort } from './discoveries-api.port';
import { AppConfigService } from '../../config/app-config.service';
import { UUID } from '../../models/das.models';
import { DiscoveryFeatureCollection, DiscoveryQuery, DiscoveryReport } from '../models/discoveries.models';

@Injectable({ providedIn: 'root' })
export class DiscoveriesApiService extends DiscoveriesApiPort {
  private http = inject(HttpClient);
  private config = inject(AppConfigService);

  private get baseUrl(): string { return `${this.config.get('apiBaseUrl')}/discoveries`; }

  /**
   * `status` part en **chaîne PascalCase** (`"Pending"`), jamais en nombre : le back attend
   * l'enum sérialisé, en query comme en corps (CLAUDE.md §6). Un paramètre absent vaut « tous »,
   * donc on n'envoie pas la clé plutôt que d'envoyer une chaîne vide.
   */
  private toParams(query: DiscoveryQuery): Record<string, string> {
    const params: Record<string, string> = {};
    if (query.campaignId) params['campaignId'] = query.campaignId;
    if (query.status) params['status'] = query.status;
    return params;
  }

  override list(query: DiscoveryQuery): Observable<DiscoveryReport[]> {
    return this.http.get<DiscoveryReport[]>(this.baseUrl, { params: this.toParams(query) });
  }

  override accept(id: UUID): Observable<DiscoveryReport> {
    return this.http.post<DiscoveryReport>(`${this.baseUrl}/${id}/accept`, {});
  }

  override reject(id: UUID, rejectionReason: string): Observable<DiscoveryReport> {
    return this.http.post<DiscoveryReport>(`${this.baseUrl}/${id}/reject`, { rejectionReason });
  }

  /** Le point est dans le chemin (`export.geojson`), pas une extension à ajouter — ne pas « nettoyer » l'URL. */
  override exportGeoJson(query: DiscoveryQuery): Observable<DiscoveryFeatureCollection> {
    return this.http.get<DiscoveryFeatureCollection>(`${this.baseUrl}/export.geojson`, { params: this.toParams(query) });
  }
}
