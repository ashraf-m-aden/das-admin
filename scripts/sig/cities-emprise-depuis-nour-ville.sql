-- Emprise des villes depuis la couche SIG `nour.quartiers_ville_pg`, ajustée sur `public."Cities"`.
--
--   Dans pgAdmin : ouvrir ce fichier et l'exécuter tel quel.
--   En ligne de commande : psql "$DB" -v ON_ERROR_STOP=1 -f scripts/sig/cities-emprise-depuis-nour-ville.sql
--
-- SQL pur, aucune commande psql. **Remplace `cities-emprise-depuis-quartiers.sql`**, qui dérivait
-- l'emprise des quartiers du référentiel : ici la source est la livraison SIG elle-même.
--
-- ⚠️ **ORDRE : `contour-national-insert.sql` D'ABORD** — l'emprise est découpée dessus.
-- ⚠️ **ESSAI À BLANC : remplacer le `COMMIT;` final par `ROLLBACK;`.**
--
-- ---------------------------------------------------------------------------------------------
-- LE PIÈGE DE NOMMAGE, À CONNAÎTRE AVANT DE LIRE LA SUITE
-- ---------------------------------------------------------------------------------------------
-- **Deux fichiers différents de la livraison s'appellent `VILLE.sql`** (cf. `nour/LISEZMOI.md`).
-- `gen_nour.py` les sépare :
--
--   VILLE.sql       (lot 16h31)   → nour.villes_pt            6 POINTS, les chefs-lieux
--   VILLE (1).sql   (zip)         → nour.quartiers_ville_pg   130 POLYGONES
--
-- Le second ne contient donc PAS des villes mais des quartiers — c'est écrit dans le LISEZMOI,
-- et ses 130 géométries sont identiques à `public.delimitations_quartiers`. Il reste néanmoins
-- la bonne source ici, pour une raison : **il porte une colonne `region`**, et c'est elle qui
-- désigne la ville. Ce sont les quartiers, mais ils savent à quelle ville ils appartiennent.
--
--   region     communes                          polygones   nommés
--   DJIBOUTI   BOULAOS / BALBALA / RAS DIKA           128        91
--   ARTA       (aucune)                                 2         0
--
-- `villes_pt` n'a que des points : aucune surface à en tirer sans inventer un rayon.
--
-- ---------------------------------------------------------------------------------------------
-- LES QUATRE ÉTAPES, CHACUNE JUSTIFIÉE PAR UNE MESURE (2026-09-06)
-- ---------------------------------------------------------------------------------------------
-- 1. **Dissolution par `region`.** DJIBOUTI donne 97 km² mais **32 morceaux disjoints** ;
--    la colonne `Cities."Boundary"` est un POLYGON simple, elle n'en garde qu'un.
--
-- 2. **Fermeture à 500 m.** Elle recolle le tissu : 32 morceaux → 12. Au-delà, plus rien ne
--    bouge (testé à 800 m : toujours 12), les pièces restantes sont réellement détachées.
--
-- 3. **On garde la plus grande.** Mesuré : elle fait 101 km² et contient **les 5 121 blocs** ;
--    les 11 autres font **0,00 km² chacune** — des échardes de la numérisation SIG. Le rapport
--    les compte quand même : une pièce écartée en silence est ce qu'on ne peut pas diagnostiquer.
--
-- 4. **Découpage sur le contour national.** Les polygones SIG débordent sur l'eau :
--    **3,28 km² en mer pour Djibouti**, 0,11 pour Arta. Après découpage, la limite de la ville
--    EST le trait de côte là où elle l'atteint — et il reste une seule pièce dans les deux cas.
--
-- Résultat : Djibouti 97,8 km², Arta 10,9 km². Arta gagne une emprise réelle au lieu de son
-- polygone de région (1 825 km²) ; les quatre autres villes n'ont aucun polygone dans cette
-- couche et gardent le leur.
--
-- ---------------------------------------------------------------------------------------------
-- L'AJUSTEMENT SUR `public."Cities"`
-- ---------------------------------------------------------------------------------------------
-- Le rapprochement se fait sur le NOM, en majuscules sans accents : `region` vaut `DJIBOUTI` et
-- `ARTA`, la table porte `Djibouti` et `Arta`. Une région sans ville correspondante n'écrit
-- rien et le rapport la signale — plutôt que de créer une ville que personne n'a demandée.

