import { Observable } from 'rxjs';
import { UUID } from '../../models/das.models';
import {
  AdresseNumbering, ApplyQuartierClosesPayload, AppliedQuartierCloses, Close, CloseListQuery,
  CloseNumberingPlan, CloseStreetOption, CreateClosePayload, QuartierClosePlan,
  QuartierClosePlanParameters, QuartierCloseProgress, UpdateClosePayload,
} from '../models/closes.models';

export abstract class ClosesApiPort {
  abstract list(query: CloseListQuery): Observable<Close[]>;
  /** `GET /api/streets` — une close exige une rue, c'est elle qui nomme l'adresse. */
  abstract listStreets(): Observable<CloseStreetOption[]>;

  /**
   * `PATCH /api/streets/{id}` — nomme une rue sans quitter l'écran des closes.
   * Prend l'option complète et non le seul id : le PATCH est un REMPLACEMENT, il faut renvoyer
   * `code` et `type` inchangés sous peine de les écraser.
   */
  abstract renameStreet(street: CloseStreetOption, name: string): Observable<CloseStreetOption>;
  abstract getById(id: UUID): Observable<Close>;
  abstract create(payload: CreateClosePayload): Observable<Close>;
  abstract update(id: UUID, payload: UpdateClosePayload): Observable<Close>;
  abstract remove(id: UUID): Observable<void>;
  /**
   * `POST /api/closes/{id}/blocs/preview` — **n'écrit rien**. Propose un numéro par parcelle de la
   * close résultante, avec sa position et sa géométrie, pour validation sur carte.
   * `blocIds` peut être vide : on obtient alors une proposition pour la close telle qu'elle est.
   */
  abstract previewAttachBlocs(id: UUID, blocIds: UUID[], reverse: boolean): Observable<CloseNumberingPlan>;

  /**
   * `POST /api/closes/{id}/blocs`. Sans `numbering`, refusé (409 `Closes.DuplicateAdresseNumero`)
   * dès que la réunion des blocs produirait des numéros en double — ce qui est le cas courant.
   * Avec `numbering`, rattachement et renumérotation se font dans la MÊME transaction.
   */
  abstract attachBlocs(id: UUID, blocIds: UUID[], numbering?: AdresseNumbering[]): Observable<Close>;
  /** `DELETE /api/closes/{id}/blocs/{blocId}` — un bloc à la fois. */
  abstract detachBloc(id: UUID, blocId: UUID): Observable<Close>;

  /* ---------------------------------------------------------------------------------------
   * GÉNÉRATION PAR QUARTIER — écran de reprise.
   * Trois routes, dans l'ordre d'usage : où en est-on, que propose-t-on, qu'écrit-on.
   * ------------------------------------------------------------------------------------ */

  /**
   * `GET /api/quartiers/closes-progress` — avancement de chaque quartier.
   * Sert la liste d'entrée de l'écran ; ne charge aucune géométrie.
   */
  abstract listQuartierProgress(): Observable<QuartierCloseProgress[]>;

  /**
   * `POST /api/quartiers/{quartierId}/closes/preview` — **n'écrit rien.**
   * `params` partiel : le back applique ses défauts et renvoie ce qu'il a retenu dans
   * `plan.parameters`, qui peut donc différer de ce qui a été demandé.
   *
   * Le plan renvoyé est VOLONTAIREMENT léger : par close, un compteur d'adresses et un drapeau
   * de collision, pas le détail des numéros — cf. `previewProposalNumbering`.
   */
  abstract previewQuartierCloses(
    quartierId: UUID,
    params: Partial<QuartierClosePlanParameters>,
  ): Observable<QuartierClosePlan>;

  /**
   * `POST /api/quartiers/{quartierId}/closes/preview/{key}/numbering` — **n'écrit rien.**
   * Plan de numérotation d'UNE proposition, à son ouverture. Même forme que
   * `previewAttachBlocs`, donc le composant de numérotation existant le lit tel quel.
   *
   * `reverse` inverse le sens de parcours quand le plan commence par le mauvais bout.
   */
  abstract previewProposalNumbering(
    quartierId: UUID,
    key: string,
    reverse: boolean,
  ): Observable<CloseNumberingPlan>;

  /**
   * `POST /api/quartiers/{quartierId}/closes` — écrit closes, rattachements et numéros dans UNE
   * transaction. Prend le plan RELU, jamais un identifiant de plan que le serveur recalculerait.
   *
   * Échecs métier à tester par `code` : `Closes.DuplicateAdresseNumero` (plan de numérotation
   * absent ou incomplet), `Closes.PlanStale` (un bloc a été rattaché entre l'aperçu et la
   * confirmation) — dans ce dernier cas, relancer l'aperçu et montrer l'écart, pas réessayer.
   */
  abstract applyQuartierCloses(
    quartierId: UUID,
    payload: ApplyQuartierClosesPayload,
  ): Observable<AppliedQuartierCloses>;
}
