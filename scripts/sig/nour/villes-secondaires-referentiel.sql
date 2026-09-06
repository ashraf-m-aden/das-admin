-- Ali Sabieh, Tadjourah, Dikhil : bâtiments SIG → `Adresses`, avec les niveaux intermédiaires.
--
--   Dans pgAdmin : ouvrir ce fichier et l'exécuter tel quel.
--   En ligne de commande : psql "$DB" -v ON_ERROR_STOP=1 -f scripts/sig/nour/villes-secondaires-referentiel.sql
--
-- ⚠️ **ESSAI À BLANC : remplacer le `COMMIT;` final par `ROLLBACK;`.** Le rapport s'affiche
-- quand même. Ce script CRÉE des lignes dans trois tables du référentiel — à faire au moins une
-- fois avant d'écrire pour de bon.
--
-- Prérequis : les 18 dumps de la livraison du 2026-09-06 chargés dans `nour`
-- (`bat_dur_*`, `bat_legers_*`, `bat_socio_*`, `bat_indus_*`, `route_*`, `piste_*`).
--
-- ---------------------------------------------------------------------------------------------
-- CE QUE LA LIVRAISON APPORTE, ET CE QU'ELLE N'APPORTE PAS
-- ---------------------------------------------------------------------------------------------
-- 18 fichiers = 6 familles × 3 villes. Ce n'est pas un lot de Djibouti-ville, c'est l'extension
-- du référentiel à trois villes secondaires :
--
--   famille                Ali Sabieh   Tadjourah   Dikhil    total
--   bâtiments durs              3 845       1 566    2 008    7 419
--   bâtiments légers            1 712         618    1 352    3 682
--   équipements socio             197         134      115      446
--   industrie / tourisme           21          20       17       58
--   routes                         49          48       49      146
--   pistes                        521         214      346    1 081
--
-- Décision d'Ashraf : **les bâtiments SONT des adresses.** Mais le schéma impose une chaîne
-- complète — `Adresses."BlocId"` NOT NULL → `Blocs."QuartierId"` NOT NULL → `Quartiers."CityId"` —
-- et ces trois villes n'ont **aucun quartier géométrisé, aucun bloc, aucune adresse**. Les deux
-- niveaux intermédiaires manquent, et la livraison ne les contient pas.
--
-- ---------------------------------------------------------------------------------------------
-- POURQUOI LES BLOCS NE VIENNENT PAS DU RÉSEAU DE VOIES
-- ---------------------------------------------------------------------------------------------
-- Un bloc est un îlot cerné par des rues : polygoniser le réseau paraît la voie naturelle.
-- **Essayé, et ça ne marche pas.** Sur Ali Sabieh (49 routes + 521 pistes) `ST_Polygonize` rend
-- **44 faces, dont 5 contiennent du bâti — 20 bâtiments couverts sur 5 775.** Le réseau livré
-- n'est pas fermé topologiquement : il ne cerne rien.
--
-- Les blocs sont donc dérivés du BÂTI lui-même, par regroupement de proximité.
--
-- **Seuil de 10 m**, calibré sur le référentiel existant et non choisi au jugé :
--
--   seuil    blocs   bâtiments/bloc   aire moy.   plus gros bloc
--     5 m    2 205             2,6      269 m²               61
--    10 m      991             5,8    1 259 m²              865
--    15 m      556            10,4    3 112 m²            1 558
--    20 m      375            15,4    5 826 m²            2 852
--
--   Djibouti-ville, pour comparaison : 5 121 blocs, **8,5 adresses/bloc**, 3 314 m² de moyenne
--   (902 m² de médiane), et un plus gros bloc à **863 adresses**.
--
-- 10 m donne 5,8 bâtiments par bloc et un maximum de 865 — le profil du référentiel existant,
-- maximum compris. À 15 m et au-delà les blocs deviennent deux fois plus peuplés que la norme.
--
-- ---------------------------------------------------------------------------------------------
-- CE QUI EST PROVISOIRE, ET DOIT ÊTRE REPRIS
-- ---------------------------------------------------------------------------------------------
-- • **Un quartier unique par ville** (décision d'Ashraf), code `<VILLE>-PROV`. Ce n'est pas un
--   découpage administratif : c'est le maillon qui manquait pour que les blocs existent.
-- • ⚠️ **Ali Sabieh a déjà 3 quartiers nommés** — Château d'eau, Quartier Shell, Quartier Ali —
--   sans géométrie. Le quartier provisoire s'ajoute à eux ; il faudra répartir ses blocs entre
--   les trois le jour où leurs emprises seront saisies, et le supprimer.
-- • Les blocs n'ont **pas de `Name`** : la source CAO n'en porte aucun (ses colonnes `entity`,
--   `layer`, `color` ne contiennent que des types d'entités DXF).
-- • `AddressCode` reste NULL — il se pose à la validation d'un relevé, pas à l'import.
--
-- Tout ce lot se retire d'un coup : les codes portent le préfixe `<VILLE>-PROV`.
--
-- ⚠️ **`piste_a` (Ali Sabieh) contient une géométrie à 35,04 / 9,83** — 800 km dans les terres
-- éthiopiennes, `ogc_fid = 56`. Non utilisée ici (les blocs viennent du bâti), mais à signaler
-- à l'expert SIG avant toute reprise des pistes.

-- ⚠️ Rien n'est écrit avant le `BEGIN` : tout ce qui suit ne crée que des tables TEMPORAIRES,
-- hors transaction pour qu'un `ROLLBACK` d'essai à blanc n'emporte pas le rapport.

CREATE TEMP TABLE bati AS
SELECT ville, type_bat, ST_Force2D(g) AS g32 FROM (
  SELECT 'Ali Sabieh' AS ville, 'dur' AS type_bat, wkb_geometry AS g FROM nour.bat_dur_a
  UNION ALL SELECT 'Ali Sabieh', 'leger',  wkb_geometry FROM nour.bat_legers_a
  UNION ALL SELECT 'Ali Sabieh', 'socio',  wkb_geometry FROM nour.bat_socio_a
  UNION ALL SELECT 'Ali Sabieh', 'indus',  wkb_geometry FROM nour.bat_indus_a
  UNION ALL SELECT 'Tadjourah',  'dur',    wkb_geometry FROM nour.bat_dur_b
  UNION ALL SELECT 'Tadjourah',  'leger',  wkb_geometry FROM nour.bat_legers_b
  UNION ALL SELECT 'Tadjourah',  'socio',  wkb_geometry FROM nour.bat_socio_b
  UNION ALL SELECT 'Tadjourah',  'indus',  wkb_geometry FROM nour.bat_indus_b
  UNION ALL SELECT 'Dikhil',     'dur',    wkb_geometry FROM nour.bat_dur_c
  UNION ALL SELECT 'Dikhil',     'leger',  wkb_geometry FROM nour.bat_legers_c
  UNION ALL SELECT 'Dikhil',     'socio',  wkb_geometry FROM nour.bat_socio_c
  UNION ALL SELECT 'Dikhil',     'indus',  wkb_geometry FROM nour.bat_indus_c
) x
WHERE g IS NOT NULL AND NOT ST_IsEmpty(g);

-- Regroupement par proximité, ville par ville. `minpoints = 1` : un bâtiment isolé forme son
-- propre bloc plutôt que d'être écarté — une adresse ne se perd pas parce qu'elle est seule.
CREATE TEMP TABLE grappe AS
SELECT ville, type_bat, g32,
       ST_ClusterDBSCAN(g32, 10, 1) OVER (PARTITION BY ville) AS gid
FROM bati;

CREATE TEMP TABLE quartier AS
SELECT v.ville, c."Id" AS city_id, gen_random_uuid() AS quartier_id
FROM (SELECT DISTINCT ville FROM grappe) v
JOIN public."Cities" c ON c."Name" = v.ville;

-- Un bloc par grappe. `ST_ConvexHull` : la colonne `Blocs."Boundary"` est un POLYGON simple, et
-- l'enveloppe convexe d'une grappe en est toujours un — contrairement à l'union des bâtiments,
-- qui rendrait un MultiPolygon dès que deux bâtiments ne se touchent pas.
CREATE TEMP TABLE bloc AS
SELECT q.quartier_id, g.ville, g.gid, gen_random_uuid() AS bloc_id,
       row_number() OVER (PARTITION BY g.ville ORDER BY g.gid) AS num,
       ST_Transform(ST_ConvexHull(ST_Collect(g.g32)), 4326) AS geom
FROM grappe g JOIN quartier q ON q.ville = g.ville
GROUP BY q.quartier_id, g.ville, g.gid;

-- Une adresse par bâtiment. `ST_PointOnSurface` et non `ST_Centroid` : sur un bâtiment en L, le
-- centroïde tombe hors des murs, et `Location` doit désigner un point DANS la parcelle.
CREATE TEMP TABLE adresse AS
SELECT b.bloc_id,
       row_number() OVER (PARTITION BY b.bloc_id ORDER BY ST_X(ST_Centroid(g.g32)), ST_Y(ST_Centroid(g.g32)))::int AS numero,
       -- `ST_CollectionExtract(..., 3)` : sur un bâtiment auto-intersectant, `ST_MakeValid`
       -- rend une GeometryCollection (surfaces + lignes résiduelles) que la colonne refuse —
       -- « Geometry type (GeometryCollection) does not match column type (MultiPolygon) ».
       -- On ne garde que les surfaces.
       ST_Multi(ST_CollectionExtract(ST_Transform(ST_MakeValid(g.g32), 4326), 3)) AS boundary,
       ST_Transform(ST_PointOnSurface(ST_CollectionExtract(ST_MakeValid(g.g32), 3)), 4326) AS location
FROM grappe g JOIN bloc b ON b.ville = g.ville AND b.gid = g.gid;

CREATE TEMP TABLE rapport(ordre int, section text, detail text, valeur text);

INSERT INTO rapport
SELECT 1, 'avant', c."Name",
       (SELECT count(*) FROM public."Quartiers" q WHERE q."CityId" = c."Id") || ' quartiers, ' ||
       (SELECT count(*) FROM public."Blocs" b JOIN public."Quartiers" q ON q."Id" = b."QuartierId" WHERE q."CityId" = c."Id") || ' blocs, ' ||
       (SELECT count(*) FROM public."Adresses" a JOIN public."Blocs" b ON b."Id" = a."BlocId"
         JOIN public."Quartiers" q ON q."Id" = b."QuartierId" WHERE q."CityId" = c."Id") || ' adresses'
FROM public."Cities" c;

INSERT INTO rapport
SELECT 2, 'a creer', b.ville,
       count(*) || ' blocs, ' || (SELECT count(*) FROM adresse a WHERE a.bloc_id IN
         (SELECT bloc_id FROM bloc b2 WHERE b2.ville = b.ville)) || ' adresses'
FROM bloc b GROUP BY b.ville;

INSERT INTO rapport
SELECT 3, 'controle', b.ville,
       round(avg(n), 1) || ' adresses/bloc, plus gros bloc : ' || max(n) ||
       ' (Djibouti-ville : 8,5 et 863)'
FROM (SELECT b.ville, b.bloc_id, count(a.*) AS n FROM bloc b JOIN adresse a ON a.bloc_id = b.bloc_id
      GROUP BY b.ville, b.bloc_id) b GROUP BY b.ville;

-- Un bâtiment qui n'aboutit pas à une adresse est une perte silencieuse. Le compte doit tomber juste.
INSERT INTO rapport
SELECT 3, 'controle', 'total',
       (SELECT count(*) FROM bati) || ' batiments en entree, ' ||
       (SELECT count(*) FROM adresse) || ' adresses en sortie (doivent etre egaux)';

INSERT INTO rapport
SELECT 4, 'provisoire', 'Ali Sabieh',
       'garde ses 3 quartiers sans emprise (Chateau d eau, Quartier Shell, Quartier Ali) — le quartier PROV s ajoute a eux';

-- Seules les écritures qui suivent sont dans la transaction.
BEGIN;

INSERT INTO public."Quartiers" ("Id", "Nom", "Code", "CityId", "Boundary")
SELECT q.quartier_id, q.ville || ' (provisoire)', upper(replace(q.ville, ' ', '')) || '-PROV', q.city_id,
       -- L'emprise du quartier est celle de ses blocs : elle se déduit, elle ne s'invente pas.
       (SELECT ST_ConvexHull(ST_Collect(b.geom)) FROM bloc b WHERE b.ville = q.ville)
FROM quartier q;

INSERT INTO public."Blocs" ("Id", "Code", "QuartierId", "Boundary", "Number")
SELECT b.bloc_id,
       upper(replace(b.ville, ' ', '')) || '-PROV-' || lpad(b.num::text, 4, '0'),
       b.quartier_id, b.geom, b.num::int
FROM bloc b;

INSERT INTO public."Adresses" ("Id", "BlocId", "Numero", "Boundary", "Location")
SELECT gen_random_uuid(), a.bloc_id, a.numero, a.boundary, a.location
FROM adresse a;

-- Remplacer par ROLLBACK pour un essai à blanc.
COMMIT;

INSERT INTO rapport
SELECT 5, 'apres ecriture', c."Name",
       (SELECT count(*) FROM public."Quartiers" q WHERE q."CityId" = c."Id") || ' quartiers, ' ||
       (SELECT count(*) FROM public."Blocs" b JOIN public."Quartiers" q ON q."Id" = b."QuartierId" WHERE q."CityId" = c."Id") || ' blocs, ' ||
       (SELECT count(*) FROM public."Adresses" a JOIN public."Blocs" b ON b."Id" = a."BlocId"
         JOIN public."Quartiers" q ON q."Id" = b."QuartierId" WHERE q."CityId" = c."Id") || ' adresses'
FROM public."Cities" c;

SELECT section, detail, valeur FROM rapport ORDER BY ordre, detail;
