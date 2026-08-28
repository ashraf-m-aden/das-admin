-- Îlots de la livraison SIG (`ilots_extension`) qui n'ont PAS d'équivalent dans `Blocs`.
--
-- Critère : aucun bloc du référentiel ne recouvre plus de la moitié de la surface de l'îlot.
-- Le recouvrement partiel est volontairement toléré — les deux découpages ne sont pas issus
-- du même dessin, exiger l'égalité géométrique ne renverrait que du bruit.
--
-- Lecture seule. Résultat attendu : 37 lignes sur 2 224 (état du 2026-08-27).
--
-- ⚠️ Ces 37 lignes ne sont PAS du travail restant. Mesurées, elles font 6,6 m² au maximum et
-- 0,3 m² en moyenne, là où l'îlot moyen fait 1 505 m² : ce sont des échardes de géométrie nées
-- du découpage, pas des îlots. Autrement dit la livraison est reprise à 100 %, et le libellé
-- « à reprendre » de la couche a été corrigé en conséquence (`map.basemap.sigIlots`).
-- La requête reste utile comme contrôle de non-régression après un futur import.
--
--   docker run --rm --add-host=host.docker.internal:host-gateway \
--     postgis/postgis:17-3.5 psql "$DB" --csv -f - < scripts/sig/ilots-non-repris.sql

WITH ilot AS (
  SELECT ogc_fid, code_ilot, quartier_ville, commune_ville, lettre_ilot, groupe,
         -- La livraison est en 32638 MULTIPOLYGON ; tout se compare en 4326.
         ST_Transform(ST_GeometryN(wkb_geometry, 1), 4326) AS geom
  FROM ilots_extension
)
SELECT i.ogc_fid,
       i.code_ilot,
       i.quartier_ville,
       i.commune_ville,
       i.lettre_ilot,
       i.groupe,
       round(ST_Area(i.geom::geography)::numeric) AS surface_m2,
       round(ST_X(ST_Centroid(i.geom))::numeric, 6) AS lon,
       round(ST_Y(ST_Centroid(i.geom))::numeric, 6) AS lat
FROM ilot i
WHERE NOT EXISTS (
  SELECT 1 FROM "Blocs" b
  WHERE b."Boundary" IS NOT NULL
    AND ST_Intersects(b."Boundary", i.geom)
    AND ST_Area(ST_Intersection(b."Boundary", i.geom)) > 0.5 * ST_Area(i.geom)
)
ORDER BY i.quartier_ville, i.code_ilot;
