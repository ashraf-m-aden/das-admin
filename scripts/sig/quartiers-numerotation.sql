-- Rattache 21 quartiers de Djibouti-ville à une zone, et leur attribue un AreaNumber.
--
--   Simulation (par défaut, n'écrit RIEN) :
--     psql "$DB" -v ON_ERROR_STOP=1 -f scripts/sig/quartiers-numerotation.sql
--
--   Application :
--     psql "$DB" -v ON_ERROR_STOP=1 -v appliquer=1 -f scripts/sig/quartiers-numerotation.sql
--
-- ==============================================================================================
-- LA GRAMMAIRE DU PLAN, RELEVÉE LE 2026-09-11
-- ==============================================================================================
-- Le code postal fait cinq chiffres : le `Code` de la ville (77 pour Djibouti) suivi de
-- l'`AreaNumber` du quartier, sur trois chiffres.
--
--   Héron 77101 · Marabout 77102 · Cité Saoudienne 77201 · …
--
-- ⚠️ La CENTAINE n'est pas un rang, c'est la ZONE. Le code de zone le dit littéralement :
--
--   Z1 Ras-Dika   → 1xx      Z4 Boulaos 3 → 4xx      Z9 Aires spéciales → 9xx
--   Z2 Boulaos 1  → 2xx      Z5 Balbala 1 → 5xx
--   Z3 Boulaos 2  → 3xx      Z6 Balbala 2 → 6xx
--
-- Attribuer un numéro et rattacher à une zone ne sont donc PAS deux gestes : c'est le même,
-- et les écrire séparément laisserait les deux diverger. D'où ce script unique.
--
-- ⚠️ La règle est une CONVENTION, pas une contrainte du schéma — et elle a déjà un écart :
-- « Wahladaba Sud » porte le numéro 605 tout en étant rattaché à Balbala 1 (Z5). Il n'est pas
-- corrigé ici : ce script ajoute, il ne réécrit pas l'existant.
--
-- ==============================================================================================
-- COMMENT CES VALEURS ONT ÉTÉ CHOISIES
-- ==============================================================================================
-- 1. La zone est cherchée UNIQUEMENT parmi celles de la commune du quartier. `Zones.CommuneId`
--    est obligatoire : une zone d'une autre commune serait illégale. Cette contrainte n'est pas
--    cosmétique — sans elle, « Brise de mer 1 » (commune Ras-Dika) partait en 2xx parce que son
--    voisin le plus proche appartient à Boulaos.
-- 2. Parmi ces zones, celle dont l'étendue — l'union des emprises de ses quartiers, les zones
--    n'ayant pas de géométrie propre — est la plus proche. Les 21 sont CONTIGUS à la leur,
--    distance nulle : aucun rattachement n'a été décidé par défaut.
-- 3. Le numéro est le premier libre de la centaine, les quartiers les plus peuplés d'abord.
--
-- ⚠️ Les valeurs sont écrites en dur, et non recalculées à l'exécution. Ce sont celles qui ont
-- été relues et validées ; un recalcul silencieux sur une base qui a bougé donnerait autre chose
-- que ce qui a été approuvé.
-- ==============================================================================================

\if :{?appliquer}
\else
  \set appliquer 0
\endif

BEGIN;

-- Le quartier est désigné par son `Code` : il est obligatoire, unique par ville, et stable —
-- contrairement au nom, qui porte accents, casse et espaces variables (« 13 éme DBLE »).
CREATE TEMP TABLE plan (code_quartier text, code_zone text, numero int) ON COMMIT DROP;

INSERT INTO plan VALUES
  -- Ras-Dika (Z1)
  ('LP', 'Z1', 103),   -- La Plaine
  ('BD', 'Z1', 107),   -- Brise de mer 1
  ('ID', 'Z1', 108),   -- Ilôt du Héron
  -- Boulaos 1 (Z2)
  ('LS', 'Z2', 207),   -- Les Salines Ouest          452 adresses
  ('BO', 'Z2', 208),   -- Boulaos
  -- Boulaos 2 (Z3)
  ('GO', 'Z3', 302),   -- Gabode 3                   328 adresses
  ('GE', 'Z3', 305),   -- Gabode 5
  ('LQ', 'Z3', 311),   -- Lotissement du Quartier 7 Sud
  ('CW', 'Z3', 318),   -- Cité Wadagir 1
  ('GB', 'Z3', 319),   -- Gabode 2
  ('LD', 'Z3', 320),   -- Lotissement d'Ambouli
  ('CE', 'Z3', 321),   -- Cité Willo
  ('GA', 'Z3', 322),   -- Gabode 1
  ('CT', 'Z3', 323),   -- Cité Wadagir 2
  ('LU', 'Z3', 324),   -- Lotissement du Bourakibir
  ('CH', 'Z3', 325),   -- Cité Hache
  -- Boulaos 3 (Z4)
  ('GD', 'Z4', 403),   -- Gabode 4
  ('QL', 'Z4', 408),   -- Quartier Brière de l'Isle
  ('CA', 'Z4', 409),   -- Cimetière d'Ambouli
  ('ED', 'Z4', 410),   -- 13 éme DBLE
  -- Balbala 1 (Z5)
  ('LL', 'Z5', 501);   -- Lotissement 55 Logements

-- ── Garde-fous. Chacun a déjà eu une raison de se déclencher. ────────────────────────────────

DO $$
DECLARE n int; detail text;
BEGIN
  -- 1. Les 21 quartiers existent, et un seul par code.
  SELECT count(*) INTO n
  FROM plan p JOIN "Quartiers" q ON q."Code" = p.code_quartier
  JOIN "Cities" c ON c."Id" = q."CityId" AND c."Name" = 'Djibouti';
  IF n <> 21 THEN
    RAISE EXCEPTION 'Attendu 21 quartiers de Djibouti, trouvé %. Codes ou ville modifiés ?', n;
  END IF;

  -- 2. Aucun n'a déjà un numéro. Ce script ajoute, il n'écrase pas — un quartier numéroté
  --    depuis la relecture signifie que quelqu'un d'autre est passé, et il faut le savoir.
  SELECT count(*), string_agg(q."Nom", ', ') INTO n, detail
  FROM plan p JOIN "Quartiers" q ON q."Code" = p.code_quartier
  WHERE q."AreaNumber" IS NOT NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'Déjà numérotés depuis la relecture : %', detail;
  END IF;

  -- 3. Aucun numéro proposé n'est pris. Une collision casserait l'unicité du code postal.
  SELECT count(*), string_agg(q."Nom" || '=' || q."AreaNumber", ', ') INTO n, detail
  FROM plan p JOIN "Quartiers" q ON q."AreaNumber" = p.numero
  JOIN "Cities" c ON c."Id" = q."CityId" AND c."Name" = 'Djibouti';
  IF n > 0 THEN
    RAISE EXCEPTION 'Numéros déjà pris : %', detail;
  END IF;

  -- 4. La zone visée appartient bien à la commune du quartier. C'est la règle du modèle
  --    (`zoneId` exige `communeId`, et la zone porte sa commune) et la seule qui ait empêché
  --    un rattachement géographiquement tentant mais faux.
  SELECT count(*), string_agg(q."Nom" || ' → ' || z."Name", ', ') INTO n, detail
  FROM plan p
  JOIN "Quartiers" q ON q."Code" = p.code_quartier
  JOIN "Zones" z ON z."Code" = p.code_zone
  WHERE q."CommuneId" IS DISTINCT FROM z."CommuneId";
  IF n > 0 THEN
    RAISE EXCEPTION 'Zone hors de la commune du quartier : %', detail;
  END IF;

  -- 5. Le numéro est cohérent avec la zone — la convention qui fait tout tenir.
  SELECT count(*), string_agg(p.code_quartier || ' ' || p.numero || ' vs ' || p.code_zone, ', ')
    INTO n, detail
  FROM plan p WHERE (p.numero / 100) <> substring(p.code_zone FROM 2)::int;
  IF n > 0 THEN
    RAISE EXCEPTION 'Numéro incohérent avec la zone : %', detail;
  END IF;
END $$;

-- ── L'écriture ───────────────────────────────────────────────────────────────────────────────

UPDATE "Quartiers" q
SET "AreaNumber" = p.numero,
    "ZoneId"     = z."Id"
FROM plan p, "Zones" z
WHERE q."Code" = p.code_quartier
  AND z."Code" = p.code_zone
  AND q."CityId" = (SELECT "Id" FROM "Cities" WHERE "Name" = 'Djibouti');

-- ── Ce que ça donne ──────────────────────────────────────────────────────────────────────────

SELECT q."Code", q."Nom", cm."Name" AS commune, z."Name" AS zone,
       c."Code"::text || q."AreaNumber"::text AS postcode
FROM plan p
JOIN "Quartiers" q ON q."Code" = p.code_quartier
JOIN "Cities" c ON c."Id" = q."CityId"
LEFT JOIN "Communes" cm ON cm."Id" = q."CommuneId"
LEFT JOIN "Zones" z ON z."Id" = q."ZoneId"
ORDER BY q."AreaNumber";

SELECT count(*) FILTER (WHERE "AreaNumber" IS NULL) AS restent_sans_numero,
       count(*) FILTER (WHERE "ZoneId" IS NULL)     AS restent_sans_zone,
       count(*)                                     AS total
FROM "Quartiers" q
JOIN "Cities" c ON c."Id" = q."CityId" AND c."Name" = 'Djibouti';

\if :appliquer
  COMMIT;
  \echo '>>> APPLIQUÉ.'
\else
  ROLLBACK;
  \echo '>>> SIMULATION — rien écrit. Relancer avec -v appliquer=1 pour appliquer.'
\endif

-- ==============================================================================================
-- CE QUE CE SCRIPT NE FAIT PAS
-- ==============================================================================================
-- · Les cinq quartiers de Balbala SANS EMPRISE (WAHLADABA N. et ses 300 blocs, PHARE DE BALBALA,
--   MIDJADHERE, CITE HAYABLEY, CITE C. MOUSSA) : aucun voisinage n'est calculable sans contour.
--   Leur donner une emprise — l'union de leurs blocs est un point de départ — les rend
--   traitables par la même méthode, sans rien changer ici.
-- · « Quartier Shell » (Ali-Sabieh) : pas de commune, donc pas de zone possible. Seul Djibouti
--   est découpé en communes, et c'est un état normal, pas une donnée manquante.
-- · Dikhil et Tadjourah : leur VILLE n'a pas de `Code`. Un seul champ bloque 5 830 adresses de
--   chaque côté. Ces valeurs relèvent du plan de numérotation national, pas d'une déduction.
-- · « Wahladaba Sud », dont le numéro 605 contredit sa zone Z5. Corriger reviendrait à changer
--   un code postal DÉJÀ PUBLIÉ ; c'est une décision, pas un nettoyage.
