-- Vue `public.poi_sites_tiles` — les lieux remarquables REGROUPÉS PAR SITE.
--
--   psql "$DB" -v ON_ERROR_STOP=1 -f scripts/sig/nour/poi-sites-tiles.sql
--
-- ---------------------------------------------------------------------------------------------
-- POURQUOI REGROUPER, ET POURQUOI EN BASE
-- ---------------------------------------------------------------------------------------------
-- OSM cartographie un campus bâtiment par bâtiment. Mesuré le 2026-09-10 : l'Université de
-- Djibouti compte **67 points sans nom étalés sur 328 m**, tagués `building=school` et
-- `building=university`. Ce ne sont PAS des doublons — seuls **4 points sur 961** se superposent
-- réellement à moins d'un mètre. Les supprimer effacerait le campus de la carte.
--
-- Le défaut est d'affichage : une pastille par bâtiment là où l'usager attend UN lieu. Au total
-- 40 grappes en éducation (262 points), 6 en santé, 14 en culte.
--
-- ⚠️ **Le regroupement se fait ICI et non dans le client.** MapLibre ne sait agréger (`cluster`)
-- que les sources GeoJSON, jamais les tuiles vectorielles — et `poi_tiles` en est une. Le faire
-- en base a trois avantages : le résultat est stable d'un zoom à l'autre, il ne dépend pas d'un
-- téléchargement préalable des 961 points, et le même regroupement sert tous les clients.
--
-- Rien n'est supprimé : `nour.poi_osm` reste intacte et `public.poi_tiles` continue d'exposer le
-- détail bâtiment par bâtiment. Cette vue est une LECTURE de plus, pas un remplacement.
--
-- ---------------------------------------------------------------------------------------------
-- LE RAYON DE 80 M
-- ---------------------------------------------------------------------------------------------
-- Assez large pour réunir les bâtiments d'un même campus, assez court pour ne pas fondre deux
-- écoles voisines en une. Mesuré : à 60 m l'Université sort en une seule grappe de 67 points ;
-- à 150 m elle absorbe le lycée mitoyen. 80 m garde la marge sans franchir la rue.
--
-- `minpoints = 1` : un lieu isolé forme sa propre grappe d'un point. Sans cela ST_ClusterDBSCAN
-- rend NULL sur les points esseulés et ils disparaîtraient de la carte.

DROP VIEW IF EXISTS public.poi_sites_tiles CASCADE;

CREATE VIEW public.poi_sites_tiles AS
WITH groupe AS (
  SELECT p.*,
         ST_ClusterDBSCAN(ST_Transform(p.geom, 32638), 80, 1)
           OVER (PARTITION BY p.categorie) AS grappe
  FROM nour.poi_osm p
),
-- Le centre de chaque grappe, calculé à part : une fonction fenêtre ne peut pas être imbriquée
-- dans un agrégat, et `ST_Centroid(ST_Collect(...)) OVER (...)` est refusé.
centre AS (
  SELECT categorie, grappe, ST_Centroid(ST_Collect(geom)) AS c
  FROM groupe GROUP BY categorie, grappe
)
SELECT
  row_number() OVER (ORDER BY g.categorie, g.grappe)          AS "Fid",
  g.categorie                                                 AS "Categorie",
  count(*)                                                    AS "Batiments",
  -- Le nom du site : le premier nom renseigné de la grappe. Sur un campus, un seul bâtiment
  -- porte souvent le nom de l'ensemble — c'est celui-là qu'on veut, pas « (sans nom) ».
  (array_agg(g.nom) FILTER (WHERE g.nom IS NOT NULL))[1]      AS "Nom",
  -- La sous-catégorie la plus spécifique l'emporte : un campus tagué à la fois « ecole » et
  -- « universite » est une université.
  (array_agg(g.sous_categorie ORDER BY
     CASE g.sous_categorie WHEN 'universite' THEN 0 WHEN 'college' THEN 1 ELSE 2 END))[1]
                                                              AS "SousCategorie",
  -- Point représentatif : le centre du nuage, ramené sur le bâtiment le plus proche pour ne
  -- jamais poser la pastille au milieu d'une cour ou d'une rue.
  -- ⚠️ Le transtypage explicite est OBLIGATOIRE. Sans lui, `array_agg` rend une géométrie sans
  -- typmod : `geometry_columns` la déclare `GEOMETRY` en SRID 0, et Martin REFUSE de publier une
  -- source qu'il ne sait pas cadrer — « Source poi_sites_tiles does not exist », sans autre
  -- explication. Même piège que les dumps SIG livrés en SRID 0.
  ((array_agg(g.geom ORDER BY g.geom <-> c.c))[1])::geometry(Point, 4326)
                                                              AS "Location"
FROM groupe g
JOIN centre c ON c.categorie = g.categorie AND c.grappe = g.grappe
GROUP BY g.categorie, g.grappe, c.c;

GRANT SELECT ON public.poi_sites_tiles TO martin_ro;

SELECT "Categorie", count(*) AS sites, sum("Batiments") AS batiments,
       count(*) FILTER (WHERE "Nom" IS NOT NULL) AS sites_nommes,
       max("Batiments") AS plus_gros_site
FROM public.poi_sites_tiles GROUP BY 1 ORDER BY 3 DESC;
