/**
 * Dates « calendaires » de Djibouti — les dates limites de campagne.
 *
 * ⚠️ Ce ne sont PAS des instants UTC (CLAUDE.md §6). Une date limite est une date à minuit
 * **heure de Djibouti (UTC+3)** : le 2026-09-30 court jusqu'au 2026-09-30 23:59 locale, soit
 * 2026-09-30 20:59 UTC. La comparer naïvement en UTC déclare une campagne en retard trois
 * heures trop tôt — et, pour quelqu'un qui travaille à Djibouti, un jour trop tôt le soir.
 *
 * Djibouti n'observe pas l'heure d'été : le décalage est constant, une constante suffit donc
 * et il n'y a pas besoin d'embarquer une base de fuseaux.
 */

/** Décalage de Djibouti, en minutes. Constant toute l'année (pas d'heure d'été). */
const DJIBOUTI_OFFSET_MIN = 3 * 60;

/** Instant UTC correspondant à la FIN du jour `yyyy-MM-dd` à Djibouti. */
function endOfDayUtc(dateCalendaire: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateCalendaire);
  if (!m) return null;
  const [, y, mo, d] = m;
  // Minuit du LENDEMAIN heure locale = fin du jour courant.
  const minuitLendemainUtc = Date.UTC(Number(y), Number(mo) - 1, Number(d) + 1);
  return minuitLendemainUtc - DJIBOUTI_OFFSET_MIN * 60_000;
}

/** `true` si la date limite est passée à l'instant `maintenant` (défaut : maintenant). */
export function isDeadlinePassed(dateCalendaire: string | null, maintenant = Date.now()): boolean {
  if (!dateCalendaire) return false;
  const fin = endOfDayUtc(dateCalendaire);
  return fin !== null && maintenant > fin;
}

/**
 * Jours restants avant la date limite — négatif si elle est dépassée, `null` si la date est
 * absente ou illisible. Arrondi vers le haut : tant qu'il reste une heure, il reste « 1 jour ».
 */
export function daysUntilDeadline(dateCalendaire: string | null, maintenant = Date.now()): number | null {
  if (!dateCalendaire) return null;
  const fin = endOfDayUtc(dateCalendaire);
  if (fin === null) return null;
  return Math.ceil((fin - maintenant) / 86_400_000);
}
