import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { AdresseApiPort } from './adresse-api.port';
import { AddressWorkflowStage, UUID } from '../../models/das.models';
import {
  AddressDetail, AddressListItem, BulkUpdatePayload,
  AdresseFilterOptions, AdressePageResult, AdresseQuery, AdresseSummary, UpdateAdressePayload,
} from '../models/adresse.models';

const QUARTIERS = ['Balbala', 'Héron', 'Centre-ville', 'Le Plateau', 'Arhiba'];
const POSTCODE_BY_QUARTIER: Record<string, string> = {
  'Balbala': 'PC 1001', 'Héron': 'PC 1002', 'Centre-ville': 'PC 1003', 'Le Plateau': 'PC 1004', 'Arhiba': 'PC 1005',
};
const ZONE_BY_QUARTIER: Record<string, string> = {
  'Balbala': 'Zone Sud', 'Héron': 'Zone Nord', 'Centre-ville': 'Zone Centre', 'Le Plateau': 'Zone Centre', 'Arhiba': 'Zone Nord',
};
const REGIONS = ['Djibouti', 'Arta', 'Dikhil', 'Tadjourah', 'Obock'];
// assignedTeamName = nom d'un AGENT (pas d'équipe), lecture seule — cf. §7 CLAUDE.md.
const TEAMS = ['Idriss Agent', 'Warsama Robleh', 'Fatouma Osman'];
// Libellés FR bruts d'un catalogue back — pas un enum fermé (cf. §7 CLAUDE.md).
const TYPES = ['Villa', 'Immeuble mixte', 'Appartement', 'Local commercial', 'Entrepôt', 'Terrain vacant'];
const STAGES: AddressWorkflowStage[] = ['registered', 'surveyed', 'verified', 'approved', 'published'];
import { GeoJSONMultiPolygon } from '../../models/das.models';

function squareMulti(lng: number, lat: number, size: number): GeoJSONMultiPolygon {
  const h = size / 2;
  return {
    type: 'MultiPolygon', coordinates: [[[
      [lng - h, lat - h], [lng + h, lat - h], [lng + h, lat + h], [lng - h, lat + h], [lng - h, lat - h],
    ]]]
  };
}
function squareWkt(lng: number, lat: number, size: number): string {
  const h = size / 2;
  const ring = [[lng - h, lat - h], [lng + h, lat - h], [lng + h, lat + h], [lng - h, lat + h], [lng - h, lat - h]];
  return `MULTIPOLYGON(((${ring.map(([x, y]) => `${x} ${y}`).join(', ')})))`;
}

/**
 * Champs supplémentaires que le back renvoie déjà sur `AdresseResponse` (numero, boundaryWkt),
 * pas encore utiles à la liste. `closeId` : concept interne au mock, pour reproduire l'unicité
 * « numéro de maison dans la CLOSE » (décision du 2026-08-23, cf. docs/plans/adressage.md §2.3).
 */
interface MockAddressRecord extends AddressListItem {
  numero: number;
  boundaryWkt: string;
  closeId: string;
  /** `null` quand le bloc de la parcelle n'est rattaché à aucune close — cf. `attached` ci-dessous. */
  closeCode: string | null;
  /** Nom BRUT de la rue. `null` sur une rue pas encore nommée : c'est ce qui rend le repli de `street` visible. */
  streetName: string | null;
}

/**
 * Rues des closes du mock. La valeur `null` est délibérée : une rue est nommée par une
 * `StreetSuggestion` approuvée, donc `Street.Name` reste vide un moment. C'est le cas qui fait
 * jouer le repli `Street.Name → « close N » → Code` côté back — sans lui, on ne verrait jamais
 * le repli à l'écran.
 */
const STREET_NAMES: readonly (string | null)[] = ['Avenue Nasser', 'Rue de la Mosquée', null, 'Boulevard de la République'];

@Injectable({ providedIn: 'root' })
export class MockAdresseApiService extends AdresseApiPort {
  private static readonly LATENCY = 380;

