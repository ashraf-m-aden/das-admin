import { UUID } from '../../models/das.models';
import {
  CloseNumberingPlan, CloseStreetOption, ProposedClose, QuartierClosePlan,
  QuartierClosePlanParameters, QuartierCloseProgress,
} from '../models/closes.models';
import { LoadStatus } from './closes.state';

/**
 * Modification apportée par l'opérateur à UNE proposition. Ne remplace pas la proposition : se
 * superpose à elle, pour qu'un nouvel aperçu ne fasse pas perdre le travail de relecture… et pour
 * qu'on puisse toujours montrer l'écart entre ce que la machine proposait et ce qu'on garde.
 */
export interface ProposedCloseEdit {
  streetId?: UUID;
  number?: number;
  code?: string;
  /** Liste complète après retrait/ajout, jamais un delta : plus simple à relire, plus dur à casser. */
  blocIds?: UUID[];
}

export interface CloseGenerationState {
  /** Liste d'entrée : où en est chaque quartier. Chargée une fois. */
  progress: QuartierCloseProgress[];
  progressStatus: LoadStatus;

  quartierId: UUID | null;

  /** Réglages DEMANDÉS. Ceux réellement appliqués sont dans `plan.parameters`, et peuvent différer. */
  parameters: Partial<QuartierClosePlanParameters>;

  plan: QuartierClosePlan | null;
  isPreviewing: boolean;

  /** Corrections par clé de proposition. */
  edits: Record<string, ProposedCloseEdit>;
  /** Propositions écartées : on ne les créera pas. Distinct d'une proposition vidée de ses blocs. */
  discardedKeys: string[];

  /** Référentiel plat des rues, pour le changement de rue et le renommage en ligne. */
  streets: CloseStreetOption[];

  /* -- Plan de numérotation de la proposition ouverte -------------------------------------- */

  /** Clé de la proposition dont on regarde le plan. `null` = aucun plan ouvert. */
  numberingKey: string | null;
  numbering: CloseNumberingPlan | null;
  /** Corrections manuelles de numéros : `adresseId → numéro`. */
  numberingEdits: Record<UUID, number>;
  numberingReverse: boolean;
  isNumbering: boolean;

  /**
   * Propositions dont le plan de numérotation a été OUVERT et relu.
   *
   * 345 closes sur 531 réunissent des parcelles aux numéros en double : les confirmer sans avoir
   * regardé leur plan reviendrait à écrire des numéros que personne n'a vus, alors qu'ils finiront
   * figés dans un code d'adresse. C'est cette liste qui conditionnera la confirmation.
   */
  reviewedKeys: string[];

  /** Erreur métier, mappée depuis le `code` (jamais depuis le `message`). */
  errorMessageKey: string | null;
}

