import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { ClosesApiPort } from './closes-api.port';
import { UUID } from '../../models/das.models';
import {
  AdresseNumbering, ApplyQuartierClosesPayload, AppliedQuartierCloses, Close, CloseBloc,
  CloseListQuery, CloseNumberingPlan, CloseStreetOption, CreateClosePayload, PlannedAdresse,
  ProposedClose, ProposedCloseWarning, QuartierClosePlan, QuartierClosePlanParameters,
  QuartierCloseProgress, UpdateClosePayload,
} from '../models/closes.models';

const LATENCY_MS = 320;
/** Mêmes ids que `MockBlocksApiService`/`HierarchyMockService`, pour que les mocks se parlent. */
const QUARTIER_7 = 'deadd2cc-fefc-403b-af2a-b7fcb9b6769f';
const QUARTIER_NOM = 'Quartier 7';
const QUARTIER_CODE = 'Q7';

interface MockClose {
  id: string; quartierId: string; streetId: string; streetCode: string; streetName: string | null;
  number: number; code: string; blocIds: string[];
}

/** Ordre stable, utilisé pour espacer les parcelles mock le long de l'axe. */
const MOCK_BLOC_ORDER = ['bloc-0001', 'bloc-0002', 'bloc-0003'];

const MOCK_BLOCS: Record<string, CloseBloc> = {
  'bloc-0001': { id: 'bloc-0001', code: 'Q7-B01', name: 'Avenue Nasser', number: 1 },
  'bloc-0002': { id: 'bloc-0002', code: 'Q7-B02', name: null, number: 2 },
  'bloc-0003': { id: 'bloc-0003', code: 'Q7-B03', name: null, number: null },
};

function label(c: MockClose): string {
  return c.streetName ?? String(c.number) ?? c.code;
}

/**
 * Erreur métier à la forme du mock : `{ code, message }` renvoyé **nu**, sans enveloppe `.error`
 * — c'est ce que produit `throwError`, contrairement à une `HttpErrorResponse`. Les deux formes
 * sont lues par `core/http/error-code.ts`.
 */
const fail = (code: string, message: string): Observable<never> => throwError(() => ({ code, message }));

@Injectable({ providedIn: 'root' })
export class MockClosesApiService extends ClosesApiPort {
  private closes: MockClose[] = [
    { id: 'close-0001', quartierId: QUARTIER_7, streetId: 'street-0003', streetCode: 'STR-0003', streetName: 'Impasse du Puits', number: 1, code: 'CL-01', blocIds: ['bloc-0001'] },
    { id: 'close-0002', quartierId: QUARTIER_7, streetId: 'street-0001', streetCode: 'STR-0001', streetName: null, number: 2, code: 'CL-02', blocIds: [] },
  ];

  private nextId = 3;

  private toClose(c: MockClose): Close {
    return {
      id: c.id, quartierId: c.quartierId, quartierNom: QUARTIER_NOM, quartierCode: QUARTIER_CODE,
      streetId: c.streetId, streetCode: c.streetCode, streetName: c.streetName,
      number: c.number, code: c.code, label: label(c),
      blocs: c.blocIds.map((id) => MOCK_BLOCS[id]).filter((b): b is CloseBloc => !!b),
      adresseCount: 0, boundaryWkt: null,
    };
  }

  /** Mêmes ids que `MockAddressingApiService.streets`. */
  private streets: CloseStreetOption[] = [
    { id: 'street-0001', code: 'STR-0001', name: null, type: 'Rue', boundaryWkt: null },
    { id: 'street-0002', code: 'STR-0002', name: null, type: 'Piste', boundaryWkt: null },
    { id: 'street-0003', code: 'STR-0003', name: 'Impasse du Puits', type: 'Impasse', boundaryWkt: null },
  ];

  override listStreets(): Observable<CloseStreetOption[]> {
    return of(this.streets).pipe(delay(LATENCY_MS));
  }