  private records: MockAddressRecord[] = Array.from({ length: 47 }, (_, i) => {

    const n = 12345 + i;
    const lng = 43.134 + (i % 8) * 0.0045;
    const lat = 11.588 + Math.floor(i / 8) * 0.0045;
    const quartier = QUARTIERS[i % QUARTIERS.length];
    const workflowStage = STAGES[i % STAGES.length];
    const closeIndex = Math.floor(i / 6);
    // Une parcelle sur onze n'est rattachée à aucune close : c'est l'état de TOUTE la base avant
    // la reprise de données, et le seul qui rende `street`/`closeCode` nuls (jamais un repli).
    const attached = i % 11 !== 0;
    const streetName = STREET_NAMES[closeIndex % STREET_NAMES.length];

    return {
      id: `addr-${n}`,
      // null tant que pas validé Definitive : seule l'étape `published` porte un code.
      addressCode: workflowStage === 'published' ? `ADDR-${String(n).padStart(8, '0')}` : null,
      libelle: `${quartier}, parcelle ${n}`,
      quartier,
      postcode: POSTCODE_BY_QUARTIER[quartier],
      zone: ZONE_BY_QUARTIER[quartier],
      // Repli du back : nom de la rue → « close N » → code de la close. Jamais le bloc.
      street: attached ? (streetName ?? `close ${closeIndex + 1}`) : null,
      propertyType: TYPES[i % TYPES.length],
      workflowStage,
      lastUpdate: new Date(2026, 6, 1 + (i % 28), 9, (i * 7) % 60).toISOString(),
      assignedTeamName: TEAMS[i % TEAMS.length],
      geom: squareMulti(lng, lat, 0.0028),
      numero: (i % 30) + 1,
      boundaryWkt: squareWkt(lng, lat, 0.0028),
      // Une parcelle sans close n'a pas de voisine au sens de l'unicité du numéro : id unique.
      closeId: attached ? `close-${quartier}-${closeIndex}` : `close-orpheline-${i}`,
      closeCode: attached ? `CL-${String(closeIndex + 1).padStart(2, '0')}` : null,
      streetName: attached ? streetName : null,
    };
  });

  override summary(): Observable<AdresseSummary> {
    const pending = this.records.filter((r) => r.workflowStage === 'surveyed' || r.workflowStage === 'registered').length;
    const published = this.records.filter((r) => r.workflowStage === 'published').length;
    const workflowBreakdown = STAGES.map((stage) => ({
      stage, count: this.records.filter((r) => r.workflowStage === stage).length,
    }));
    return of({
      totalRecords: this.records.length,
      pendingReview: pending,
      duplicatesFlagged: 3,
      publishedToday: published,
      workflowBreakdown,
    }).pipe(delay(MockAdresseApiService.LATENCY));
  }

  override filterOptions(): Observable<AdresseFilterOptions> {
    return of({
      postcodes: [...new Set(this.records.map((r) => r.postcode!).filter(Boolean))].sort(),
      zones: [...new Set(this.records.map((r) => r.zone!).filter(Boolean))].sort(),
      regions: REGIONS,
      teams: TEAMS,
    }).pipe(delay(200));
  }

  override list(query: AdresseQuery): Observable<AdressePageResult> {
    const { filters, page, pageSize } = query;
    const search = filters.search.trim().toLowerCase();
    const filtered = this.records.filter((r) => {
      if (search && !r.quartier.toLowerCase().includes(search) && !r.libelle.toLowerCase().includes(search) && !(r.addressCode?.toLowerCase().includes(search) ?? false)) return false;
      if (filters.postcode && r.postcode !== filters.postcode) return false;
      if (filters.zone && r.zone !== filters.zone) return false;
      if (filters.status && r.workflowStage !== filters.status) return false;
      if (filters.team && r.assignedTeamName !== filters.team) return false;

      return true;
    });
    const start = (page - 1) * pageSize;
    return of({
      items: filtered.slice(start, start + pageSize),
      total: filtered.length,
      page,
      pageSize,
    }).pipe(delay(MockAdresseApiService.LATENCY));
  }