/**
 * Réglages envoyés par défaut. **Explicites, et non `{}`.**
 *
 * L'écran ne postait que `maxDistanceMeters` : le back appliquait ses propres valeurs pour le
 * reste, sans que rien à l'écran ne dise lesquelles. C'est la même leçon que `validationType`
 * sur les relevés — un champ absent laisse le serveur choisir, et le choix ne se voit pas.
 *
 * `excludeStreetCodePrefixes` est le correctif des propositions « dispersées » constatées sur
 * Quartier 7 le 2026-09-05 : `SIG-RT*` sont les routes nationales et `SIG-PI*` les pistes de
 * désert versées le 2026-09-04. Sans exclusion, **693 blocs sur 5 121** s'y rattachaient, et une
 * piste traversant un quartier ramassait des blocs sur des kilomètres. Mesuré : les groupes
 * s'étalant sur plus d'un kilomètre passent de 18 à 8, le pire cas de 2 345 m à 1 803 m.
 *
 * ---------------------------------------------------------------------------------------------
 * 2026-09-06 — LA LISTE ÉTAIT INCOMPLÈTE, ET C'ÉTAIT LA CAUSE PRINCIPALE
 * ---------------------------------------------------------------------------------------------
 * Elle ne couvrait que les préfixes `SIG-`. Or l'import OSM du réseau national porte des codes
 * `OSM-ROUTE-*` / `OSM-PISTE-*`, et la voirie SIG un `SIG-VE-*`. Trois axes passaient donc au
 * travers, dont **`OSM-ROUTE-NATIONALE-1`, longue de 214 km**, et `SIG-VE-00001` de 98 km.
 *
 * ⚠️ **Rectificatif du 2026-09-09** : ce n'est pas l'index unique qui l'impose. `(QuartierId,
 * StreetId)` interdit seulement à deux closes de partager la même ENTITÉ `Street` ; scinder la
 * voie en tronçons distincts donne des `StreetId` différents, donc plusieurs closes courtes le
 * long d'une même voie physique. La cause réelle est que l'appariement fusionne les blocs
 * pointant vers une même rue **sans borner leur diamètre**, et que `Street` est aujourd'hui une
 * entité par voie entière. Un axe de 214 km ramasse alors tout ce qu'il croise à moins de 50 m,
 * sur des kilomètres. Cf. `docs/plans/generation-closes.md` §8.
 *
 * ⚠️ **Ce que le préfixe ne peut pas exprimer.** 13 rues nommées `OSM-<NOM>` sont aussi des axes
 * interurbains (`OSM-ASSAMO-ALI-ADDE`, 28 km), mais ce préfixe couvre également les rues urbaines
 * — `OSM-148704475` porte la close `Q7-02`. Les exclure demanderait un plafond de LONGUEUR, que
 * `QuartierClosePlanParameters` n'expose pas : c'est une évolution à demander au back.
 *
 * ⚠️ **`maxBlocGapMeters` : 25 m essayé le 2026-09-06, REVENU à 100 m le 2026-09-09.**
 *
 * La valeur de 25 m s'appuyait sur l'écart au bloc voisin le plus proche — 4,2 m en médiane,
 * 16,6 m au 9ᵉ décile. La mesure était juste, la conclusion fausse : ce n'est pas la bonne
 * distance. Deux blocs consécutifs le long d'une avenue sont séparés par une rue TRANSVERSALE,
 * soit 20 à 40 m, alors que l'écart au plus proche voisin est LATÉRAL, entre blocs mitoyens. À
 * 25 m le groupe est donc coupé à chaque croisement.
 *
 * Mesuré le 2026-09-09 sur les six quartiers du centre — 811 blocs, 6 303 adresses, les seuls
 * traitables aujourd'hui faute de nommage ailleurs :
 *
 *   maxBlocGapMeters   closes   dont a 1 bloc   adresses medianes
 *                 25      252             118          13
 *                 60      196              81          16
 *                100      180              74          18
 *                150      168              61          18
 *
 * Sur une trame régulière, 100 m est nettement meilleur. Sur le tissu spontané de Balbala,
 * l'inverse : 25 m y donnait 1 466 closes sans interpénétration contre 1 069 à 100 m. **Le bon
 * réglage dépend du quartier** — l'écran expose le champ, l'opérateur l'ajuste. Le défaut suit
 * les quartiers effectivement traitables aujourd'hui.
 *
 * Effet mesuré de l'exclusion complétée, sur Djibouti (chiffres obtenus AVEC l'écart à 25 m,
 * donc représentatifs de Balbala et non du centre) :
 *
 *   solidité médiane (aire / enveloppe convexe)   0,842  →  0,936
 *   blocs de la plus grosse close                 1 068  →  21
 *   groupes s'étalant sur plus de 300 m             178  →  100
 *   closes sans aucune interpénétration       507 / 1 741  →  1 466 / 2 783   (29 % → 53 %)
 */
export const PARAMETRES_PAR_DEFAUT: Partial<QuartierClosePlanParameters> = {
  maxDistanceMeters: 50,
  maxBlocGapMeters: 100,
  excludeStreetCodePrefixes: [
    'SIG-RT1-', 'SIG-RT2-', 'SIG-PI1-', 'SIG-PI2-',
    'SIG-VE-',        // 6 voies, jusqu'à 98 km — voirie SIG hors agglomération
    'OSM-ROUTE-',     // routes nationales OSM, jusqu'à 214 km
    'OSM-PISTE-',     // pistes de désert OSM, jusqu'à 62 km
  ],
};

export const initialCloseGenerationState: CloseGenerationState = {
  progress: [],
  progressStatus: 'idle',
  quartierId: null,
  parameters: PARAMETRES_PAR_DEFAUT,
  plan: null,
  isPreviewing: false,
  edits: {},
  discardedKeys: [],
  streets: [],
  numberingKey: null,
  numbering: null,
  numberingEdits: {},
  numberingReverse: false,
  isNumbering: false,
  reviewedKeys: [],
  errorMessageKey: null,
};

/** La proposition telle qu'elle est APRÈS relecture — c'est elle qu'on affiche et qu'on enverra. */
export function applyEdit(proposal: ProposedClose, edit: ProposedCloseEdit | undefined): ProposedClose {
  if (!edit) return proposal;
  const blocs = edit.blocIds
    ? proposal.blocs.filter((b) => edit.blocIds!.includes(b.id))
    : proposal.blocs;
  return {
    ...proposal,
    streetId: edit.streetId ?? proposal.streetId,
    number: edit.number ?? proposal.number,
    code: edit.code ?? proposal.code,
    blocs,
    // Recalculés localement : le back ne les recalcule qu'au prochain aperçu, et l'écran doit
    // refléter le retrait d'un bloc tout de suite.
    adresseCount: blocs.reduce((n, b) => n + b.adresseCount, 0),
  };
}
