-- Emprise des villes recalculée depuis leur tissu réel (quartiers + blocs).
--
--   Dans pgAdmin : ouvrir ce fichier et l'exécuter tel quel.
--   En ligne de commande : psql "$DB" -v ON_ERROR_STOP=1 -f scripts/sig/cities-emprise-depuis-quartiers.sql
--
-- SQL pur, aucune commande psql : pgAdmin rejette `\set` / `\echo` / `\copy`.
--
-- ⚠️ **ORDRE : `contour-national-insert.sql` D'ABORD.** L'emprise est découpée sur le contour
-- national — sans lui en base, le découpage est simplement sauté (l'emprise reste alors à
-- cheval sur la mer, cf. § DÉCOUPAGE).
--
-- ⚠️ **ESSAI À BLANC : remplacer le `COMMIT;` final par `ROLLBACK;`.** Le rapport s'affiche
-- quand même, rien n'est écrit. Sauvegarde préalable :
-- `scripts/sig/nour/backup-cities-avant-2026-09-04.csv`.
--
-- ---------------------------------------------------------------------------------------------
-- LE PROBLÈME
-- ---------------------------------------------------------------------------------------------
-- État au 2026-09-05, après la livraison `nour` :
--
--   | Ville      | km²   | points | quartiers avec emprise |
--   |------------|------:|-------:|-----------------------:|
--   | Dikhil     | 6 633 |    248 |                      0 |
--   | Tadjourah  | 6 571 |    712 |                      0 |
--   | Obock      | 4 409 |    731 |                      0 |
--   | Ali Sabieh | 2 040 |    135 |                      0 |
--   | Arta       | 1 825 |    640 |                      0 |
--   | Djibouti   |    53 |     36 |                     76 |
--
-- Les cinq premières portent le polygone de **région** — c'est l'emprise provisoire posée par
-- `95_`/`96_`, assumée comme telle. Djibouti, elle, porte un polygone de 36 sommets pour 53 km² :
-- il CONTIENT bien tout le référentiel (0 quartier, 0 bloc, 0 adresse dehors), mais il est deux
-- fois plus large que le tissu réel et sa forme anguleuse ne ressemble à rien de reconnaissable.
--
-- ---------------------------------------------------------------------------------------------
-- CE QU'ON UTILISE, ET POURQUOI PAS AUTRE CHOSE
-- ---------------------------------------------------------------------------------------------
-- Trois sources écartées :
--
-- • **OSM.** Il n'existe AUCUNE limite administrative de Djibouti-ville dans OSM : les seules
--   relations qui portent ce nom sont de niveau 4, c'est-à-dire la région — exactement ce qu'on
--   cherche à remplacer. Vérifié le 2026-09-05 sur les niveaux 4 à 9 de la bbox nationale.
-- • **Union brute des quartiers** (76 emprises) : 25 km² mais **2 morceaux disjoints**, la ville
--   et Balbala ne se touchant pas.
-- • **Union de `delimitations_quartiers`** (130 polygones SIG) : 108 km² en **32 morceaux**, et
--   9 blocs dehors quand même. Ce n'est pas une emprise de ville.
--
-- Retenu : le tissu du référentiel lui-même, refermé. Dans ce modèle une ville EST l'ensemble de
-- ses quartiers — c'est la hiérarchie du domaine, pas une approximation.
--
-- ---------------------------------------------------------------------------------------------
-- LES TROIS RÉGLAGES, CHACUN JUSTIFIÉ PAR UNE MESURE
-- ---------------------------------------------------------------------------------------------
-- 1. **Fermeture à 500 m** (dilater puis éroder). Elle comble les rues et les terrains nus entre
--    quartiers. Mesuré : 150 m et 300 m laissent **2 morceaux** (Balbala détaché), 500 m en
--    donne **1 seul**, 800 m n'apporte plus rien et gonfle l'emprise.
--
-- 2. **Union avec la forme d'origine.** Une fermeture n'est pas neutre sur les parties fines :
--    l'érosion rogne les langues étroites. Sans cette union, **225 blocs** ressortaient de leur
--    propre ville.
--
-- 3. **Simplification à 10 m, puis dilatation de 10 m.** La simplification déplace le bord de
--    quelques mètres, et les quartiers qui l'épousaient se retrouvaient dehors — **28** dans le
--    test. Les 10 m rattrapent ce déplacement pour un écart invisible à l'écran.
--
-- Sans ces trois précautions le résultat *paraît* correct : c'est la vérification `ST_Within`
-- qui les a rendues nécessaires, pas la lecture du rendu.
--
-- ---------------------------------------------------------------------------------------------
-- PORTÉE
-- ---------------------------------------------------------------------------------------------
-- Le script ne touche QUE les villes ayant au moins un quartier avec emprise — aujourd'hui
-- Djibouti seule. Les cinq autres gardent leur polygone de région : il n'existe aucune donnée
-- pour en dériver mieux, et inventer une emprise serait pire que d'en afficher une provisoire.
-- Le jour où leurs quartiers seront saisis, ce même script les traitera sans modification.
--
-- ⚠️ `Cities."Boundary"` alimente le `bbox` de la cascade hiérarchique
-- (`hierarchy-api.service.ts`) et les couches `cities-line` / `cities-label`. Rétrécir l'emprise
-- de Djibouti de 53 à 29 km² resserre donc aussi le cadrage automatique sur la ville — c'est
-- l'effet recherché.