  override getDetail(id: UUID): Observable<AddressDetail> {
    const base = this.records.find((r) => r.id === id);
    if (!base) return throwError(() => ({ code: 'not_found', message: 'common.error' }));
    // `...base` apporte les champs COMMUNS ; les quatre que la réponse détail ne porte pas
    // (`zone`, `street`, `quartier`, `propertyType`) sont retirés par l'`Omit` du type, donc les
    // laisser passer ici ferait diverger le mock du réel sans que rien ne le signale.
    const { zone: _z, street: _s, quartier: _q, propertyType: _p, ...common } = base;
    const detail: AddressDetail = {
      ...common,
      blocId: `${base.id}-bloc`,
      blocCode: `BOULAOS-Q7-${base.id.slice(-1).toUpperCase()}`,
      blocName: null,
      quartierNom: base.quartier,
      cityName: 'Djibouti',
      locationWkt: 'POINT(43.1456 11.6004)',
      closeId: base.closeCode ? base.closeId : null,
      components: {
        street: base.street,
        quartierNom: base.quartier,
        zone: base.zone,
        commune: 'Boulaos',
        region: 'Djibouti',
        postcode: base.postcode,
      },
      location: { latitude: 11.6004 + Math.random() * 0.01, longitude: 43.1456 + Math.random() * 0.01, parcelNumber: `PAR-${base.postcode?.replace(/\D/g, '')}-${base.id.slice(-4)}` },
      // `occupancyType: null` comme le back : le régime d'occupation n'est relevé nulle part.
      // Le mock affichait « occupied », ce qui laissait croire à une donnée qui n'arrive jamais.
      propertyInfo: { propertyType: base.propertyType, occupancyType: null, buildingUse: base.propertyType === 'Villa' ? 'Single Family' : null },
      // score = nombre de relevés de l'agent (pas un pourcentage) — cf. §7 CLAUDE.md.
      validation: { score: 1 + (base.id.charCodeAt(base.id.length - 1) % 6), percentage: null, notes: 'Adresse vérifiée sur site. Numéro de bâtiment visible.' },
      linked: [
        { id: `${id}-l1`, kind: 'postcode', label: base.postcode ?? '—' },
        // La rue n'entre dans `linked` que si la parcelle a une close : sans close, il n'y a
        // aucune rue à lier, et une ligne « — » ferait croire à une donnée manquante.
        ...(base.street ? [{ id: `${id}-l3`, kind: 'street' as const, label: base.street }] : []),
        { id: `${id}-l2`, kind: 'team', label: base.assignedTeamName ?? '—' },
      ],
      units: [],
      surveys: []
    };
    return of(detail).pipe(delay(MockAdresseApiService.LATENCY));
  }

  override update(id: UUID, payload: UpdateAdressePayload): Observable<void> {
    const base = this.records.find((r) => r.id === id);
    if (!base) return throwError(() => ({ code: 'Adresses.NotFound', message: 'Adresse introuvable.' }));

    const numeroTaken = this.records.some((r) => r.closeId === base.closeId && r.numero === payload.numero && r.id !== id);
    if (numeroTaken) {
      return throwError(() => ({ code: 'Adresses.NumeroTaken', message: "Ce numéro d'adresse est déjà utilisé dans cette close." }))
        .pipe(delay(MockAdresseApiService.LATENCY));
    }

    this.records = this.records.map((r) => (r.id === id
      ? { ...r, numero: payload.numero, boundaryWkt: payload.boundaryWkt, lastUpdate: new Date().toISOString() }
      : r));
    return of(void 0).pipe(delay(MockAdresseApiService.LATENCY));
  }

  override bulkUpdate(payload: BulkUpdatePayload): Observable<void> {
    const stage: AddressWorkflowStage = payload.stage === 'Approved' ? 'approved' : 'published';
    this.records = this.records.map((r) => (payload.ids.includes(r.id) ? { ...r, workflowStage: stage, lastUpdate: new Date().toISOString() } : r));
    return of(void 0).pipe(delay(300));
  }
}
