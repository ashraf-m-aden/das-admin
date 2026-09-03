-- Recalcule le contour d'affichage : la TERRE FERME d'OpenStreetMap, plus un rattrapage local.
--
-- ⚠️ **CE CONTOUR N'EST PAS UNE FRONTIÈRE OPPOSABLE.** C'est un CADRE D'AFFICHAGE. La colonne
-- `source` de la table le dit aussi, pour que personne ne s'y trompe dans six mois.
--
-- POURQUOI ce découpage, et pas une source toute faite. Quatre tracés essayés, deux critères :
-- dessiner le golfe de Tadjoura (sinon le pays devient une patate méconnaissable), et contenir
-- ce que la carte affiche.
--
--   | Tracé                                  | Golfe   | Référentiel contenu           |
--   |----------------------------------------|---------|-------------------------------|
--   | Natural Earth 10m (geoBoundaries open) | oui     | non — 58 blocs, 375 adresses  |
--   | geoBoundaries humanitaire (FEWS/HDX)   | oui     | non — 28 blocs, 241 adresses  |
--   | OSM relation 192801, telle quelle      | **non** | oui                           |
--   | **OSM relation 192801 ∩ côte OSM**     | **oui** | **oui**, après rattrapage     |
--
-- La relation administrative OSM inclut les EAUX TERRITORIALES : elle va jusqu'à 43,658 dans le
-- détroit de Bab-el-Mandeb et ferme le golfe en ligne droite. Elle contient tout, forcément —
-- mais elle ne ressemble pas à Djibouti. D'où le découpage par le trait de côte.
--
-- Et c'est le trait de côte OSM qui change tout : il connaît les TERRE-PLEINS du port, que les
-- jeux mondiaux ignorent. C'est ce qui fait passer le débordement de 375 adresses à 5.
--
-- CE QUE FAIT LE CALCUL :
--   1. découpe le polygone administratif par le trait de côte (`ST_Split`) → 56 morceaux ;
--   2. garde le plus grand — le continent, 21 671 km², il contient le centre-ville. Le reste est
--      la mer, plus quelques îlots sans donnée : Moucha et Maskali sont volontairement laissées
--      dehors, aucune adresse n'y est recensée et elles auraient ajouté des boucles isolées ;
--   3. rattrape à 30 m les rares objets qui mordent encore sur l'eau (bordures de quartier
--      tracées un peu large). 30 m et non 400 : la correction doit rester invisible à l'œil.
--
-- LE CRITÈRE EXACT : ce qui est DESSINÉ. Après ce calcul, 0 objet dehors sur les couches que
-- `map-style.json` sert vraiment — Blocs, Adresses (polygone ET point), Quartiers, Streets,
-- `ilots_extension`, les trois `voierie_*`.
--
-- Deux tables SIG BRUTES restent partiellement dehors, et c'est assumé : `delimitations_quartiers`
-- (30 tracés sur 130) et `ilots_codifies` (2 sur 3 700) débordent en mer. Ce sont des imports de
-- travail, servis par AUCUNE source du style, donc jamais affichés. Les englober obligeait à
-- rattraper des polygones dessinés au large : le contour sortait en **8 morceaux**, sept boucles
-- parasites pour de la donnée que personne ne voit. Le correctif est côté SIG, pas côté cadre.
--
-- QUAND LE REJOUER : après tout ajout hors de l'emprise actuelle (nouvelle ville, extension de
-- Balbala, nouveau lot SIG). Le contour est FIGÉ dans `contour-national-insert.sql`, il ne se met
-- pas à jour tout seul ; le contrôle du §4 de `contour-national.sql` dit s'il est encore valable.
--
--   1. psql "$DB" -tA -o contour.geojson \
--        -v adm="$(cat scripts/sig/contour-national-dji-osm.geojson)" \
--        -v cote="$(cat scripts/sig/contour-national-cote-osm.geojson)" \
--        -f scripts/sig/contour-national-etendre.sql
--   2. python3 scripts/sig/contour-national-depuis-geojson.py contour.geojson --remplacer \
--        --source "…" > scripts/sig/contour-national-insert.sql
--   3. psql "$DB" -v ON_ERROR_STOP=1 -f scripts/sig/contour-national-insert.sql
--
-- Pour rafraîchir les deux entrées depuis OSM (elles datent du 2026-09-02) :
--   • polygone administratif, Nominatim — champ `[0].geojson` de
--     https://nominatim.openstreetmap.org/search?country=Djibouti&format=json&polygon_geojson=1&limit=1
--   • trait de côte, Overpass (200 ways, 40 444 nœuds au 2026-09-02) — assembler les `geometry`
--     en MultiLineString :
--       [out:json][timeout:180];way["natural"="coastline"](10.85,41.70,12.80,43.50);out geom;
--
-- ⚠️ **ODbL : attribution obligatoire dès l'affichage.** Elle est portée par le champ
-- `attribution` de la source `contourNational` dans `map-style.json`, que le contrôle
-- d'attribution de MapLibre rend tout seul. Ne pas retirer ce champ.
--
-- Ce script ne fait que LIRE : il écrit un GeoJSON sur la sortie standard, rien en base — le rôle
-- lecture seule `martin_ro` suffit. Les deux GeoJSON sont lus par le CLIENT via `-v` ; passer par
-- `pg_read_file` viserait le disque du SERVEUR et exigerait `pg_read_server_files`.
--
-- ⚠️ `ST_Node` sur le trait de côte est INDISPENSABLE : les 200 ways d'Overpass se touchent sans
-- être nœudés entre eux. Sans lui, `ST_Split` renvoie le polygone intact — donc la patate, sans
-- la moindre erreur pour le signaler.

