-- Tronçons de la livraison SIG qui n'ont PAS d'équivalent dans `Streets`.
--
-- Critère : aucune rue du référentiel ne passe à moins de 5 mètres du tronçon.
--
-- ⚠️ La tolérance de 5 m est GROSSIÈRE et joue contre nous : une voie tertiaire parallèle
-- à un boulevard, à 4 m de son axe, est comptée comme « déjà reprise » alors qu'elle est
-- une voie distincte. Le résultat est donc un PLANCHER de ce qui reste à intégrer, jamais
-- une liste exhaustive. Un rapprochement fiable demanderait de comparer les tracés, pas
-- seulement la distance.
--
-- Les trois tables de la livraison n'ont pas les mêmes colonnes : seule
-- `voierie_tertiaire_non_bitumee` porte un `nom` (267 des 1 303). Les deux autres n'ont
-- que leur identifiant, d'où les NULL de la colonne `nom`.
--
-- Lecture seule. Résultat attendu : 942 lignes sur 1 401, dont 890 sans nom, APRÈS la fusion
-- partielle du 2026-08-27 (`scripts/sig/fusion-voirie-streets.sql`, 32 rues créées).
-- Avant cette fusion le compte était de 1 036.
--
--   docker run --rm --add-host=host.docker.internal:host-gateway \
--     postgis/postgis:17-3.5 psql "$DB" --csv -f - < scripts/sig/voirie-non-reprise.sql

WITH livraison AS (
  SELECT 'voierie_tertiaire_bitumee' AS source, ogc_fid, NULL::varchar AS nom,
         NULL::varchar AS type_revet, NULL::varchar AS etat_chaus, wkb_geometry AS geom
  FROM voierie_tertiaire_bitumee
  UNION ALL
  SELECT 'voierie_tertiaire_non_bitumee', ogc_fid, nom, type_revet, etat_chaus, wkb_geometry
  FROM voierie_tertiaire_non_bitumee
  UNION ALL
  SELECT 'voierie_extension', ogc_fid, NULL, NULL, NULL, wkb_geometry
  FROM voierie_extension
), troncon AS (
  SELECT source, ogc_fid, nom, type_revet, etat_chaus,
         ST_Transform(geom, 4326) AS geom
  FROM livraison
)
SELECT t.source,
       t.ogc_fid,
       t.nom,
       t.type_revet,
       t.etat_chaus,
       round(ST_Length(t.geom::geography)::numeric) AS longueur_m,
       round(ST_X(ST_Centroid(t.geom))::numeric, 6) AS lon,
       round(ST_Y(ST_Centroid(t.geom))::numeric, 6) AS lat
FROM troncon t
WHERE NOT EXISTS (
  SELECT 1 FROM "Streets" s
  WHERE s."Boundary" IS NOT NULL
    AND ST_DWithin(s."Boundary"::geography, t.geom::geography, 5)
)
-- Les tronçons nommés d'abord : ce sont ceux qu'on peut rattacher à une rue sans relevé terrain.
ORDER BY (t.nom IS NULL), t.nom, t.source, t.ogc_fid;