  override renameStreet(street: CloseStreetOption, name: string): Observable<CloseStreetOption> {
    const s = this.streets.find((x) => x.id === street.id);
    if (!s) return throwError(() => ({ code: 'Streets.NotFound', message: 'Rue introuvable.' }));
    s.name = name;
    // La close porte le nom de sa rue : la renommer change le libellé de toutes ses closes.
    for (const c of this.closes) if (c.streetId === s.id) c.streetName = name;
    return of(s).pipe(delay(LATENCY_MS));
  }

  override list(query: CloseListQuery): Observable<Close[]> {
    const items = this.closes
      .filter((c) => !query.quartierId || c.quartierId === query.quartierId)
      .filter((c) => !query.streetId || c.streetId === query.streetId);
    return of(items.map((c) => this.toClose(c))).pipe(delay(LATENCY_MS));
  }

  override getById(id: UUID): Observable<Close> {
    const c = this.closes.find((x) => x.id === id);
    if (!c) return fail('Closes.NotFound', 'Close introuvable.');
    return of(this.toClose(c)).pipe(delay(LATENCY_MS));
  }

  override create(payload: CreateClosePayload): Observable<Close> {
    const conflict = this.placementConflict(payload.quartierId, payload, null);
    if (conflict) return conflict;
    const created: MockClose = {
      id: `close-${String(this.nextId++).padStart(4, '0')}`,
      quartierId: payload.quartierId, streetId: payload.streetId,
      streetCode: this.streets.find((r) => r.id === payload.streetId)?.code ?? 'STR-????',
      streetName: this.streets.find((r) => r.id === payload.streetId)?.name ?? null,
      number: payload.number, code: payload.code, blocIds: [],
    };
    this.closes = [...this.closes, created];
    return of(this.toClose(created)).pipe(delay(LATENCY_MS));
  }

  override update(id: UUID, payload: UpdateClosePayload): Observable<Close> {
    const existing = this.closes.find((c) => c.id === id);
    if (!existing) return fail('Closes.NotFound', 'Close introuvable.');
    const conflict = this.placementConflict(existing.quartierId, payload, id);
    if (conflict) return conflict;
    const street = this.streets.find((r) => r.id === payload.streetId);
    const updated: MockClose = {
      ...existing, streetId: payload.streetId,
      streetCode: street?.code ?? existing.streetCode, streetName: street?.name ?? null,
      number: payload.number, code: payload.code,
    };
    this.closes = this.closes.map((c) => (c.id === id ? updated : c));
    return of(this.toClose(updated)).pipe(delay(LATENCY_MS));
  }

  /** Le back refuse (409) tant que des blocs y sont rattachés — `DeleteCloseHandler`. */
  override remove(id: UUID): Observable<void> {
    const close = this.closes.find((c) => c.id === id);
    if (!close) return fail('Closes.NotFound', 'Close introuvable.');
    if (close.blocIds.length > 0) {
      return fail('Closes.HasBlocs', 'Des blocs sont encore rattachés à cette close.').pipe(delay(LATENCY_MS));
    }
    this.closes = this.closes.filter((c) => c.id !== id);
    return of(void 0).pipe(delay(LATENCY_MS));
  }

  /**
   * Reproduit les gardes réelles d'`AttachBlocsHandler`, dans son ordre.
   *
   * Un bloc déjà rattaché **ailleurs** n'est PAS un refus : c'est un déplacement, que le back
   * accepte (il ne le bloque que sur un code d'adresse figé, cas absent du mock puisque rien
   * n'y est figé). Ce qu'il refuse, et qui est la règle plus que l'exception aujourd'hui, c'est
   * de faire cohabiter deux blocs sous une même close : chacun numérotant ses parcelles à partir
   * de 1, leurs numéros de maison collident. C'est ce refus-là qu'un opérateur rencontrera, donc
   * c'est celui qu'il faut pouvoir tester sans back.
   */
  /**
   * Chaque bloc mock numérote ses parcelles à partir de 1 — comme en base réelle. C'est ce qui
   * rend la collision reproductible en mock, sans quoi le parcours preview → validation →
   * application ne serait jamais exerçable hors backend.
   */
  private parcelsOf(blocId: string): Array<{ adresseId: string; numero: number; lng: number; lat: number }> {
    const seed = MOCK_BLOC_ORDER.indexOf(blocId);
    return Array.from({ length: 4 }, (_, i) => ({
      adresseId: `${blocId}-adr-${i + 1}`,
      numero: i + 1,
      lng: 43.140 + seed * 0.006 + i * 0.0012,
      lat: 11.586 + seed * 0.0008,
    }));
  }

