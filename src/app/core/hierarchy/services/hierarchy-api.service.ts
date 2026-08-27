import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { HierarchyApiPort } from './hierarchy-api.port';
import { AppConfigService } from '../../config/app-config.service';
import { UUID } from '../../models/das.models';
import { HierarchyNode } from '../models/hierarchy.models';
import { wktBounds } from '../../ui/map/wkt.util';

/**
 * Réponses BRUTES du back, telles qu'elles arrivent. Elles ne sont PAS des `HierarchyNode` :
 * aucune ne porte `level`, `parentId` ni `bbox`, et `Quartier` nomme son libellé **`nom`** là où
 * les trois autres disent `name` (nommage mixte assumé, CLAUDE.md §6). Les caster directement
 * compilait sans broncher — TypeScript ne vérifie rien d'une réponse HTTP — et rendait un select
 * de quartiers aux libellés vides, ainsi qu'un `fitBounds` de cascade sans effet à tous les
 * niveaux (le `bbox` attendu n'a jamais existé, la réponse porte un `boundaryWkt`).
 */
interface RawCityNode { id: string; name: string; boundaryWkt: string | null; }
interface RawCommuneNode { id: string; name: string; code: string; cityId: string; boundaryWkt: string | null; }
interface RawZoneNode { id: string; name: string; code: string; communeId: string; boundaryWkt: string | null; }
interface RawQuartierNode {
  id: string; nom: string; code: string;
  cityId: string; communeId: string | null; zoneId: string | null; boundaryWkt: string | null;
}

/** Projection HIÉRARCHIE de `CloseResponse` — on ne garde que de quoi peupler un select et cadrer. */
interface RawCloseNode {
  id: string; code: string; label: string; quartierId: string; boundaryWkt: string | null;
}

/** Projection HIÉRARCHIE de `BlocResponse`. `closeId` sert au filtrage front (pas de `?closeId=` côté back). */
interface RawBlocNode {
  id: string; code: string; name: string | null; quartierId: string; closeId: string | null;
}

/** Le back rend une géométrie WKT ; la cascade cadre sur une bbox. `undefined` = pas d'emprise. */
function toBbox(wkt: string | null): HierarchyNode['bbox'] {
  return wkt ? (wktBounds(wkt) ?? undefined) : undefined;
}

@Injectable({ providedIn: 'root' })
export class HierarchyApiService extends HierarchyApiPort {
  private http = inject(HttpClient);
  private config = inject(AppConfigService);
  private get baseUrl() { return this.config.get('apiBaseUrl'); }

  override cities(): Observable<HierarchyNode[]> {
    return this.http.get<RawCityNode[]>(`${this.baseUrl}/cities`).pipe(
      map((rows) => rows.map((c): HierarchyNode => ({
        id: c.id, level: 'city', code: '', name: c.name, parentId: null, bbox: toBbox(c.boundaryWkt),
      }))),
    );
  }

  override communes(cityId: UUID): Observable<HierarchyNode[]> {
    return this.http.get<RawCommuneNode[]>(`${this.baseUrl}/communes`, { params: { cityId } }).pipe(
      map((rows) => rows.map((c): HierarchyNode => ({
        id: c.id, level: 'commune', code: c.code, name: c.name,
        parentId: c.cityId, bbox: toBbox(c.boundaryWkt),
      }))),
    );
  }

  override zones(communeId: UUID): Observable<HierarchyNode[]> {
    return this.http.get<RawZoneNode[]>(`${this.baseUrl}/zones`, { params: { communeId } }).pipe(
      map((rows) => rows.map((z): HierarchyNode => ({
        id: z.id, level: 'zone', code: z.code, name: z.name,
        parentId: z.communeId, bbox: toBbox(z.boundaryWkt),
      }))),
    );
  }

  override quartiers(cityId: UUID, communeId?: UUID | null, zoneId?: UUID | null): Observable<HierarchyNode[]> {
    const params: Record<string, string> = { cityId };
    if (communeId) params['communeId'] = communeId;
    if (zoneId) params['zoneId'] = zoneId;
    return this.http.get<RawQuartierNode[]>(`${this.baseUrl}/quartiers`, { params }).pipe(
      // `nom`, PAS `name` : c'est cet écart-là qui vidait le select des quartiers.
      map((rows) => rows.map((q): HierarchyNode => ({
        id: q.id, level: 'quartier', code: q.code, name: q.nom,
        // La commune est facultative (CLAUDE.md §5) : le parent est le niveau renseigné le plus
        // fin, et `cityId` reste le rattachement structurant qui ne manque jamais.
        parentId: q.zoneId ?? q.communeId ?? q.cityId,
        bbox: toBbox(q.boundaryWkt),
      }))),
    );
  }
  override closes(quartierId: UUID): Observable<HierarchyNode[]> {
    return this.http.get<RawCloseNode[]>(`${this.baseUrl}/closes`, { params: { quartierId } }).pipe(
      map((rows) => rows.map((c): HierarchyNode => ({
        id: c.id,
        level: 'close',
        code: c.code,
        // `label` est composé par le back (repli nom de rue → numéro → code) : on le LIT.
        name: c.label,
        parentId: c.quartierId,
        bbox: toBbox(c.boundaryWkt),
      }))),
    );
  }

  override blocs(quartierId: UUID): Observable<HierarchyNode[]> {
    // Projection HIÉRARCHIE (id/code/name/bbox) — distincte de la liste riche /blocs du module Blocs.
    return this.http.get<RawBlocNode[]>(`${this.baseUrl}/blocs`, { params: { quartierId } }).pipe(
      map((rows) => rows.map((b): HierarchyNode => ({
        id: b.id,
        level: 'bloc',
        code: b.code,
        name: b.name ?? b.code,
        parentId: b.quartierId,
        closeId: b.closeId,
      }))),
    );
  }
}
