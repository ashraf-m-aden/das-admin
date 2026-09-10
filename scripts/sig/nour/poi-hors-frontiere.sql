-- Retire de `nour.poi_osm` les lieux qui ne sont pas à Djibouti.
--
--   psql "$DB" -v ON_ERROR_STOP=1 -f scripts/sig/nour/poi-hors-frontiere.sql
--
-- ⚠️ **ESSAI À BLANC : remplacer le `COMMIT;` final par `ROLLBACK;`.**
--
-- Sauvegarde des lignes retirées : `poi-hors-frontiere-supprimes-2026-09-10.csv`, à côté de ce
-- fichier — avec le WKT, donc réinsérables telles quelles.
--
-- ---------------------------------------------------------------------------------------------
-- D'OÙ VIENT LE PROBLÈME
-- ---------------------------------------------------------------------------------------------
-- L'extraction OSM a été faite sur une boîte englobante, qui déborde des frontières. Le
-- référentiel national s'est retrouvé avec des écoles de Zeila (Somaliland), des hôpitaux du
-- Yémen et des postes frontière érythréens. Ils ressortaient dans la recherche publique.
--
-- ---------------------------------------------------------------------------------------------
-- ⛔ POURQUOI PAS « TOUT CE QUI EST HORS DU CONTOUR NATIONAL »
-- ---------------------------------------------------------------------------------------------
-- Parce que **le contour national est incomplet**, et qu'un tel critère détruirait de la donnée
-- djiboutienne. Mesure du 2026-09-10 — 43 lieux tombent hors du contour, en trois groupes :
--
--   moins de 1 km      4 lieux     2 … 780 m
--   1 à 15 km         19 lieux   1 765 … 11 521 m
--   plus de 15 km     20 lieux  21 758 … 48 177 m
--
-- Le groupe du milieu est le piège. Seize de ses dix-neuf lieux sont des **hébergements**
-- groupés autour de `lon 43,15 … 43,21 / lat 11,71 … 11,72` — au large, dans le golfe de
-- Tadjoura, très vraisemblablement les **îles Moucha et Maskali**, qui sont djiboutiennes. Le
-- contour ne les contient pas.
--
-- Le premier groupe le confirme : l'Hôtel Corto Maltese est à **2 m** du trait, et le point
-- « Obock » — la ville — à **443 m**. Le contour est approximatif sur le littoral.
--
-- ⚠️ Corriger le contour est le vrai remède ; tant qu'il n'est pas fait, « hors du contour » ne
-- peut pas servir de critère de suppression.
--
-- ---------------------------------------------------------------------------------------------
-- LE CRITÈRE RETENU : PLUS DE 15 KM AU-DELÀ DU TRAIT
-- ---------------------------------------------------------------------------------------------
-- Le seuil n'est pas choisi au jugé, il est lu dans la donnée : le groupe à conserver s'arrête à
-- **11 521 m**, celui à retirer commence à **21 758 m**. Dix kilomètres de vide entre les deux,
-- et 15 km tombe au milieu. Aucun point ne se trouve près de la limite : la déplacer de plusieurs
-- kilomètres dans un sens ou dans l'autre ne changerait rien au résultat.
--
-- ⚠️ **Le biais est délibérément conservateur.** Trois lieux probablement étrangers restent — la
-- Mosquée de Rahayta (3,7 km, Érythrée), l'École de Dewele (5,3 km, frontière éthiopienne) et un
-- lieu de culte sans nom à 1,8 km à l'ouest. Les retirer imposerait un seuil bas, qui emporterait
-- les îles. **Garder trois points étrangers douteux coûte moins que d'effacer seize lieux
-- djiboutiens.**
--
-- ---------------------------------------------------------------------------------------------
-- UNE SEULE TABLE À TOUCHER
-- ---------------------------------------------------------------------------------------------
-- `public.poi_tiles` et `public.poi_sites_tiles` sont des VUES sur `nour.poi_osm` : elles suivent
-- sans rien à faire. `recherche_index`, elle, est matérialisée — d'où le rafraîchissement en fin
-- de script.

CREATE TEMP TABLE rapport (ordre int, section text, detail text, valeur text);

CREATE TEMP TABLE a_retirer AS
WITH n AS (SELECT geom AS g FROM public.contour_national LIMIT 1)
SELECT p.osm_type, p.osm_id,
       ST_Distance(n.g::geography, p.geom::geography) AS m
FROM nour.poi_osm p, n
WHERE p.geom IS NOT NULL
  AND NOT ST_Intersects(n.g, p.geom)
  AND ST_Distance(n.g::geography, p.geom::geography) > 15000;

INSERT INTO rapport
SELECT 1, 'Avant', 'poi_osm', count(*)::text FROM nour.poi_osm
UNION ALL SELECT 1, 'Avant', 'lieux dans la recherche', count(*)::text
          FROM public.recherche_index WHERE genre = 'lieu';

INSERT INTO rapport
SELECT 2, 'A retirer', 'lignes', count(*)::text FROM a_retirer
UNION ALL SELECT 2, 'A retirer', 'le plus proche du trait', round(min(m))::text || ' m' FROM a_retirer
UNION ALL SELECT 2, 'A retirer', 'le plus loin', round(max(m))::text || ' m' FROM a_retirer;

-- ⚠️ Filet : le seuil doit laisser un vide net de part et d'autre. Si un point conserve se
-- trouvait a moins de 15 km du plus proche retire, la coupure ne serait plus lisible dans la
-- donnee et il faudrait la revoir a la main plutot que de supprimer a l'aveugle.
INSERT INTO rapport
SELECT 3, 'Controle', 'plus loin des conserves (doit rester < 15 km)',
       round(max(m))::text || ' m'
FROM (
  WITH n AS (SELECT geom AS g FROM public.contour_national LIMIT 1)
  SELECT ST_Distance(n.g::geography, p.geom::geography) AS m
  FROM nour.poi_osm p, n
  WHERE p.geom IS NOT NULL AND NOT ST_Intersects(n.g, p.geom)
    AND ST_Distance(n.g::geography, p.geom::geography) <= 15000
) conserves;

BEGIN;

DELETE FROM nour.poi_osm p
USING a_retirer r
WHERE p.osm_type = r.osm_type AND p.osm_id = r.osm_id;

-- Remplacer par ROLLBACK pour un essai à blanc.
COMMIT;

-- Après le COMMIT : en essai à blanc, cette lecture montre l'état réel, donc inchangé.
INSERT INTO rapport
SELECT 4, 'Apres', 'poi_osm', count(*)::text FROM nour.poi_osm
UNION ALL SELECT 4, 'Apres', 'hors contour restants', count(*)::text
          FROM nour.poi_osm p, (SELECT geom AS g FROM public.contour_national LIMIT 1) n
          WHERE p.geom IS NOT NULL AND NOT ST_Intersects(n.g, p.geom);

SELECT section, detail, valeur FROM rapport ORDER BY ordre, detail;

-- ---------------------------------------------------------------------------------------------
-- L'index de recherche ne se met pas a jour tout seul.
-- ---------------------------------------------------------------------------------------------
\ir ../rafraichir-recherche.sql