WITH adm AS (SELECT ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(:'adm'), 4326)) AS g),
cote AS (SELECT ST_Node(ST_SetSRID(ST_GeomFromGeoJSON(:'cote'), 4326)) AS g),
morceaux AS (SELECT (ST_Dump(ST_Split(a.g, c.g))).geom AS g FROM adm a, cote c),
continent AS (SELECT g FROM morceaux ORDER BY ST_Area(g::geography) DESC LIMIT 1),
debordent AS (
  SELECT b."Boundary" AS g FROM public."Blocs" b, continent c WHERE b."Boundary" IS NOT NULL AND NOT ST_Within(b."Boundary", c.g)
  UNION ALL SELECT a."Boundary" FROM public."Adresses" a, continent c WHERE a."Boundary" IS NOT NULL AND NOT ST_Within(a."Boundary", c.g)
  UNION ALL SELECT q."Boundary" FROM public."Quartiers" q, continent c WHERE q."Boundary" IS NOT NULL AND NOT ST_Within(q."Boundary", c.g)
  UNION ALL SELECT s."Boundary" FROM public."Streets" s, continent c WHERE s."Boundary" IS NOT NULL AND NOT ST_Within(s."Boundary", c.g)
  UNION ALL SELECT ST_Transform(p.wkb_geometry,4326) FROM public.parcelles_codifiees p, continent c WHERE p.wkb_geometry IS NOT NULL AND NOT ST_Within(ST_Transform(p.wkb_geometry,4326), c.g)
  UNION ALL SELECT ST_Transform(i.wkb_geometry,4326) FROM public.ilots_extension i, continent c WHERE i.wkb_geometry IS NOT NULL AND NOT ST_Within(ST_Transform(i.wkb_geometry,4326), c.g)
),
rattrapage AS (SELECT ST_Transform(ST_Buffer(ST_Transform(ST_Union(ST_MakeValid(g)),32638), 30), 4326) AS g FROM debordent),
final AS (
  SELECT ST_Multi(ST_MakeValid(ST_SimplifyPreserveTopology(
           ST_Union(c.g, COALESCE(r.g, ST_GeomFromText('POLYGON EMPTY',4326))), 0.00005))) AS g
  FROM continent c LEFT JOIN rattrapage r ON true
)
SELECT ST_AsGeoJSON(g, 7) FROM final;