  override previewAttachBlocs(id: UUID, blocIds: UUID[], reverse: boolean): Observable<CloseNumberingPlan> {
    const close = this.closes.find((c) => c.id === id);
    if (!close) return throwError(() => ({ code: 'Closes.NotFound', message: 'Close introuvable.' }));

    const resulting = [...new Set([...close.blocIds, ...blocIds])];
    const rows = resulting.flatMap((b) =>
      this.parcelsOf(b).map((p) => ({ ...p, blocId: b, entering: !close.blocIds.includes(b) })));

    // Tri le long d'un axe est-ouest — approximation du régime ParcelCloud du back.
    rows.sort((a, b) => (reverse ? b.lng - a.lng : a.lng - b.lng));
    const first = rows[0];

    const adresses: PlannedAdresse[] = rows.map((r, i) => ({
      adresseId: r.adresseId,
      blocId: r.blocId,
      blocCode: MOCK_BLOCS[r.blocId]?.code ?? r.blocId,
      entering: r.entering,
      currentNumero: r.numero,
      proposedNumero: i + 1,
      distanceMeters: first ? Math.round(Math.abs(r.lng - first.lng) * 111_320) : 0,
      side: i % 2 === 0 ? 'Left' : 'Right',
      addressCode: null,
      locationWkt: `POINT(${r.lng} ${r.lat})`,
      boundaryWkt: `MULTIPOLYGON(((${r.lng} ${r.lat}, ${r.lng + 0.0008} ${r.lat}, ${r.lng + 0.0008} ${r.lat + 0.0006}, ${r.lng} ${r.lat + 0.0006}, ${r.lng} ${r.lat})))`,
    }));

    return of({
      closeId: close.id,
      closeCode: close.code,
      orderingSource: 'ParcelCloud' as const,
      reverse,
      parcelCount: adresses.length,
      changedCount: adresses.filter((a) => a.currentNumero !== a.proposedNumero).length,
      adresses,
    }).pipe(delay(LATENCY_MS));
  }

  override attachBlocs(id: UUID, blocIds: UUID[], numbering?: AdresseNumbering[]): Observable<Close> {
    const close = this.closes.find((c) => c.id === id);
    if (!close) return throwError(() => ({ code: 'Closes.NotFound', message: 'Close introuvable.' }));

    const takenElsewhere = blocIds.find((b) => this.closes.some((c) => c.id !== id && c.blocIds.includes(b)));
    if (takenElsewhere) {
      return throwError(() => ({ code: 'Closes.BlocAlreadyAssigned', message: 'Un des blocs appartient déjà à une autre close.' })).pipe(delay(LATENCY_MS));
    }

    // LA garde qui compte : sans plan, réunir deux blocs fait collider leurs numéros — chaque
    // bloc partant de 1. Le back refuse pour la même raison, et c'est ce refus qui envoie
    // l'opérateur vers l'aperçu.
    const resulting = [...new Set([...close.blocIds, ...blocIds])];
    if (!numbering?.length && resulting.length > 1) {
      return throwError(() => ({
        code: 'Closes.DuplicateAdresseNumero',
        message: 'Deux parcelles porteraient le même numéro dans cette close.',
      })).pipe(delay(LATENCY_MS));
    }

    if (numbering?.length) {
      const nums = numbering.map((n) => n.numero);
      if (new Set(nums).size !== nums.length) {
        return throwError(() => ({ code: 'Closes.NumberingDuplicate', message: 'Deux parcelles portent le même numéro dans le plan.' })).pipe(delay(LATENCY_MS));
      }
      const expected = resulting.flatMap((b) => this.parcelsOf(b).map((p) => p.adresseId));
      if (numbering.length !== expected.length) {
        return throwError(() => ({ code: 'Closes.NumberingIncomplete', message: 'Le plan ne couvre pas toutes les parcelles de la close.' })).pipe(delay(LATENCY_MS));
      }
    }

    close.blocIds = resulting;
    return of(this.toClose(close)).pipe(delay(LATENCY_MS));
  }

