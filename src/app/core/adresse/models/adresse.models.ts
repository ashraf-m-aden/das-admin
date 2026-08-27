import {
  UUID, ISODateTime, AddressWorkflowStage, OccupancyType, GeoJSONMultiPolygon,
} from '../../models/das.models';
import { AddressUnit } from '../../units/models/units.models';
import { AdresseSurvey } from '../../review/models/review.models';

/**
 * Ligne du registre des adresses.
 * Rappel domaine : `postcode` appartient au QUARTIER de l'adresse ; `zone`
 * est la zone (postale) qui regroupe des quartiers.
 * `geom` est toujours `null` côté API réelle (la carte vient des tuiles Martin) ;
 * seul le mock le peuple pour simuler un overlay carte hors `useMockApi()`.
 */
export interface AddressListItem {
  id: UUID;
  addressCode: string | null; // null tant que pas validé Definitive (cf. §5 CLAUDE.md)
  libelle: string;            // libellé humain, toujours présent — repli d'affichage quand addressCode est null
  postcode: string | null;   // code postal du quartier de l'adresse
  zone: string | null;       // zone (regroupe des quartiers)
  /**
   * Voie de la parcelle : nom de la rue, à défaut « close N », à défaut le code de la close.
   * Rempli par le back depuis le 2026-08-23 — c'est la `Close`, portion de rue dans un quartier,
   * qui a créé la liaison adresse↔rue qui manquait (faille `D1`). Reste `null` tant que le bloc
   * de la parcelle n'est rattaché à aucune close : on n'y met JAMAIS le bloc en repli, un bloc
   * n'est pas une voie.
   */
  street: string | null;
  quartier: string;
  /**
   * Libellé FR du catalogue `TypeOccupation` du DERNIER RELEVÉ — à afficher brut, ce n'est pas
   * un enum fermé. `null` tant qu'aucun relevé n'a été fait, c'est-à-dire partout aujourd'hui :
   * le back le déclare `string?`, le typer non-nullable affichait « undefined » en clair.
   */
  propertyType: string | null;
  workflowStage: AddressWorkflowStage;
  /** `null` sans relevé — `DateTime?` côté back. Une date nulle ne se formate pas. */
  lastUpdate: ISODateTime | null;
  assignedTeamName: string | null;
  geom: GeoJSONMultiPolygon;
}

/** Composantes hiérarchiques d'une adresse (fiche détail). */
export interface AddressComponents {
  /** Même chaîne de repli que `AddressListItem.street`, et `null` dans les mêmes cas. */
  street: string | null;
  quartierNom: string;   // le back envoie `quartierNom` (pas `quartier`)
  /** `null` : zone et commune sont FACULTATIVES (CLAUDE.md §5), le back les déclare `string?`. */
  zone: string | null;
  commune: string | null;
  /** Nom de la VILLE, malgré son nom — `Region` côté back. */
  region: string;
  postcode: string | null;
}

export interface AddressLocation {
  latitude: number;
  longitude: number;
  parcelNumber: string;  // = le `numero` de l'adresse (même donnée, pas un champ séparé)
}
export interface AddressPropertyInfo {
  propertyType: string | null;
  /**
   * **Toujours `null`** : le régime d'occupation (propriétaire/locataire/vacant) n'est relevé
   * nulle part. À ne pas confondre avec `EtatOccupation`, qui est l'état du bâti. La ligne est
   * masquée dans le tiroir — l'afficher rendait la clé i18n `adresse.occupancy.null` en clair.
   */
  occupancyType: OccupancyType | null;
  buildingUse: string | null;
}

/** Production de l'AGENT qui a relevé, pas une note sur l'adresse — bloc masqué (décision C.2). */
export interface AddressValidation {
  /** Nombre de relevés de l'agent sur la campagne. `null` sans relevé. */
  score: number | null;
  /** Part de sa charge couverte — **peut dépasser 100** après une réaffectation. */
  percentage: number | null;
  /** Toujours `null` : pas de champ de commentaire libre sur l'adresse. */
  notes: string | null;
}

export type LinkedRecordKind = 'postcode' | 'block' | 'street' | 'team';
export interface LinkedRecord { id: UUID; kind: LinkedRecordKind; label: string; }

/**
 * Adresse enrichie pour le tiroir de détail. Pas d'onglet historique : `history` toujours vide.
 *
 * ⚠️ L'`Omit` n'est pas cosmétique. `GET /api/adresses/{id}` ne renvoie **ni `zone`, ni `street`,
 * ni `quartier`, ni `propertyType`** au premier niveau : ces informations passent par
 * `components` et `propertyInfo`. En héritant de `AddressListItem` sans les retirer, le type
 * promettait quatre champs toujours `undefined` — et le tiroir affichait un titre vide, parce
 * qu'il lisait `d.quartier` là où le back envoie `components.quartierNom`. TypeScript ne pouvait
 * rien signaler : la réponse HTTP est castée, jamais vérifiée.
 */
