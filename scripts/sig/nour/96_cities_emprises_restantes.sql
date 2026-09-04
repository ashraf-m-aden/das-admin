-- =====================================================================
--  D.A.S — emprise provisoire pour les 2 villes qui n'en avaient aucune
-- ---------------------------------------------------------------------
--  `Cities` n'a JAMAIS été géométrisée : Djibouti (Code 77) et Ali Sabieh
--  (Code 78) sont à `Boundary IS NULL` depuis la création de la table. Après
--  `95_`, les 4 villes créées étaient les seules à porter une emprise — une
--  incohérence qui casse tout traitement « pour chaque ville, son contour ».
--
--  Même source et même réserve que `95_` : le polygone de RÉGION de
--  `nour.contour_rdd`. Djibouti (207 km²) colle à peu près à la ville ;
--  Ali Sabieh (2 040 km²) est très au-delà du bourg. PROVISOIRE.
--
--  N'écrase QUE des `Boundary` NULL (`WHERE "Boundary" IS NULL`) : si une
--  vraie emprise a été posée entre-temps, elle est préservée et le script
--  reste rejouable sans risque.
--
--  Sauvegarde de l'état antérieur : backup-cities-avant-2026-09-04.csv
-- =====================================================================
BEGIN;

CREATE TEMP TABLE appariement (nom text, region text) ON COMMIT DROP;
INSERT INTO appariement (nom, region) VALUES
  ('Djibouti',   'Djibouti'),
  ('Ali Sabieh', 'Ali sabieh');   -- casse exacte de contour_rdd.names_

UPDATE "Cities" c
SET    "Boundary" = ST_Force2D(
         (SELECT d.geom
          FROM   ST_Dump(r.wkb_geometry) d
          ORDER  BY ST_Area(d.geom) DESC
          LIMIT  1))
FROM   appariement a
JOIN   nour.contour_rdd r ON lower(r.names_) = lower(a.region)
WHERE  lower(c."Name") = lower(a.nom)
  AND  c."Boundary" IS NULL;

COMMIT;

SELECT c."Name", c."Code",
       c."Boundary" IS NOT NULL AS a_emprise,
       ST_GeometryType(c."Boundary") AS type_geom,
       round((ST_Area(c."Boundary"::geography)/1e6)::numeric) AS km2_provisoire
FROM   "Cities" c
ORDER  BY c."Name";