  override detachBloc(id: UUID, blocId: UUID): Observable<Close> {
    const close = this.closes.find((c) => c.id === id);
    if (!close) return fail('Closes.NotFound', 'Close introuvable.');
    if (!close.blocIds.includes(blocId)) {
      return fail('Closes.BlocNotAttached', "Ce bloc n'est pas rattaché à cette close.").pipe(delay(LATENCY_MS));
    }
    const updated: MockClose = { ...close, blocIds: close.blocIds.filter((b) => b !== blocId) };
    this.closes = this.closes.map((c) => (c.id === id ? updated : c));
    return of(this.toClose(updated)).pipe(delay(LATENCY_MS));
  }

  /**
   * Les trois unicités « dans le quartier » de `ClosePlacement` : la rue, le numéro (3ᵉ segment
   * du code d'adresse) et le code. Testées dans le même ordre que le back, pour que le message
   * affiché soit le même qu'en réel quand deux conflits coexistent.
   */
  private placementConflict(
    quartierId: string,
    payload: { streetId: string; number: number; code: string },
    selfId: UUID | null,
  ): Observable<never> | null {
    const siblings = this.closes.filter((c) => c.quartierId === quartierId && c.id !== selfId);
    if (siblings.some((c) => c.streetId === payload.streetId)) {
      return fail('Closes.StreetAlreadyUsed', 'Cette rue a déjà une close dans ce quartier.');
    }
    if (siblings.some((c) => c.number === payload.number)) {
      return fail('Closes.NumberAlreadyUsed', 'Une close porte déjà ce numéro dans ce quartier.');
    }
    if (siblings.some((c) => c.code === payload.code)) {
      return fail('Closes.CodeAlreadyExists', 'Une close porte déjà ce code dans ce quartier.');
    }
    return null;
  }

  /* =========================================================================================
   * GÉNÉRATION PAR QUARTIER
   *
   * Le jeu mock reproduit les PROPORTIONS mesurées en base le 2026-09-04, pas un cas idéal :
   * une majorité de blocs rattachables, une minorité franche hors de portée, et des closes qui
   * collident sur les numéros. Un mock où tout tombe juste rendrait l'écran invérifiable —
   * on ne verrait jamais le panneau des non-rattachés ni le blocage sur collision.
   * ====================================================================================== */

  private readonly QUARTIER_6 = 'a1c3f2e0-1111-4c2a-9f10-6b8d0e5a7c31';

  private progress: QuartierCloseProgress[] = [
    {
      quartierId: QUARTIER_7, quartierNom: QUARTIER_NOM, quartierCode: QUARTIER_CODE,
      cityName: 'Djibouti', communeName: 'Boulaos', zoneName: 'Zone 2',
      blocsTotal: 12, blocsWithClose: 1, blocsRemaining: 11, closesCount: 2,
    },
    {
      quartierId: this.QUARTIER_6, quartierNom: 'Quartier 6', quartierCode: 'Q6',
      cityName: 'Djibouti', communeName: 'Boulaos', zoneName: 'Zone 2',
      blocsTotal: 8, blocsWithClose: 0, blocsRemaining: 8, closesCount: 0,
    },
  ];

  override listQuartierProgress(): Observable<QuartierCloseProgress[]> {
    return of(this.progress.map((p) => ({ ...p }))).pipe(delay(LATENCY_MS));
  }

