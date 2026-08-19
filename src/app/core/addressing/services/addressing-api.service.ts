import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map } from 'rxjs';
import { AddressingApiPort } from './addressing-api.port';
import { AppConfigService } from '../../config/app-config.service';
import { Block, UUID, UpdateBlockPayload } from '../../models/das.models';
import {
  AssignHouseNumberPayload,
  BlockNamingQuery,
  BlockToName,
  PendingBlockSuggestion,
  PendingStreetSuggestion,
  PropertyNumberingQuery,
  PropertyToNumber,
  StreetNamingQuery,
  StreetToName,
  StreetType,
  UpdateStreetNamePayload,
} from '../models/addressing.models';

interface RawStreet {
  id: UUID;
  code: string;
  name: string | null;
  type: StreetType;
  boundaryWkt: string | null;
}

/**
 * Implémentation réelle. Ni `GET /blocs?onlyUnnamed=&search=` ni `POST /blocs/{id}/name`
 * n'existent côté back : `GET /api/blocs` ne prend que `quartierId`, et le nommage direct passe
 * par `PATCH /api/blocs/{id}` (dossier complet), le même endpoint que la fiche bloc. Le tri
 * « à nommer » se fait donc ici, côté front, à partir de deux appels : `GET /api/blocs` +
 * `GET /api/blocs/suggestions?status=Pending` — ce second appel sert uniquement à EXCLURE les
 * blocs déjà en attente d'une décision (ils se traitent dans `/verification`, pas ici : pas de
 * doublon des deux mêmes boutons approuver/rejeter sur deux écrans). Idem pour les rues.
 */
@Injectable({ providedIn: 'root' })
export class AddressingApiService extends AddressingApiPort {
  private http = inject(HttpClient);
  private config = inject(AppConfigService);

  private get baseUrl(): string {
    return this.config.get('apiBaseUrl');
  }

  override listBlocksToName(query: BlockNamingQuery): Observable<BlockToName[]> {
    return forkJoin({
      blocs: this.http.get<Block[]>(`${this.baseUrl}/blocs`),
      suggestions: this.http.get<PendingBlockSuggestion[]>(`${this.baseUrl}/blocs/suggestions`, { params: { status: 'Pending' } }),
    }).pipe(map(({ blocs, suggestions }) => {
      const pendingBlocIds = new Set(suggestions.map((s) => s.blocId));
      const search = query.search.trim().toLowerCase();
      return blocs
        .filter((b) => !pendingBlocIds.has(b.id))
        .filter((b) => !query.onlyUnnamed || !b.name)
        .filter((b) => !search || b.code.toLowerCase().includes(search) || (b.name ?? '').toLowerCase().includes(search))
        .map((b): BlockToName => ({ id: b.id, code: b.code, name: b.name, number: b.number, boundaryWkt: b.boundaryWkt }));
    }));
  }

  override setBlockName(id: UUID, payload: UpdateBlockPayload): Observable<BlockToName> {
    return this.http.patch<Block>(`${this.baseUrl}/blocs/${id}`, payload).pipe(
      map((b): BlockToName => ({ id: b.id, code: b.code, name: b.name, number: b.number, boundaryWkt: b.boundaryWkt })),
    );
  }

  override approveBlockSuggestion(suggestionId: UUID): Observable<void> {
    return this.http.post(`${this.baseUrl}/blocs/suggestions/${suggestionId}/approve`, {}).pipe(map(() => undefined));
  }

  override rejectBlockSuggestion(suggestionId: UUID, rejectionReason: string): Observable<void> {
    return this.http
      .post(`${this.baseUrl}/blocs/suggestions/${suggestionId}/reject`, { rejectionReason })
      .pipe(map(() => undefined));
  }

  override listPendingBlockSuggestions(): Observable<PendingBlockSuggestion[]> {
    return this.http.get<PendingBlockSuggestion[]>(`${this.baseUrl}/blocs/suggestions`, { params: { status: 'Pending' } });
  }

  override listStreetsToName(query: StreetNamingQuery): Observable<StreetToName[]> {
    return forkJoin({
      streets: this.http.get<RawStreet[]>(`${this.baseUrl}/streets`),
      suggestions: this.http.get<PendingStreetSuggestion[]>(`${this.baseUrl}/streets/suggestions`, { params: { status: 'Pending' } }),
    }).pipe(map(({ streets, suggestions }) => {
      const pendingStreetIds = new Set(suggestions.map((s) => s.streetId));
      const search = query.search.trim().toLowerCase();
      return streets
        .filter((s) => !pendingStreetIds.has(s.id))
        .filter((s) => !query.onlyUnnamed || !s.name)
        .filter((s) => !search || s.code.toLowerCase().includes(search) || (s.name ?? '').toLowerCase().includes(search));
    }));
  }

  override setStreetName(id: UUID, payload: UpdateStreetNamePayload): Observable<StreetToName> {
    return this.http.patch<RawStreet>(`${this.baseUrl}/streets/${id}`, payload);
  }

  override approveStreetSuggestion(suggestionId: UUID): Observable<void> {
    return this.http.post(`${this.baseUrl}/streets/suggestions/${suggestionId}/approve`, {}).pipe(map(() => undefined));
  }

  override rejectStreetSuggestion(suggestionId: UUID, rejectionReason: string): Observable<void> {
    return this.http
      .post(`${this.baseUrl}/streets/suggestions/${suggestionId}/reject`, { rejectionReason })
      .pipe(map(() => undefined));
  }

  override listPendingStreetSuggestions(): Observable<PendingStreetSuggestion[]> {
    return this.http.get<PendingStreetSuggestion[]>(`${this.baseUrl}/streets/suggestions`, { params: { status: 'Pending' } });
  }

  /**
   * Bloqué par le modèle : `Adresse.Numero` est obligatoire à la création, une parcelle sans
   * numéro n'est pas représentable côté back. Ces deux routes n'ont aucune contrepartie
   * (guide d'intégration §6) — laissées telles quelles en attendant l'arbitrage du responsable
   * projet, pas un bug à corriger ici.
   */
  override listPropertiesToNumber(query: PropertyNumberingQuery): Observable<PropertyToNumber[]> {
    const params: Record<string, string> = {};
    if (query.blockId) params['blockId'] = query.blockId;
    return this.http.get<PropertyToNumber[]>(`${this.baseUrl}/addressing/properties-to-number`, { params });
  }

  override assignHouseNumber(id: UUID, payload: AssignHouseNumberPayload): Observable<PropertyToNumber> {
    return this.http.patch<PropertyToNumber>(`${this.baseUrl}/addressing/properties/${id}/house-number`, payload);
  }
}
