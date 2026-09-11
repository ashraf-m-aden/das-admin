-- Attribue un `Code` aux quatre villes qui n'en ont pas.
--
--   Simulation (par défaut, n'écrit RIEN) :
--     psql "$DB" -v ON_ERROR_STOP=1 -f scripts/sig/cities-codes.sql
--
--   Application :
--     psql "$DB" -v ON_ERROR_STOP=1 -v appliquer=1 -f scripts/sig/cities-codes.sql
--
-- ==============================================================================================
-- L'ORDRE RETENU, ET POURQUOI
-- ==============================================================================================
-- Deux codes seulement existaient : Djibouti 77, Ali Sabieh 78. Deux points ne définissent pas
-- une suite, alors voici le raisonnement.
--
-- Ce n'est PAS l'ordre d'insertion en base : celui-ci place Ali Sabieh AVANT Djibouti
-- (Dikhil, Obock, Tadjourah, Ali Sabieh, Djibouti, Arta), alors que Djibouti porte le code
-- inférieur. L'ordre d'arrivée des données ne gouverne donc rien.
--
-- La seule règle compatible avec les deux codes connus : **la capitale d'abord, puis les régions
-- par ordre alphabétique.** Ali Sabieh est justement la première des cinq régions dans cet ordre.
--
--   77  Djibouti      (la capitale)
--   78  Ali Sabieh  ┐
--   79  Arta        │
--   80  Dikhil      ├ les régions, alphabétiquement
--   81  Obock       │
--   82  Tadjourah   ┘
--
-- ⚠️ C'est une INFÉRENCE à partir de deux valeurs, pas la lecture d'un plan officiel. Le plan de
-- numérotation national appartient à La Poste. Si leur document dit autre chose, ce sont ces
-- quatre lignes qu'il faut corriger — avant que des codes ne soient publiés, pas après.
--
-- ==============================================================================================
-- CE QUE ÇA DÉBLOQUE IMMÉDIATEMENT
-- ==============================================================================================
-- Dikhil et Tadjourah portent chacune un unique quartier « (provisoire) » dont l'`AreaNumber`
-- vaut déjà 0. La vue calcule `lpad(Code,2,'0') || lpad(AreaNumber,3,'0')` : elles obtiendront
-- donc `80000` et `82000` sans aucune autre écriture.
--
-- Ce n'est pas un bricolage : **Ali Sabieh a déjà `78000`** pour son propre quartier provisoire.
-- La forme `x000` signifie « la ville entière, pas encore découpée en quartiers », et c'est une
-- convention en place, pas une invention de ce script.
--
-- 5 830 adresses passent ainsi de « sans code postal » à « codées », d'un seul coup.
--
-- Arta et Obock n'ont aucun quartier : leur code ne change rien aujourd'hui et attend la donnée.
-- ==============================================================================================

\if :{?appliquer}
\else
  \set appliquer 0
\endif

BEGIN;

CREATE TEMP TABLE plan_villes (nom text, code int) ON COMMIT DROP;

INSERT INTO plan_villes VALUES
  ('Arta',      79),
  ('Dikhil',    80),
  ('Obock',     81),
  ('Tadjourah', 82);

-- ── Garde-fous ───────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE n int; detail text;
BEGIN
  -- 1. Les quatre villes existent, et une seule par nom.
  SELECT count(*) INTO n FROM plan_villes p JOIN "Cities" c ON c."Name" = p.nom;
  IF n <> 4 THEN
    RAISE EXCEPTION 'Attendu 4 villes, trouvé % — noms modifiés ou doublons ?', n;
  END IF;

  -- 2. Aucune n'a déjà un code. Ce script attribue, il ne réécrit pas : un code déjà posé
  --    signifie que quelqu'un d'autre est passé, avec peut-être un autre plan.
  SELECT count(*), string_agg(c."Name" || '=' || c."Code", ', ') INTO n, detail
  FROM plan_villes p JOIN "Cities" c ON c."Name" = p.nom WHERE c."Code" IS NOT NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'Villes déjà codées depuis la relecture : %', detail;
  END IF;

  -- 3. Aucun code visé n'est pris. Deux villes au même code rendraient le code postal ambigu
  --    au niveau national — c'est la seule erreur ici qui serait irrattrapable après publication.
  SELECT count(*), string_agg(c."Name" || '=' || c."Code", ', ') INTO n, detail
  FROM plan_villes p JOIN "Cities" c ON c."Code" = p.code;
  IF n > 0 THEN
    RAISE EXCEPTION 'Codes déjà attribués : %', detail;
  END IF;

  -- 4. Le code tient sur deux chiffres : la vue fait `lpad(Code, 2, '0')`, un code à trois
  --    chiffres produirait un code postal à six caractères et casserait l'invariant.
  SELECT count(*) INTO n FROM plan_villes WHERE code < 0 OR code > 99;
  IF n > 0 THEN
    RAISE EXCEPTION 'Code hors de deux chiffres : le code postal ne ferait plus 5 caractères.';
  END IF;
END $$;

-- ── L'écriture ───────────────────────────────────────────────────────────────────────────────

UPDATE "Cities" c SET "Code" = p.code
FROM plan_villes p WHERE c."Name" = p.nom;

-- ── Ce que ça donne ──────────────────────────────────────────────────────────────────────────

SELECT c."Name" AS ville, c."Code" AS code,
       (SELECT count(*) FROM "Quartiers" q WHERE q."CityId" = c."Id") AS quartiers,
       (SELECT count(*) FROM "Adresses" a
          JOIN "Blocs" b ON b."Id" = a."BlocId"
          JOIN "Quartiers" q ON q."Id" = b."QuartierId"
        WHERE q."CityId" = c."Id") AS adresses
FROM "Cities" c ORDER BY c."Code";

\echo '--- codes postaux desormais calcules pour ces villes ---'
SELECT c."Name" AS ville, q."Nom" AS quartier,
       lpad(c."Code"::text, 2, '0') || lpad(q."AreaNumber"::text, 3, '0') AS postcode
FROM "Quartiers" q
JOIN "Cities" c ON c."Id" = q."CityId"
JOIN plan_villes p ON p.nom = c."Name"
WHERE q."AreaNumber" IS NOT NULL
ORDER BY 3;

\if :appliquer
  COMMIT;
  \echo '>>> APPLIQUÉ.'
\else
  ROLLBACK;
  \echo '>>> SIMULATION — rien écrit. Relancer avec -v appliquer=1 pour appliquer.'
\endif
