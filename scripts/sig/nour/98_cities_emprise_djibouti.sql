-- =====================================================================
--  D.A.S — remplace l'emprise de Djibouti par une enveloppe DÉRIVÉE DES DONNÉES
-- ---------------------------------------------------------------------
--  Le polygone de RÉGION posé par `96_` est faux comme contour de ville, et pas
--  seulement « trop large ». Mesuré le 2026-09-04 :
--
--    * 207 km² pour une ville dont les quartiers couvrent 25 km² ;
--    * il n'EXCLUT une partie de 12 quartiers de la ville : Héron à **57,5 %
--      dehors**, Brise de mer 1 à 27,6 %, Cité Saoudienne 26,2 %, Ilôt du Héron
--      25,7 %, Boulaos 21,9 %, Marabout 17,5 %… Ce sont les quartiers du
--      littoral et de la presqu'île : le contour de région suit un trait de côte
--      qui ne correspond pas à l'emprise urbaine ;
--    * 10 blocs tombent entièrement hors de leur propre ville.
--
--  Un contour de ville qui coupe ses propres quartiers en deux est inutilisable :
--  tout test « cette adresse est-elle dans la ville » répond faux sur le port,
--  le Héron et le Plateau du Serpent.
--
--  REMPLACEMENT : enveloppe convexe des quartiers ET des blocs de la ville.
--  53 km², 36 sommets, et par construction **0 bloc et 0 quartier dehors**.
--  Quatre fois plus serré que la région, et cohérent avec le référentiel.
--
--  Pourquoi convexe et pas concave : `ST_ConcaveHull` échoue sur cette
--  collection (« GEOS Error: IllegalStateException: Unable to find shell join
--  index with interior join line »). L'enveloppe convexe inclut donc un peu de
--  mer dans la baie — c'est le prix d'un polygone unique, `Cities."Boundary"`
--  étant typé POLYGON.
--
--  ⚠️ DJIBOUTI SEULEMENT. Ali Sabieh a 3 quartiers, **aucun avec emprise**, et
--  0 bloc : rien à dériver. Arta, Dikhil, Obock et Tadjourah n'ont ni quartier
--  ni bloc. Ces cinq villes gardent le polygone de région, faute de mieux.
--
--  Reste PROVISOIRE : une enveloppe convexe n'est pas une limite administrative.
--  À remplacer dès que l'expert livre de vraies emprises urbaines.
--
--  Sauvegarde : backup-cities-avant-2026-09-04.csv (état d'origine, sans emprise).
--  Idempotent : recalcule la même enveloppe à chaque exécution.
-- =====================================================================
BEGIN;
SET LOCAL statement_timeout = '300s';

WITH source AS (
  SELECT q."Boundary" AS g
  FROM   "Quartiers" q
  JOIN   "Cities" ci ON ci."Id" = q."CityId"
  WHERE  ci."Name" = 'Djibouti' AND q."Boundary" IS NOT NULL
  UNION ALL
  SELECT b."Boundary"
  FROM   "Blocs" b
  JOIN   "Quartiers" q ON q."Id" = b."QuartierId"
  JOIN   "Cities" ci   ON ci."Id" = q."CityId"
  WHERE  ci."Name" = 'Djibouti' AND b."Boundary" IS NOT NULL
),
enveloppe AS (
  SELECT ST_ConvexHull(ST_Collect(g)) AS h FROM source
)
UPDATE "Cities" c
SET    "Boundary" = ST_Force2D(e.h)
FROM   enveloppe e
WHERE  c."Name" = 'Djibouti'
  AND  e.h IS NOT NULL;

COMMIT;

-- Contrôle : plus rien ne doit dépasser.
SELECT c."Name",
       round((ST_Area(c."Boundary"::geography)/1e6)::numeric) AS km2,
       ST_NPoints(c."Boundary")                               AS sommets,
       (SELECT count(*) FROM "Quartiers" q
        WHERE q."CityId" = c."Id" AND q."Boundary" IS NOT NULL
          AND NOT ST_Within(q."Boundary", c."Boundary"))       AS quartiers_hors,
       (SELECT count(*) FROM "Blocs" b JOIN "Quartiers" q ON q."Id" = b."QuartierId"
        WHERE q."CityId" = c."Id" AND b."Boundary" IS NOT NULL
          AND NOT ST_Within(b."Boundary", c."Boundary"))       AS blocs_hors
FROM   "Cities" c
ORDER  BY c."Name";
