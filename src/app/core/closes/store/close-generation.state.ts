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
 * Sous l'index unique `(quartier, rue)`, une close est TOUTE la façade d'une rue dans un
 * quartier : **une close hérite de la longueur de sa rue.** Un axe de 214 km ramasse tout ce
 * qu'il croise à moins de 50 m, sur des kilomètres. C'est là qu'était la close « dispersée ».
 *
 * ⚠️ **Ce que le préfixe ne peut pas exprimer.** 13 rues nommées `OSM-<NOM>` sont aussi des axes
 * interurbains (`OSM-ASSAMO-ALI-ADDE`, 28 km), mais ce préfixe couvre également les rues urbaines
 * — `OSM-148704475` porte la close `Q7-02`. Les exclure demanderait un plafond de LONGUEUR, que
 * `QuartierClosePlanParameters` n'expose pas : c'est une évolution à demander au back.
 *
 * `maxBlocGapMeters` passe de 100 à **25 m**. Mesuré le 2026-09-06 sur les 7 115 blocs : l'écart
 * au bloc voisin le plus proche vaut **4,2 m en médiane et 16,6 m au 9ᵉ décile**. Le seuil de
 * 100 m enjambait donc six fois l'écart courant — il laissait une close franchir une rue entière
 * et se souder au tissu d'en face. À 25 m il coupe les vraies discontinuités sans casser
 * l'adjacence normale.
 *
 * Effet mesuré des deux corrections réunies, sur Djibouti :
 *
 *   solidité médiane (aire / enveloppe convexe)   0,842  →  0,936
 *   blocs de la plus grosse close                 1 068  →  21
 *   groupes s'étalant sur plus de 300 m             178  →  100
 *   closes sans aucune interpénétration       507 / 1 741  →  1 466 / 2 783   (29 % → 53 %)
 */
export const PARAMETRES_PAR_DEFAUT: Partial<QuartierClosePlanParameters> = {
  maxDistanceMeters: 50,
  maxBlocGapMeters: 25,
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
