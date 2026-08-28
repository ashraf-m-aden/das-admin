-- Fusion des 24 rues restantes : celles dont le tracé est en PLUSIEURS morceaux.
--
-- ⚠️ **À N'EXÉCUTER QU'APRÈS** la migration `WidenStreetBoundaryToMultiLineString` du dépôt
-- `dasApi`, ET après le redéploiement de l'image du backend. Avant, `Streets."Boundary"` est
-- typée geometry(LineString, 4326) et refuse ces géométries.
--
-- Ces 24 rues étaient le seul lot bloqué par le SCHÉMA, et non par la donnée : elles ont un nom,
-- ce nom est nouveau, leurs tronçons sont propres. Elles étaient impossibles à enregistrer sans
-- les éclater en autant de rues portant le même nom — c'est-à-dire sans fabriquer exactement les
-- doublons que la fusion cherche à éviter.
--
-- Mêmes règles que `fusion-voirie-streets.sql`, dont ce script est le complément :
--   - nom normalisé (majuscules, espace inséré entre le mot et son numéro) ;
--   - identité exigée : `^(AVENUE|RUE) [0-9]+$` ;
--   - un nom déjà présent dans `Streets` n'est pas réinséré ;
--   - `AVENNUE` corrigé en `AVENUE`, coquille unique de la livraison.
--
-- La seule différence est la géométrie : on garde la MultiLineString au lieu de l'écarter.
--
-- Attendu : 24 rues créées, 75 tronçons, ~12,6 km.
-- Rejouable : un second passage reselectionne les 24 memes rues, n'en insere aucune, et sort
-- en succes.
--
--   docker run --rm -i --add-host=host.docker.internal:host-gateway \
--     postgis/postgis:17-3.5 psql "$DB" -v ON_ERROR_STOP=1 -f - < scripts/sig/fusion-voirie-multilignes.sql

BEGIN;
SET LOCAL statement_timeout = '300s';

-- Garde-fou : sans la migration, l'insertion échouerait ligne par ligne avec un message
-- de contrainte peu parlant. Autant dire tout de suite ce qui manque.
DO $garde$
DECLARE type_colonne text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO type_colonne
  FROM pg_attribute a
  WHERE a.attrelid = '"Streets"'::regclass AND a.attname = 'Boundary';

  IF type_colonne NOT LIKE '%MultiLineString%' THEN
    RAISE EXCEPTION
      'Streets."Boundary" est encore %. Appliquer d''abord la migration WidenStreetBoundaryToMultiLineString.',
      type_colonne;
  END IF;
END $garde$;

CREATE TEMP TABLE fusion_multi ON COMMIT DROP AS
WITH corrige AS (
  SELECT replace(
           regexp_replace(regexp_replace(upper(nom), '([A-Z])([0-9])', '\1 \2', 'g'), '\s+', ' ', 'g'),
           'AVENNUE', 'AVENUE') AS nom,
         ST_Transform(wkb_geometry, 4326) AS g
  FROM voierie_tertiaire_non_bitumee
  WHERE nom IS NOT NULL AND nom <> ''
), deja_connu AS (
  SELECT DISTINCT regexp_replace(regexp_replace(upper("Name"), '([A-Z])([0-9])', '\1 \2', 'g'), '\s+', ' ', 'g') AS nom
  FROM "Streets"
  WHERE "Name" IS NOT NULL
    -- Une rue creee par CE script ne compte pas comme « deja connue » : sinon un second
    -- passage ecarterait ses propres 24 noms, la selection tomberait a 0 et le controle
    -- final conclurait a tort que le lot est introuvable. On les reconnait a leur signature :
    -- code SIG- et trace en plusieurs morceaux, ce que seul ce script produit.
    -- coalesce : une rue nommee SANS geometrie doit rester « deja connue », or
    -- ST_NumGeometries rend NULL et la comparaison eliminerait la ligne au lieu de la garder.
    AND NOT ("Code" LIKE 'SIG-%' AND coalesce(ST_NumGeometries("Boundary"), 1) > 1)
), groupe AS (
  SELECT c.nom, count(*) AS troncons, ST_LineMerge(ST_Union(c.g)) AS ligne
  FROM corrige c
  WHERE c.nom NOT IN (SELECT nom FROM deja_connu)
    AND c.nom ~ '^(AVENUE|RUE) [0-9]+$'
  GROUP BY c.nom
)
SELECT nom,
       troncons,
       -- ST_Multi enveloppe uniformément : une rue d'un seul tenant qui arriverait ici serait
       -- stockée comme un MultiLineString à un morceau, pas rejetée.
       ST_Multi(ligne) AS ligne,
       'SIG-' || CASE split_part(nom, ' ', 1) WHEN 'AVENUE' THEN 'AV' ELSE 'RUE' END
              || '-' || split_part(nom, ' ', 2) AS code,
       initcap(nom) AS libelle,
       CASE split_part(nom, ' ', 1) WHEN 'AVENUE' THEN 'Avenue' ELSE 'Rue' END AS type
FROM groupe
WHERE ST_GeometryType(ligne) = 'ST_MultiLineString';

INSERT INTO "Streets" ("Id", "Code", "Name", "Type", "Boundary")
SELECT gen_random_uuid(), f.code, f.libelle, f.type, f.ligne
FROM fusion_multi f
WHERE NOT EXISTS (SELECT 1 FROM "Streets" s WHERE s."Code" = f.code);

DO $garde$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM fusion_multi;
  IF n <> 24 THEN RAISE EXCEPTION 'attendu 24 rues multi-tronçons, obtenu %', n; END IF;

  SELECT count(*) INTO n FROM fusion_multi f
  WHERE NOT EXISTS (SELECT 1 FROM "Streets" s WHERE s."Code" = f.code);
  -- Formule volontairement « toutes presentes » et non « toutes inserees » : c'est ce qui
  -- reste vrai au second passage, ou l'INSERT ne fait rien parce que le travail est deja fait.
  IF n <> 0 THEN RAISE EXCEPTION '% rues absentes de Streets', n; END IF;

  -- Le point de la fusion : aucun nom en double, à la normalisation près.
  -- 17 doublons PRÉEXISTAIENT (voir le récapitulatif du 2026-08-28) ; on vérifie qu'on n'en
  -- ajoute pas un dix-huitième.
  SELECT count(*) INTO n FROM (
    SELECT regexp_replace(regexp_replace(upper("Name"), '([A-Z])([0-9])', '\1 \2', 'g'), '\s+', ' ', 'g') AS nom
    FROM "Streets" WHERE "Name" IS NOT NULL
    GROUP BY 1 HAVING count(*) > 1) s;
  IF n <> 17 THEN RAISE EXCEPTION 'doublons de nom : % groupes, 17 attendus', n; END IF;
END $garde$;

COMMIT;