export interface AddressDetail extends Omit<AddressListItem, 'zone' | 'street' | 'quartier' | 'propertyType'> {
  /** Numéro de l'adresse, unique dans sa CLOSE depuis le 2026-08-23 (plus dans le bloc) — champ à éditer via `update()`. */
  numero: number;
  /**
   * Emprise MULTIPOLYGON/POLYGON WKT (SRID 4326) telle que renvoyée par le back.
   * À ne JAMAIS reconstruire depuis la tuile vectorielle (simplifiée, découpée aux bords) —
   * seule cette valeur est renvoyable telle quelle sur `PATCH /api/adresses/{id}`.
   */
  boundaryWkt: string;
  /**
   * Bloc de rattachement — découpage de TRAVAIL, pas d'adressage. Reste dans la fiche parce que
   * c'est par lui qu'on retrouve l'agent qui a relevé la parcelle.
   */
  blocId: UUID;
  blocCode: string;
  blocName: string | null;
  /** `QuartierNom` et `CityName` du back : la réponse détail ne renvoie PAS `quartier` tout court. */
  quartierNom: string;
  cityName: string;
  /** Point d'accroche WKT — distinct de `boundaryWkt`, c'est lui qui porte le centroïde. */
  locationWkt: string;
  /** Close de la parcelle — celle qui la nomme. `null` tant que son bloc n'y est pas rattaché. */
  closeId: UUID | null;
  /** Code technique de la close. `null` quand la parcelle n'a pas de close. */
  closeCode: string | null;
  /** Nom BRUT de la rue, `null` aussi quand la rue n'est pas encore nommée — c'est `components.street` qui porte le repli. */
  streetName: string | null;
  components: AddressComponents;
  location: AddressLocation;
  propertyInfo: AddressPropertyInfo;
  validation: AddressValidation;
  linked: LinkedRecord[];
  /** Unités de l'immeuble (`/api/units?adresseId=`) — vide pour une maison individuelle. */
  units: AddressUnit[];
  /**
   * Relevés terrain de la parcelle avec leurs photos (`/api/surveys?adresseId=` puis
   * `/api/surveys/{id}/photos`). Composé par l'effet, comme `units` — la réponse détail ne les
   * porte pas. Vide tant qu'aucun agent n'est passé, ce qui est le cas partout aujourd'hui.
   */
  surveys: AdresseSurvey[];
}

/** `PATCH /api/adresses/{id}` : remplacement complet malgré le verbe — `boundaryWkt` doit être renvoyé même inchangé. */
export interface UpdateAdressePayload {
  numero: number;
  boundaryWkt: string;
}

/** Filtres du registre. Déclaration UNIQUE (fin des doublons). */
export interface AdresseFilters {
  search: string;
  postcode: string | null;   // conservé (inutilisé) — filtrage géo déplacé vers la hiérarchie
  zone: string | null;       // idem
  region: string | null;     // idem
  status: AddressWorkflowStage | null;
  team: string | null;
  cityId: UUID | null;
  communeId: UUID | null;
  zoneId: UUID | null;
  quartierId: UUID | null;
  /**
   * Close de la parcelle — la portion de rue qui la nomme. Niveau de filtre le plus fin depuis
   * le retrait du bloc (2026-08-25) : un bloc est une unité de travail, pas d'adressage.
   */
  closeId: UUID | null;
}

/** Options de filtre alimentant les selects. Déclaration UNIQUE. */
export interface AdresseFilterOptions {
  postcodes: string[];
  zones: string[];
  regions: string[];
  teams: string[];
}

/** Une des 5 étapes, toujours renvoyée même à 0 — la somme des `count` vaut exactement `totalRecords`. */
export interface WorkflowStageCount {
  stage: AddressWorkflowStage;
  count: number;
}

export interface AdresseSummary {
  totalRecords: number;
  pendingReview: number;
  duplicatesFlagged: number;
  publishedToday: number;
  workflowBreakdown: WorkflowStageCount[];
}

export interface AdressePageResult {
  items: AddressListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdresseQuery {
  filters: AdresseFilters;
  page: number;
  pageSize: number;
}

/** `PATCH /bulk` : casse PascalCase obligatoire, uniquement Approved | Published (pas de changement d'équipe en masse). */
export interface BulkUpdatePayload {
  ids: UUID[];
  stage: 'Approved' | 'Published';
}

export const WORKFLOW_STAGES: AddressWorkflowStage[] = ['registered', 'surveyed', 'verified', 'approved', 'published'];