CREATE TEMP TABLE source AS
SELECT upper(unaccent(btrim(region))) AS cle,
       ST_SimplifyPreserveTopology(ST_Transform(ST_Union(ST_MakeValid(wkb_geometry)), 32638), 10) AS g
FROM nour.quartiers_ville_pg
WHERE region IS NOT NULL AND wkb_geometry IS NOT NULL
GROUP BY 1;

-- Fermeture puis union avec la forme d'origine : l'érosion seule rogne les langues étroites.
-- `quad_segs=2` (8 segments par cercle au lieu de 32) — sur 500 m l'écart est invisible et le
-- buffer produit bien moins de sommets.
CREATE TEMP TABLE ferme AS
SELECT cle, ST_Union(g, ST_Buffer(ST_Buffer(g, 500, 'quad_segs=2'), -500, 'quad_segs=2')) AS g
FROM source;

CREATE TEMP TABLE retenue AS
SELECT f.cle,
       (SELECT d.geom FROM ST_Dump(f.g) d ORDER BY ST_Area(d.geom) DESC LIMIT 1) AS g,
       ST_NumGeometries(ST_Multi(f.g)) - 1 AS ecartees,
       (SELECT round((sum(ST_Area(d.geom))/1e6)::numeric, 3) FROM ST_Dump(f.g) d
         WHERE ST_Area(d.geom) < (SELECT max(ST_Area(d2.geom)) FROM ST_Dump(f.g) d2)) AS km2_ecartes
FROM ferme f;

-- Découpage sur le contour national. Si la table est vide, le `FROM` ne rend aucune ligne,
-- l'`UPDATE` ne touche rien et l'emprise reste non découpée — une intersection avec du NULL
-- l'aurait EFFACÉE.
UPDATE retenue r
SET g = ST_CollectionExtract(ST_Intersection(r.g, n.g), 3)
FROM (SELECT ST_Transform(geom, 32638) AS g FROM public.contour_national LIMIT 1) n
WHERE NOT ST_IsEmpty(COALESCE(ST_Intersection(r.g, n.g), 'POLYGON EMPTY'::geometry));

CREATE TEMP TABLE emprise AS
SELECT r.cle, c."Id" AS city_id, c."Name" AS ville,
       ST_Transform((SELECT d.geom FROM ST_Dump(r.g) d ORDER BY ST_Area(d.geom) DESC LIMIT 1), 4326) AS g,
       r.ecartees, r.km2_ecartes
FROM retenue r
JOIN public."Cities" c ON upper(unaccent(btrim(c."Name"))) = r.cle;

-- ---------------------------------------------------------------------------------------------
-- AJUSTEMENT SUR LE RÉFÉRENTIEL : la ville ne peut pas exclure ses propres blocs
-- ---------------------------------------------------------------------------------------------
-- Le tracé SIG s'arrête juste avant quelques blocs du front de mer. Mesuré le 2026-09-06 :
-- **6 blocs de Djibouti dépassaient**, de 4 627 m² au maximum et jusqu'à 0 m² pour le dernier —
-- une écharde topologique. Tous sont dans le pays ; ce sont Héron, Ilôt du Héron, Haramous,
-- Plateau du Serpent, Boulaos, Zone Industrielle Sud.
--
-- On absorbe donc ces blocs-là, et EUX SEULS. Sur 97,7 km², les quelques milliers de mètres
-- carrés ajoutés ne déforment rien, et le contrôle « bloc hors emprise » retombe à 0 — ce qui
-- lui rend son sens : il ne signalera plus que de vrais oublis.
UPDATE emprise e
SET g = (SELECT d.geom FROM ST_Dump(
           ST_CollectionExtract(
             ST_Intersection(
               ST_Union(e.g, (SELECT ST_Union(ST_MakeValid(b."Boundary"))
                              FROM public."Blocs" b
                              JOIN public."Quartiers" q ON q."Id" = b."QuartierId"
                              WHERE q."CityId" = e.city_id AND b."Boundary" IS NOT NULL
                                AND NOT ST_Within(b."Boundary", e.g))),
               (SELECT geom FROM public.contour_national LIMIT 1)),
           3)) d ORDER BY ST_Area(d.geom) DESC LIMIT 1)