-- Tout le rapprochement se fait en 4326, la projection des données. `ST_Within` ne dépend pas
-- du système tant que les deux géométries partagent le même : reprojeter les 5 121 blocs pour
-- les comparer coûtait plusieurs minutes pour un résultat identique. On ne passe en UTM 38N
-- qu'au moment du buffer, seule opération qui exige des mètres vrais.
CREATE TEMP TABLE tissu AS
SELECT c."Id" AS city_id, c."Name" AS ville, ST_Union(ST_MakeValid(q."Boundary")) AS g
FROM public."Cities" c
JOIN public."Quartiers" q ON q."CityId" = c."Id" AND q."Boundary" IS NOT NULL
GROUP BY c."Id", c."Name";

-- Les blocs qui débordent de l'union des quartiers. 216 au 2026-09-05, dont **203 rattachés à
-- 3 quartiers SANS emprise** : ils sortent parce que leur quartier n'est pas dessiné, pas parce
-- que le calcul les oublie. Les inclure évite qu'une ville exclue ses propres blocs, et c'est
-- aussi ce qui rend le trou de donnée visible plutôt que silencieux.
-- L'emprise se dérive des QUARTIERS seuls, pas des blocs.
--
-- Tentative écartée : unir aussi les 1 649 blocs qui débordent de leur propre quartier. Deux
-- raisons de renoncer, l'une pratique et l'autre de fond.
--   • Le calcul ne rendait pas la main en cinq minutes — l'union de ~1 700 polygones puis sa
--     fermeture, contre quelques secondes sur les 76 quartiers seuls.
--   • Surtout : **1 376 de ces blocs appartiennent à 8 quartiers SANS emprise.** Gonfler le
--     contour de la ville pour les rattraper masquerait le vrai problème. Un quartier non
--     dessiné se corrige à la source ; le contour n'a pas à compenser un trou de saisie.
-- Le rapport les compte, pour que le trou reste visible.
CREATE TEMP TABLE emprise AS
SELECT city_id, ville,
       ST_Multi(ST_Transform(ST_Buffer(ST_Union(m, ferme), 10), 4326)) AS g
FROM (
  SELECT city_id, ville, m,
         -- `quad_segs=2` : 8 segments par cercle au lieu de 32. Sur 500 m de rayon l'écart est
         -- invisible et le buffer produit bien moins de sommets.
         ST_Buffer(ST_Buffer(m, 500, 'quad_segs=2'), -500, 'quad_segs=2') AS ferme
  FROM (SELECT t.city_id, t.ville,
               -- 10 m sur une emprise de quartier, c'est sous le trait de crayon.
               ST_SimplifyPreserveTopology(ST_Transform(t.g, 32638), 10) AS m
        FROM tissu t) a
) b;