  /** Blocs fictifs du quartier à générer, avec leur rue la plus proche et leur distance. */
  private readonly GENERATION_BLOCS: Array<{
    id: string; code: string; streetId: string; distanceMeters: number; adresseCount: number;
  }> = [
    { id: 'bloc-0011', code: 'Q7-B11', streetId: 'street-0001', distanceMeters: 8.2, adresseCount: 14 },
    { id: 'bloc-0012', code: 'Q7-B12', streetId: 'street-0001', distanceMeters: 11.7, adresseCount: 9 },
    { id: 'bloc-0013', code: 'Q7-B13', streetId: 'street-0001', distanceMeters: 26.4, adresseCount: 12 },
    { id: 'bloc-0014', code: 'Q7-B14', streetId: 'street-0002', distanceMeters: 19.0, adresseCount: 7 },
    { id: 'bloc-0015', code: 'Q7-B15', streetId: 'street-0002', distanceMeters: 33.9, adresseCount: 6 },
    { id: 'bloc-0016', code: 'Q7-B16', streetId: 'street-0003', distanceMeters: 41.5, adresseCount: 5 },
    // Hors de portée : reproduit les 42 % sans voirie urbaine proche.
    { id: 'bloc-0017', code: 'Q7-B17', streetId: 'street-0002', distanceMeters: 188.3, adresseCount: 8 },
    { id: 'bloc-0018', code: 'Q7-B18', streetId: 'street-0002', distanceMeters: 342.1, adresseCount: 11 },
    { id: 'bloc-0019', code: 'Q7-B19', streetId: 'street-0001', distanceMeters: 502.7, adresseCount: 4 },
  ];

  /** Carré grossier autour d'un point, suffisant pour que la carte ait quelque chose à dessiner. */
  private mockPolygon(seed: number): string {
    const lng = 43.138 + seed * 0.004;
    const lat = 11.584 + (seed % 3) * 0.003;
    const d = 0.0016;
    return `POLYGON((${lng} ${lat}, ${lng + d} ${lat}, ${lng + d} ${lat + d}, ${lng} ${lat + d}, ${lng} ${lat}))`;
  }

