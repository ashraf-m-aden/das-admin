import { Observable } from 'rxjs';
import { UUID } from '../../models/das.models';
import { CleApi, CreerCleApiPayload } from '../models/cles-api.models';

/**
 * Accès aux clés du référentiel public — **le socle du contrôle d'accès** (décision du
 * 2026-09-10, `docs/plans/referentiel-public.md` §1).
 *
 * ⚠️ `core/clients` porte un `ApiTokenItem` et un onglet « jeton d'API » : c'est un contrat sans
 * implémentation, servi par un mock. Ne pas y bâtir un second système de jetons — cet onglet doit
 * un jour déléguer ici.
 * Trois routes, protégées côté back par les permissions
 * `public_keys.view` et `public_keys.manage` — délivrer une clé, c'est ouvrir le référentiel à
 * un tiers.
 */
export abstract class ClesApiPort {
  /** `GET /api/cles-api`. Ne rend jamais de secret : il n'en existe aucun en base. */
  abstract list(): Observable<CleApi[]>;

  /**
   * `POST /api/cles-api`. ⚠️ La réponse contient le SECRET EN CLAIR — la seule fois où il existe
   * hors du client. Il doit être montré immédiatement, et l'écran doit dire qu'il ne reviendra pas.
   */
  abstract creer(payload: CreerCleApiPayload): Observable<CleApi>;

  /** `POST /api/cles-api/{id}/revoquer`. La ligne est conservée : une clé retirée reste une trace. */
  abstract revoquer(id: UUID): Observable<void>;
}