-- ---------------------------------------------------------------------------------------------
-- DÉCOUPAGE SUR LE CONTOUR NATIONAL
-- ---------------------------------------------------------------------------------------------
-- Une ville ne sort pas de son pays : là où elle atteint la mer, sa limite EST le trait de côte.
-- Sans ce découpage l'emprise dérivée flottait — mesuré le 2026-09-06 :
--
--     0,15 km² de la ville tombaient en MER (hors du contour national) ;
--     775 m seulement de ses 41,9 km de périmètre suivaient la côte.
--
-- La cause est mécanique : la fermeture à 500 m puis la dilatation de 10 m poussent le bord
-- au-delà des quartiers, donc par-dessus l'eau sur le front de mer. Après découpage : 0 km² en
-- mer, et **5 013 m** de limite commune avec la côte — la ville s'appuie enfin dessus.
--
-- ⚠️ Si `contour_national` est vide — script `contour-national-insert.sql` jamais appliqué —
-- le `FROM` ne rend aucune ligne, l'`UPDATE` ne touche rien, et l'emprise reste simplement non
-- découpée. C'est voulu : une intersection avec du NULL aurait EFFACÉ l'emprise de la ville.
-- `ST_CollectionExtract(…, 3)` : l'intersection d'un polygone et d'un polygone peut rendre une
-- collection contenant des lignes ou des points là où les bords se frôlent. On ne garde que les
-- surfaces, sinon `Boundary` refuse la géométrie.
UPDATE emprise e
SET g = ST_Multi(ST_CollectionExtract(ST_Intersection(e.g, n.geom), 3))
FROM (SELECT geom FROM public.contour_national LIMIT 1) n
WHERE NOT ST_IsEmpty(COALESCE(ST_Intersection(e.g, n.geom), 'POLYGON EMPTY'::geometry));

CREATE TEMP TABLE rapport(ordre int, section text, detail text, valeur text);

INSERT INTO rapport
SELECT 1, 'avant', c."Name",
       round((ST_Area(c."Boundary"::geography)/1e6)::numeric) || ' km2, ' || ST_NPoints(c."Boundary") || ' points'
FROM public."Cities" c WHERE c."Boundary" IS NOT NULL;

INSERT INTO rapport
SELECT 2, 'recalculee', e.ville,
       round((ST_Area(e.g::geography)/1e6)::numeric) || ' km2, ' || ST_NPoints(e.g) || ' points, '
       || ST_NumGeometries(e.g) || ' partie(s)'
FROM emprise e;

-- Garde-fou : une emprise qui exclut un quartier de sa propre ville est un échec, pas un
-- arrondi. Le rapport le dit avant l'écriture.
-- Le contrôle porte sur la partie TERRESTRE du quartier. Depuis le découpage, un quartier
-- dessiné par-dessus l'eau — cela existe sur le front de mer — ne peut plus être entièrement
-- dans une emprise qui, elle, s'arrête au rivage. Le compter comme « hors emprise » signalerait
-- un faux défaut du calcul là où le défaut est dans le tracé du quartier.
INSERT INTO rapport
SELECT 3, 'controle', e.ville,
-- Seuil de 100 m² et non égalité stricte : l'emprise et la part terrestre du quartier sont
-- découpées sur le même contour par deux chemins de calcul différents, et leurs bords ne
-- coïncident pas au micromètre. Sans tolérance, le contrôle signalerait des échardes de
-- quelques centimètres carrés — du bruit qui masquerait un vrai quartier oublié.
       (SELECT count(*) FROM public."Quartiers" q
         WHERE q."CityId" = e.city_id AND q."Boundary" IS NOT NULL
           AND ST_Area(ST_Difference(
                 COALESCE(ST_CollectionExtract(ST_Intersection(q."Boundary",
                   (SELECT geom FROM public.contour_national LIMIT 1)), 3), q."Boundary"),
                 e.g)::geography) > 100)::text || ' quartier(s) hors emprise, part terrestre (doit valoir 0)'