  override previewQuartierCloses(
    quartierId: UUID,
    params: Partial<QuartierClosePlanParameters>,
  ): Observable<QuartierClosePlan> {
    const quartier = this.progress.find((p) => p.quartierId === quartierId);
    if (!quartier) return fail('Quartiers.NotFound', 'Quartier introuvable.');

    // Défauts alignés sur ceux annoncés par le back : le front n'en invente pas.
    const applied: QuartierClosePlanParameters = {
      maxDistanceMeters: params.maxDistanceMeters ?? 50,
      streetTypes: params.streetTypes ?? ['Rue', 'Avenue', 'Boulevard', 'Route'],
      includeUnnamedStreets: params.includeUnnamedStreets ?? true,
      excludeStreetCodePrefixes: params.excludeStreetCodePrefixes ?? ['SIG-RT', 'SIG-PI'],
    };

    const assignable = this.GENERATION_BLOCS.filter((b) => b.distanceMeters <= applied.maxDistanceMeters);
    const tooFar = this.GENERATION_BLOCS.filter((b) => b.distanceMeters > applied.maxDistanceMeters);

    // Une close par rue : c'est la contrainte UNIQUE(quartier, rue) du schéma, pas un choix.
    const byStreet = new Map<string, typeof assignable>();
    for (const b of assignable) {
      const list = byStreet.get(b.streetId) ?? [];
      list.push(b);
      byStreet.set(b.streetId, list);
    }

    // La numérotation reprend là où le quartier s'est arrêté — jamais à 1.
    let nextNumber = Math.max(0, ...this.closes.filter((c) => c.quartierId === quartierId).map((c) => c.number)) + 1;

    const proposed: ProposedClose[] = [...byStreet.entries()].map(([streetId, blocs], i) => {
      const street = this.streets.find((s) => s.id === streetId);
      const adresseCount = blocs.reduce((n, b) => n + b.adresseCount, 0);
      const warnings: ProposedCloseWarning[] = [];
      if (!street?.name) warnings.push('RueAnonyme');
      if (blocs.length === 1) warnings.push('BlocIsole');
      if (adresseCount > 200) warnings.push('CloseVolumineuse');
      const number = nextNumber++;
      return {
        key: `p-${i + 1}`,
        streetId,
        streetCode: street?.code ?? 'STR-????',
        streetName: street?.name ?? null,
        streetType: street?.type ?? 'Rue',
        number,
        code: `${quartier.quartierCode}-${String(number).padStart(2, '0')}`,
        blocs: blocs.map((b) => ({
          id: b.id, code: b.code, name: null, number: null,
          distanceMeters: b.distanceMeters, adresseCount: b.adresseCount,
        })),
        adresseCount,
        // Deux blocs ou plus numérotent chacun à partir de 1 : la collision est certaine.
        hasNumeroCollision: blocs.length > 1,
        boundaryWkt: this.mockPolygon(i),
        warnings,
      };
    });

    const plan: QuartierClosePlan = {
      quartierId, quartierNom: quartier.quartierNom, quartierCode: quartier.quartierCode,
      parameters: applied,
      summary: {
        blocsTotal: this.GENERATION_BLOCS.length,
        blocsAssigned: assignable.length,
        blocsUnassigned: tooFar.length,
        closesProposed: proposed.length,
        adressesImpacted: proposed.reduce((n, p) => n + p.adresseCount, 0),
      },
      proposed,
      unassignedBlocs: tooFar.map((b, i) => ({
        blocId: b.id, blocCode: b.code,
        reason: 'AucuneRueAProximite' as const,
        nearestStreetId: b.streetId,
        distanceMeters: b.distanceMeters,
        boundaryWkt: this.mockPolygon(20 + i),
      })),
    };
    return of(plan).pipe(delay(LATENCY_MS));
  }

  override previewProposalNumbering(
    quartierId: UUID,
    key: string,
    reverse: boolean,
  ): Observable<CloseNumberingPlan> {
    const quartier = this.progress.find((p) => p.quartierId === quartierId);
    if (!quartier) return fail('Quartiers.NotFound', 'Quartier introuvable.');

    const index = Number(key.replace('p-', '')) - 1;
    const streetIds = [...new Set(this.GENERATION_BLOCS.filter((b) => b.distanceMeters <= 50).map((b) => b.streetId))];
    const streetId = streetIds[index];
    if (!streetId) return fail('Closes.ProposalNotFound', 'Proposition introuvable — relancer l\'aperçu.');

    const blocs = this.GENERATION_BLOCS.filter((b) => b.streetId === streetId && b.distanceMeters <= 50);
    const rows = blocs.flatMap((b, bi) =>
      Array.from({ length: b.adresseCount }, (_, i) => ({
        adresseId: `${b.id}-adr-${i + 1}`,
        blocId: b.id,
        blocCode: b.code,
        // Chaque bloc repart de 1 : c'est exactement ce qui produit la collision.
        currentNumero: i + 1,
        lng: 43.138 + bi * 0.0042 + i * 0.00028,
        lat: 11.584 + bi * 0.0006,
      })));

    rows.sort((a, b) => (reverse ? b.lng - a.lng : a.lng - b.lng));
    const first = rows[0];

    const adresses: PlannedAdresse[] = rows.map((r, i) => ({
      adresseId: r.adresseId,
      blocId: r.blocId,
      blocCode: r.blocCode,
      entering: true,
      currentNumero: r.currentNumero,
      proposedNumero: i + 1,
      distanceMeters: first ? Math.round(Math.abs(r.lng - first.lng) * 111_320) : 0,
      side: i % 2 === 0 ? 'Left' : 'Right',
      addressCode: null,
      locationWkt: `POINT(${r.lng} ${r.lat})`,
      boundaryWkt: `MULTIPOLYGON(((${r.lng} ${r.lat}, ${r.lng + 0.0002} ${r.lat}, ${r.lng + 0.0002} ${r.lat + 0.0004}, ${r.lng} ${r.lat + 0.0004}, ${r.lng} ${r.lat})))`,
    }));

    return of({
      closeId: key,
      closeCode: `${quartier.quartierCode}-??`,
      // Les tracés de rue existent depuis la reprise du 2026-09-04 : le back peut désormais
      // ordonner sur l'axe réel. Le mock l'annonce pour que l'écran affiche le bon régime.
      orderingSource: 'StreetLine' as const,
      reverse,
      parcelCount: adresses.length,
      changedCount: adresses.filter((a) => a.currentNumero !== a.proposedNumero).length,
      adresses,
    }).pipe(delay(LATENCY_MS));
  }

