/**
 * Lecture du code d'erreur métier renvoyé par l'API et traduction en clé i18n.
 *
 * CLAUDE.md §6 : une erreur métier est `{ code, message }` et se teste sur `code`, JAMAIS sur
 * `message` (qui est du texte back, non traduit et libre de changer). Ce module est le seul
 * endroit du front qui sait où trouver ce `code` — la règle était jusqu'ici recopiée dans
 * trois fichiers.
 *
 * ⚠️ Ne couvre PAS `ValidationProblemDetails` (clés PascalCase, forme `errors: {...}`), qui est
 * une 400 de validation et non une erreur métier : elle n'a pas de `code`.
 */

/** Table `code back → clé i18n`. Déclarée à côté de l'effet qui l'utilise, pas centralisée : les codes sont propres à un module. */
export type ErrorKeyMap = Readonly<Record<string, string>>;

/**
 * Deux formes coexistent dans ce repo et doivent être lues toutes les deux :
 * - `err.error.code` — `HttpErrorResponse` réelle, le corps est sous `.error` ;
 * - `err.code` — `throwError` direct des services mock, qui n'enveloppe pas.
 *
 * C'est ce qui permet au même effet d'être correct avec `useMockApi` à `true` comme à `false`
 * (CLAUDE.md §3.4) : sans la seconde forme, aucun cas d'erreur ne serait testable en mock.
 */
export function errorCode(err: unknown): string | undefined {
  const e = err as { error?: { code?: string }; code?: string } | null | undefined;
  return e?.error?.code ?? e?.code;
}

/**
 * Clé i18n du code porté par `err`, ou `fallbackKey` si le code est inconnu / absent.
 *
 * Le repli est volontairement générique : un code non mappé n'est pas une erreur de
 * programmation, c'est un cas que l'écran n'a pas de conseil particulier à donner dessus.
 */
export function toErrorKey(err: unknown, keyByCode: ErrorKeyMap, fallbackKey = 'common.error'): string {
  return keyByCode[errorCode(err) ?? ''] ?? fallbackKey;
}
