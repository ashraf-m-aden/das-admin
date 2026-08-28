-- Remplit `Quartiers."Boundary"` depuis `delimitations_quartiers`.
--
-- Sans ça, 13 quartiers sur 84 seulement ont une emprise : toute couche cartographique
-- construite sur les quartiers (zone, code postal) serait vide aux trois quarts, et quatre
-- zones sur huit totalement invisibles. C'est le préalable aux couches, pas un embellissement.
--
-- Rapprochement par nom NORMALISÉ : accents retirés, majuscules, espace inséré entre un mot et
-- son numéro, ponctuation réduite à un espace. Rapprochement EXACT après normalisation — aucune
-- proximité lexicale, qui rattacherait une emprise au mauvais quartier sans que rien ne le dise.
--
-- N'écrase JAMAIS une emprise existante (`WHERE "Boundary" IS NULL`) : les 13 déjà renseignées
-- l'ont été à la création des quartiers, avec la même source, et une réécriture n'apporterait
-- rien tout en rendant le script non rejouable sans risque.
--
-- Les 91 emprises SIG nommées sont mono-partie et valides (vérifié) : `ST_GeometryN(g, 1)`
-- suffit, il n'y a pas de multipolygone à arbitrer. Reprojection 32638 -> 4326.
--
-- Attendu : 63 quartiers renseignés, portant la couverture de 13 à 76 sur 84. Idempotent.
--
--   docker run --rm -i --add-host=host.docker.internal:host-gateway \
--     postgis/postgis:17-3.5 psql "$DB" -v ON_ERROR_STOP=1 -f - < scripts/sig/emprises-quartiers.sql

BEGIN;
SET LOCAL statement_timeout = '300s';

CREATE OR REPLACE FUNCTION pg_temp.norm(t text) RETURNS text LANGUAGE sql IMMUTABLE AS $fn$
  SELECT trim(regexp_replace(
    regexp_replace(
      upper(translate(coalesce(t, ''),
                      'ÀÂÄÉÈÊËÎÏÔÖÙÛÜÇàâäéèêëîïôöùûüç',
                      'AAAEEEEIIOOUUUCAAAEEEEIIOOUUUC')),
      '([A-Z])([0-9])', '\1 \2', 'g'),
    '[^A-Z0-9]+', ' ', 'g'))
$fn$;

CREATE TEMP TABLE emprise_source ON COMMIT DROP AS
SELECT pg_temp.norm(nom) AS n,
       ST_Force2D(ST_Transform(ST_GeometryN(wkb_geometry, 1), 4326)) AS geom
FROM delimitations_quartiers
WHERE nom IS NOT NULL AND nom <> '';

-- Un nom SIG qui désignerait deux emprises rendrait le rattachement arbitraire.
DO $garde$
DECLARE doublons integer;  -- pas `n` : le nom collisionnerait avec la colonne `n` de la requête
BEGIN
  SELECT count(*) INTO doublons FROM (SELECT n FROM emprise_source GROUP BY n HAVING count(*) > 1) s;
  IF doublons <> 0 THEN RAISE EXCEPTION '% nom(s) SIG en double, rattachement ambigu', doublons; END IF;
END $garde$;

UPDATE "Quartiers" q
SET "Boundary" = s.geom
FROM emprise_source s
WHERE q."Boundary" IS NULL
  AND pg_temp.norm(q."Nom") = s.n;

DO $garde$
DECLARE avec integer; total integer;
BEGIN
  SELECT count("Boundary"), count(*) INTO avec, total FROM "Quartiers"
  WHERE "CityId" = (SELECT "Id" FROM "Cities" WHERE "Name" = 'Djibouti');
  RAISE NOTICE 'emprises : % / % quartiers de Djibouti', avec, total;
  IF avec < 76 THEN RAISE EXCEPTION 'couverture attendue >= 76, obtenue %', avec; END IF;

  SELECT count(*) INTO avec FROM "Quartiers"
  WHERE "Boundary" IS NOT NULL AND NOT ST_IsValid("Boundary");
  IF avec <> 0 THEN RAISE EXCEPTION '% emprise(s) invalide(s)', avec; END IF;

  SELECT count(*) INTO avec FROM "Quartiers"
  WHERE "Boundary" IS NOT NULL AND ST_SRID("Boundary") <> 4326;
  IF avec <> 0 THEN RAISE EXCEPTION '% emprise(s) hors SRID 4326', avec; END IF;
END $garde$;

COMMIT;