  override applyQuartierCloses(
    quartierId: UUID,
    payload: ApplyQuartierClosesPayload,
  ): Observable<AppliedQuartierCloses> {
    const quartier = this.progress.find((p) => p.quartierId === quartierId);
    if (!quartier) return fail('Quartiers.NotFound', 'Quartier introuvable.');
    if (!payload.closes.length) {
      return fail('Closes.EmptyPlan', 'Le plan ne contient aucune close.').pipe(delay(LATENCY_MS));
    }

    // Mêmes gardes que le back, dans le même ordre : sans plan de numérotation complet, refus.
    for (const c of payload.closes) {
      const conflict = this.placementConflict(quartierId, c, null);
      if (conflict) return conflict.pipe(delay(LATENCY_MS));

      const expected = c.blocIds
        .map((id) => this.GENERATION_BLOCS.find((b) => b.id === id)?.adresseCount ?? 0)
        .reduce((a, b) => a + b, 0);
      const needsNumbering = c.blocIds.length > 1;
      if (needsNumbering && !c.numbering?.length) {
        return fail(
          'Closes.DuplicateAdresseNumero',
          'Cette close réunit plusieurs blocs : son plan de numérotation est obligatoire.',
        ).pipe(delay(LATENCY_MS));
      }
      if (c.numbering && c.numbering.length !== expected) {
        return fail(
          'Closes.NumberingIncomplete',
          'Le plan ne couvre pas toutes les parcelles de la close.',
        ).pipe(delay(LATENCY_MS));
      }
      const numeros = (c.numbering ?? []).map((n) => n.numero);
      if (new Set(numeros).size !== numeros.length) {
        return fail('Closes.DuplicateAdresseNumero', 'Deux parcelles portent le même numéro.').pipe(delay(LATENCY_MS));
      }
    }

    const created = payload.closes.map((c) => {
      const street = this.streets.find((s) => s.id === c.streetId);
      const mock: MockClose = {
        id: `close-${String(this.nextId++).padStart(4, '0')}`,
        quartierId, streetId: c.streetId,
        streetCode: street?.code ?? 'STR-????', streetName: street?.name ?? null,
        number: c.number, code: c.code, blocIds: [...c.blocIds],
      };
      this.closes = [...this.closes, mock];
      return mock;
    });

    const blocsAttached = created.reduce((n, c) => n + c.blocIds.length, 0);
    const adressesRenumbered = payload.closes.reduce((n, c) => n + (c.numbering?.length ?? 0), 0);

    // L'avancement du quartier bouge : la liste doit le refléter au retour.
    this.progress = this.progress.map((p) => (p.quartierId === quartierId
      ? {
        ...p,
        blocsWithClose: p.blocsWithClose + blocsAttached,
        blocsRemaining: Math.max(0, p.blocsRemaining - blocsAttached),
        closesCount: p.closesCount + created.length,
      }
      : p));

    return of({
      closesCreated: created.length,
      blocsAttached,
      adressesRenumbered,
      closes: created.map((c) => this.toClose(c)),
    }).pipe(delay(LATENCY_MS));
  }
}
