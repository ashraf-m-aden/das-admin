import { UUID } from '../../models/das.models';

/**
 * Une clé d'accès au référentiel PUBLIC — carte, tuiles et recherche — délivrée à un consommateur
 * externe.
 *
 * ⚠️ **`secret` n'est renseigné qu'à la création.** Le back ne stocke que le préfixe et une
 * empreinte SHA-256 : la clé en clair n'existe qu'une fois, dans la réponse de `POST`. Elle ne
 * peut pas être relue — une clé perdue se révoque et se remplace.
 */
export interface CleApi {
  id: UUID;
  /** À qui la clé est délivrée. */
  consommateur: string;
  /** Les premiers caractères, en clair : ils identifient la clé sans la révéler. */
  prefixe: string;
  createdAtUtc: string;
  revokedAtUtc: string | null;
  /** Écrit au plus une fois par heure côté back — pas à chaque tuile demandée. */
  lastUsedAtUtc: string | null;
  estActive: boolean;
  /** Uniquement dans la réponse de création. `null` ou absent partout ailleurs. */
  secret?: string | null;
}

export interface CreerCleApiPayload {
  consommateur: string;
}
