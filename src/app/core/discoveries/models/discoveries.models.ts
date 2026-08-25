import { ISODateTime, UUID } from '../../models/das.models';

/**
 * Statut d'un signalement de terrain. **Chaîne PascalCase**, en lecture comme en query
 * (CLAUDE.md §6) — contrairement à `workflowStage` de l'adresse, qui se lit en minuscules.
 * Les deux cohabitent dans le même front : ne pas uniformiser de tête.
 */
export type DiscoveryStatus = 'Pending' | 'Accepted' | 'Rejected';

export const DISCOVERY_STATUSES: readonly DiscoveryStatus[] = ['Pending', 'Accepted', 'Rejected'];

/**
 * Signalement remonté par un agent : une construction qu'il voit sur le terrain et qui
 * n'appartient à aucune de ses parcelles à relever. C'est le canal montant qui répond à la
 * faille `A1` — sans lui, une construction hors cadastre n'était signalable nulle part.
 *
 * **Accepter un signalement ne crée pas d'adresse.** Le point entre dans la file exportée à
 * l'expert GIS, qui produira l'emprise ; la parcelle naîtra de sa livraison. Rien ici n'écrit
 * dans `/api/adresses`, et l'écran ne doit pas laisser croire le contraire.
 */
export interface DiscoveryReport {
  id: UUID;
  campaignId: UUID;
  agentId: UUID;
  agentFullName: string;
  /**
   * Bloc **déclaré** par l'agent. Aide au tri, **sans valeur d'autorité** : seule
   * `locationWkt` fait foi. Facultatif — l'agent peut signaler hors de tout bloc connu.
   */
  blocId: UUID | null;
  blocCode: string | null;
  /** `POINT(lng lat)`, SRID 4326. La position qui fait foi. */
  locationWkt: string;
  /** Précision GPS en mètres au moment de la capture. `null` si l'appareil ne l'a pas fournie. */
  gpsAccuracyM: number | null;
  comment: string | null;
  /** Horodatage de la capture sur le terrain — peut précéder `createdAtUtc` de plusieurs jours (saisie hors réseau). */
  capturedAtUtc: ISODateTime;
  /** Horodatage de la réception serveur. L'écart avec `capturedAtUtc` mesure le temps hors ligne. */
  createdAtUtc: ISODateTime;
  status: DiscoveryStatus;
  reviewedByUserId: UUID | null;
  reviewedAtUtc: ISODateTime | null;
  rejectionReason: string | null;
}

export interface DiscoveryQuery {
  campaignId: UUID | null;
  /** `null` = tous statuts. La file de tri du Gestionnaire, elle, filtre sur `Pending`. */
  status: DiscoveryStatus | null;
}

/** Feature du GeoJSON d'export. Typé au strict nécessaire : le front ne fait que le transmettre à l'expert. */
export interface DiscoveryFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: number[] };
  properties: Record<string, unknown>;
}

export interface DiscoveryFeatureCollection {
  type: 'FeatureCollection';
  features: DiscoveryFeature[];
}