WHERE EXISTS (SELECT 1 FROM public."Blocs" b
              JOIN public."Quartiers" q ON q."Id" = b."QuartierId"
              WHERE q."CityId" = e.city_id AND b."Boundary" IS NOT NULL
                AND NOT ST_Within(b."Boundary", e.g));

CREATE TEMP TABLE rapport(ordre int, section text, detail text, valeur text);

INSERT INTO rapport
SELECT 1, 'avant', c."Name",
       round((ST_Area(c."Boundary"::geography)/1e6)::numeric) || ' km2, ' || ST_NPoints(c."Boundary") || ' points'
FROM public."Cities" c WHERE c."Boundary" IS NOT NULL;

INSERT INTO rapport
SELECT 2, 'recalculee', e.ville,
       round((ST_Area(e.g::geography)/1e6)::numeric, 1) || ' km2, ' || ST_NPoints(e.g) || ' points'
FROM emprise e;

-- Les pièces écartées faute de place dans une colonne mono-polygone.
INSERT INTO rapport
SELECT 3, 'controle', e.ville,
       e.ecartees || ' piece(s) ecartee(s), ' || coalesce(e.km2_ecartes, 0) || ' km2 au total'
FROM emprise e WHERE e.ecartees > 0;

INSERT INTO rapport
SELECT 3, 'controle', e.ville,
       round((ST_Area(ST_Difference(e.g, (SELECT geom FROM public.contour_national LIMIT 1))::geography)/1e6)::numeric, 3)
       || ' km2 hors du contour national (doit valoir 0)'
FROM emprise e;

-- ⚠️ Tolérance de 1 m², pas `ST_Within` seul. Après l'absorption ci-dessus, cinq blocs
-- ressortaient encore alors qu'ils ont **0 m² dehors** et touchent l'emprise : leurs bords
-- coïncident avec elle au micromètre près et `ST_Within` rend `false` sur des échardes
-- infinitésimales. Sans tolérance, le contrôle crie sur du bruit et on cesse de le lire.
INSERT INTO rapport
SELECT 3, 'controle', e.ville,
       (SELECT count(*) FROM public."Blocs" b
         JOIN public."Quartiers" q ON q."Id" = b."QuartierId"
         WHERE q."CityId" = e.city_id AND b."Boundary" IS NOT NULL
           AND ST_Area(ST_Difference(b."Boundary", e.g)::geography) > 1)::text
       || ' bloc(s) hors emprise, au-dela de 1 m2 (doit valoir 0)'
FROM emprise e;

-- Une region SIG sans ville correspondante : on ne cree rien, on le dit.
INSERT INTO rapport
SELECT 4, 'sans correspondance', r.cle, 'aucune ville de ce nom dans Cities — rien ecrit'
FROM retenue r WHERE NOT EXISTS (SELECT 1 FROM emprise e WHERE e.cle = r.cle);

INSERT INTO rapport
SELECT 4, 'inchangee', c."Name", 'absente de la couche SIG — emprise actuelle conservee'
FROM public."Cities" c WHERE NOT EXISTS (SELECT 1 FROM emprise e WHERE e.city_id = c."Id");

-- Seule l'écriture qui suit est dans la transaction.
BEGIN;

-- `Cities."Boundary"` est un POLYGON simple — comme `Quartiers` et `Blocs`, et contrairement à
-- `contour_national`. Écrire un MultiPolygon échoue : « Geometry type (MultiPolygon) does not
-- match column type (Polygon) ».
UPDATE public."Cities" c SET "Boundary" = e.g FROM emprise e WHERE e.city_id = c."Id";

-- Remplacer par ROLLBACK pour un essai à blanc.
COMMIT;

INSERT INTO rapport
SELECT 5, 'apres ecriture', c."Name",
       round((ST_Area(c."Boundary"::geography)/1e6)::numeric, 1) || ' km2, ' || ST_NPoints(c."Boundary") || ' points'
FROM public."Cities" c WHERE c."Boundary" IS NOT NULL;

SELECT section, detail, valeur FROM rapport ORDER BY ordre, detail;
