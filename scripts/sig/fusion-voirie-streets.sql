-- Fusion de la voirie SIG dans `Streets`, sans doublon ni faux différent.
--
-- Le périmètre est étroit PAR CONSTRUCTION, pas par prudence : c'est tout ce que la
-- contrainte « sans doublons et sans faux différents » laisse passer. Trois filtres,
-- chacun écartant un lot pour une raison distincte :
--
--   1. NOM NORMALISÉ. Majuscules, espace inséré entre le mot et son numéro. Sans ça,
--      `BOULEVARD10` et `BOULEVARD 10` comptent pour deux rues alors que c'est la même —
--      exactement le faux différent à éviter. 67 noms SIG sur 124 existent déjà dans
--      `Streets` après cette normalisation : ils ne sont PAS réinsérés.
--
--   2. IDENTITÉ EXIGÉE : `^(AVENUE|RUE) [0-9]+$`. Un tronçon nommé « AVENUE » sans numéro
--      n'a pas d'identité, il a un nom manquant. `Streets` porte déjà une ligne de ce genre
--      (`SIG-` / « Boulevard »), on n'en ajoute pas.
--
--   3. GÉOMÉTRIE STOCKABLE. `Streets."Boundary"` est typé geometry(LineString,4326) : il ne
--      peut pas contenir des tronçons disjoints. Les noms dont l'union donne une
--      MultiLineString sont écartés — les insérer un tronçon par ligne recréerait le faux
--      différent qu'on cherche à éviter, et changer le type de la colonne serait une
--      migration du schéma back, hors périmètre de ce dépôt.
--
-- Une seule correction de source, assumée : `AVENNUE 37` est une coquille, unique dans la
-- livraison, et `AVENUE 37` n'existe nulle part ailleurs. La corriger ici évite de créer
-- une rue orpheline que personne ne rapprochera jamais de sa voisine.
--
-- Attendu : 32 rues créées, 46 tronçons fusionnés, ~8,4 km. Idempotent.
--
--   docker run --rm -i --add-host=host.docker.internal:host-gateway \
--     postgis/postgis:17-3.5 psql "$DB" -v ON_ERROR_STOP=1 -f - < scripts/sig/fusion-voirie-streets.sql

BEGIN;
SET LOCAL statement_timeout = '300s';

CREATE TEMP TABLE fusion_voirie ON COMMIT DROP AS
WITH corrige AS (
  SELECT replace(
           regexp_replace(regexp_replace(upper(nom), '([A-Z])([0-9])', '\1 \2', 'g'), '\s+', ' ', 'g'),
           'AVENNUE', 'AVENUE') AS nom,
         ST_Transform(wkb_geometry, 4326) AS g
  FROM voierie_tertiaire_non_bitumee
  WHERE nom IS NOT NULL AND nom <> ''
), deja_connu AS (
  SELECT DISTINCT regexp_replace(regexp_replace(upper("Name"), '([A-Z])([0-9])', '\1 \2', 'g'), '\s+', ' ', 'g') AS nom
  FROM "Streets" WHERE "Name" IS NOT NULL
), groupe AS (
  SELECT c.nom, count(*) AS troncons, ST_LineMerge(ST_Union(c.g)) AS ligne
  FROM corrige c
  WHERE c.nom NOT IN (SELECT nom FROM deja_connu)
    AND c.nom ~ '^(AVENUE|RUE) [0-9]+$'
  GROUP BY c.nom
)
SELECT nom,
       troncons,
       ligne,
       'SIG-' || CASE split_part(nom, ' ', 1) WHEN 'AVENUE' THEN 'AV' ELSE 'RUE' END
              || '-' || split_part(nom, ' ', 2) AS code,
       initcap(nom) AS libelle,
       CASE split_part(nom, ' ', 1) WHEN 'AVENUE' THEN 'Avenue' ELSE 'Rue' END AS type
FROM groupe
WHERE ST_GeometryType(ligne) = 'ST_LineString';

INSERT INTO "Streets" ("Id", "Code", "Name", "Type", "Boundary")
SELECT gen_random_uuid(), f.code, f.libelle, f.type, f.ligne
FROM fusion_voirie f
WHERE NOT EXISTS (SELECT 1 FROM "Streets" s WHERE s."Code" = f.code);

-- Garde-fous. Toute violation annule la transaction entière.
DO $garde$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM fusion_voirie;
  IF n <> 32 THEN RAISE EXCEPTION 'attendu 32 rues fusionnables, obtenu %', n; END IF;

  SELECT count(*) INTO n FROM fusion_voirie f
  WHERE NOT EXISTS (SELECT 1 FROM "Streets" s WHERE s."Code" = f.code);
  IF n <> 0 THEN RAISE EXCEPTION '% rues non insérées', n; END IF;

  -- Le point de la demande : aucun nom en double, à la normalisation près.
  SELECT count(*) INTO n FROM (
    SELECT regexp_replace(regexp_replace(upper("Name"), '([A-Z])([0-9])', '\1 \2', 'g'), '\s+', ' ', 'g') AS nom
    FROM "Streets" WHERE "Name" IS NOT NULL
    GROUP BY 1 HAVING count(*) > 1) s;
  IF n <> 17 THEN
    -- 17 doublons PRÉEXISTAIENT (143 noms pour 160 lignes). On vérifie qu'on n'en a pas ajouté.
    RAISE EXCEPTION 'doublons de nom : % groupes, 17 attendus avant fusion', n;
  END IF;

  SELECT count(*) INTO n FROM "Streets"
  WHERE "Boundary" IS NOT NULL AND ST_GeometryType("Boundary") <> 'ST_LineString';
  IF n <> 0 THEN RAISE EXCEPTION 'géométrie non LineString dans Streets'; END IF;
END $garde$;

COMMIT;