FROM emprise e;

-- Et le constat séparé : les quartiers qui débordent en mer. C'est une anomalie de tracé, pas
-- un défaut de l'emprise — mais elle ne doit pas rester invisible.
INSERT INTO rapport
SELECT 3, 'quartiers debordant en mer', q."Nom",
       round((ST_Area(ST_Difference(q."Boundary",
         (SELECT geom FROM public.contour_national LIMIT 1))::geography))::numeric) || ' m2 sur l eau'
FROM public."Quartiers" q
WHERE q."Boundary" IS NOT NULL
  AND NOT ST_Within(q."Boundary", (SELECT geom FROM public.contour_national LIMIT 1))
  AND ST_Area(ST_Difference(q."Boundary",
        (SELECT geom FROM public.contour_national LIMIT 1))::geography) > 100;

INSERT INTO rapport
SELECT 3, 'controle', e.ville,
       round((ST_Area(ST_Difference(e.g, (SELECT geom FROM public.contour_national LIMIT 1))::geography)/1e6)::numeric, 3)::text
       || ' km2 hors du contour national (doit valoir 0)'
FROM emprise e;

-- La colonne ne peut porter qu'un polygone : si l'emprise en compte plusieurs, les suivantes
-- seront écartées à l'écriture. Le dire AVANT, pas après.
INSERT INTO rapport
SELECT 3, 'controle', e.ville,
       (ST_NumGeometries(e.g) - 1) || ' partie(s) ecartee(s) — la colonne Boundary est un Polygon simple'
FROM emprise e WHERE ST_NumGeometries(e.g) > 1;

INSERT INTO rapport
SELECT 4, 'inchangee', c."Name", 'aucun quartier avec emprise — polygone de region conserve'
FROM public."Cities" c
WHERE NOT EXISTS (SELECT 1 FROM emprise e WHERE e.city_id = c."Id");

-- Le trou de saisie, dit explicitement : ces quartiers ne sont dessinés nulle part, donc ni
-- leurs blocs ni eux-mêmes ne pèsent sur l'emprise de leur ville.
INSERT INTO rapport
SELECT 4, 'a corriger a la source', q."Nom",
       count(b.*) || ' bloc(s) — quartier sans emprise'
FROM public."Quartiers" q
LEFT JOIN public."Blocs" b ON b."QuartierId" = q."Id" AND b."Boundary" IS NOT NULL
WHERE q."Boundary" IS NULL
GROUP BY q."Nom";

-- Seule l'écriture qui suit est dans la transaction.
BEGIN;

-- ⚠️ `Cities."Boundary"` est un **POLYGON simple**, pas un MultiPolygon — comme `Quartiers` et
-- `Blocs` ; seul `contour_national` est multi. Écrire un `ST_Multi(...)` ici échoue net :
-- « Geometry type (MultiPolygon) does not match column type (Polygon) ». Rencontré le
-- 2026-09-06, et le test en conteneur ne l'avait PAS vu parce qu'il recréait la table de
-- mémoire, avec le mauvais type. Une reconstitution de schéma n'est pas une vérification.
--
-- On écrit donc la plus grande partie. Les autres seraient perdues en silence : le rapport les
-- compte juste au-dessus, et c'est le seul endroit où l'on peut s'en apercevoir.
UPDATE public."Cities" c
SET "Boundary" = (SELECT d.geom FROM ST_Dump(e.g) d ORDER BY ST_Area(d.geom) DESC LIMIT 1)
FROM emprise e WHERE e.city_id = c."Id";

-- Remplacer par ROLLBACK pour un essai à blanc.
COMMIT;

INSERT INTO rapport
SELECT 5, 'apres ecriture', c."Name",
       round((ST_Area(c."Boundary"::geography)/1e6)::numeric) || ' km2, ' || ST_NPoints(c."Boundary") || ' points'
FROM public."Cities" c WHERE c."Boundary" IS NOT NULL;

SELECT section, detail, valeur FROM rapport ORDER BY ordre, detail;
