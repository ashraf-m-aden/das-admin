-- Rend à Arta son emprise de région — `public."Cities"."Boundary"`.
--
--   psql "$DB" -v ON_ERROR_STOP=1 -f scripts/sig/cities-emprise-arta.sql
--
-- ⚠️ **ESSAI À BLANC : remplacer le `COMMIT;` final par `ROLLBACK;`.** Le rapport sort quand
-- même — c'est ainsi qu'ont été relevés tous les chiffres ci-dessous.
--
-- ---------------------------------------------------------------------------------------------
-- CE QUI NE VA PAS AUJOURD'HUI
-- ---------------------------------------------------------------------------------------------
-- `cities-emprise-depuis-nour-ville.sql` a remplacé, le 2026-09-06, le polygone de région d'Arta
-- (1 825 km²) par une « emprise réelle » de **10,9 km²** tirée de la livraison SIG. L'intention
-- était bonne — préférer la donnée SIG au découpage administratif — mais la couche
-- `nour.quartiers_ville_pg` ne contient, pour la région ARTA, que **2 polygones, aucun nommé**,
-- et ils ne sont pas sur Arta :
--
--   emprise Arta actuelle   lon 43.112 … 43.194   lat 11.516 … 11.533
--   ville d'Arta            lon ~42.85            lat ~11.53
--
-- Soit une bande de 10,9 km² en lisière SUD de Djibouti-ville, à une trentaine de kilomètres
-- d'Arta. Ce n'est ni la région, ni la ville.
--
-- **Ce que ça casse, mesuré le 2026-09-10** : 31 entrées de `recherche_index` n'appartiennent à
-- aucune ville — l'Hôpital régional d'Arta, le Lycée Hôtelier, le Terrain de Football, tout le
-- groupe de Ouéa, Damêrdjôg, et six routes nationales. Depuis que les clés d'API peuvent être
-- restreintes par ville, ces entrées sont **invisibles à un partenaire qui aurait payé pour la
-- région d'Arta** : la restriction filtre sur `ville_id`, et le leur est nul.
--
-- Le tableau est en outre incohérent : quatre villes portent leur polygone de RÉGION
-- (2 000 à 6 600 km²), Djibouti porte celui de la VILLE (97,7 km²), et Arta un fragment.
--
-- ---------------------------------------------------------------------------------------------
-- LA MÉTHODE : PAR SOUSTRACTION, FAUTE DE SOURCE DIRECTE
-- ---------------------------------------------------------------------------------------------
-- Aucune couche du schéma `nour` ne porte les régions : `quartiers_ville_pg` n'a que DJIBOUTI et
-- ARTA, `villes_pt` n'a que six points, `postes_administratifs` ne délimite rien. Le polygone
-- d'origine d'Arta a été écrasé le 2026-09-06 et n'est plus lisible.
--
-- Il reste une source : **les quatre autres régions et le contour national**. Arta est ce qui
-- reste du pays une fois Ali Sabieh, Dikhil, Obock et Tadjourah retirés.
--
--   contour national        21 672 km²
--   union des 4 régions     19 651 km²
--   reste                    2 091 km²  en 159 morceaux
--
-- ⚠️ **On garde le PLUS GRAND morceau**, comme le fait déjà `cities-emprise-depuis-nour-ville.sql`.
-- Il fait **2 033 km²** — l'ordre de grandeur de la région d'Arta (~1 780 km² officiels, plus
-- Djibouti-ville qu'elle enserre). Les 158 autres totalisent ~58 km² : ce sont des échardes le
-- long des frontières entre régions, là où deux polygones numérisés séparément ne se joignent
-- pas exactement. Le rapport les compte — une pièce écartée en silence est ce qu'on ne peut pas
-- diagnostiquer.
--
-- ⚠️ **Arta enserre Djibouti-ville, et c'est correct.** La région entoure la capitale. Aucune
-- ambiguïté n'en découle : `recherche-index.sql` rattache un point à la **plus petite** emprise
-- qui le contient, donc Djibouti-ville (97,7 km²) l'emporte toujours à l'intérieur de ses
-- limites. C'est précisément le cas que cette règle sert à trancher.
--
-- ---------------------------------------------------------------------------------------------
-- CE QUE ÇA CHANGE, MESURÉ EN ESSAI À BLANC (2026-09-10)
-- ---------------------------------------------------------------------------------------------
--   entrées sans ville           46  →  15
--   récupérées par Arta          31   (19 lieux, 12 rues)
--   perdu                         0   0,00 km² de l'ancienne emprise tombe hors de la nouvelle
--
-- Les 15 restantes sont, à quatre près, **hors du pays** : Zeila (Somaliland) ×6, Yémen ×2,
-- Érythrée ×3. Débordement de la boîte d'extraction OSM, à traiter séparément — ce n'est pas un
-- problème d'emprise. Les quatre autres sont des ratés de quelques mètres à quelques kilomètres
-- (l'Hôtel Corto Maltese est à **14 m** de Tadjourah, le lieu « Obock » à **265 m** d'Obock),
-- qui relèvent de la précision des limites régionales.
--
-- ---------------------------------------------------------------------------------------------
-- REVENIR EN ARRIÈRE
-- ---------------------------------------------------------------------------------------------
-- Rejouer `cities-emprise-depuis-nour-ville.sql`, qui reconstruit l'emprise de 10,9 km² depuis la
-- livraison SIG. Ce script-ci ne touche qu'une ligne et qu'une colonne.

-- ---------------------------------------------------------------------------------------------
-- ⚠️ LES MESURES SONT PRISES HORS TRANSACTION, L'ECRITURE SEULE EST DEDANS
-- ---------------------------------------------------------------------------------------------
-- Une table temporaire creee DANS la transaction disparait avec le ROLLBACK — et l'essai a blanc
-- rendrait alors « relation "rapport" does not exist » au lieu du rapport, c'est-a-dire rien de
-- ce qu'on venait mesurer. Tout ce qui LIT est donc pose avant le BEGIN ; seul l'UPDATE est
-- transactionnel.
CREATE TEMP TABLE rapport (ordre int, section text, detail text, valeur text);

INSERT INTO rapport
SELECT 1, 'Avant', c."Name",
       round((ST_Area(c."Boundary"::geography)/1e6)::numeric, 1) || ' km²'
FROM public."Cities" c WHERE c."Boundary" IS NOT NULL;

-- Le reste du pays, une fois les quatre régions retirées.
CREATE TEMP TABLE reste AS
SELECT (ST_Dump(ST_Difference(n.geom, u.g))).geom AS g
FROM (SELECT geom FROM public.contour_national LIMIT 1) n,
     (SELECT ST_Union("Boundary") AS g FROM public."Cities"
       WHERE "Name" IN ('Ali Sabieh', 'Dikhil', 'Obock', 'Tadjourah')) u;

INSERT INTO rapport
SELECT 2, 'Decoupage', 'morceaux du reste', count(*)::text FROM reste
UNION ALL
SELECT 2, 'Decoupage', 'echardes ecartees (< 1 km²)',
       count(*) || ' morceaux, ' ||
       round((coalesce(sum(ST_Area(g::geography)), 0)/1e6)::numeric, 2) || ' km²'
FROM reste WHERE ST_Area(g::geography)/1e6 < 1;

CREATE TEMP TABLE arta AS
SELECT g FROM reste ORDER BY ST_Area(g) DESC LIMIT 1;

-- ⚠️ Filet : si la soustraction ne rend rien d'exploitable, ne RIEN ecrire. Une emprise vide
-- effacerait Arta de la carte et rendrait toute cle restreinte a Arta definitivement muette.
INSERT INTO rapport
SELECT 3, 'Controle', 'emprise retenue',
       CASE WHEN (SELECT count(*) FROM arta) = 1
             AND (SELECT ST_Area(g::geography)/1e6 FROM arta) > 500
            THEN 'valide, ' || round((SELECT ST_Area(g::geography)/1e6 FROM arta)::numeric) || ' km²'
            ELSE '⛔ REFUSEE — trop petite ou absente, rien ne sera ecrit'
       END;

-- Ce que l'ancienne emprise perdrait : doit valoir zero.
INSERT INTO rapport
SELECT 3, 'Controle', 'ancienne emprise perdue',
       round((ST_Area(ST_Difference(c."Boundary", a.g)::geography)/1e6)::numeric, 2) || ' km²'
FROM public."Cities" c, arta a WHERE c."Name" = 'Arta';

INSERT INTO rapport
SELECT 4, 'Recuperation', r.genre, count(*)::text
FROM public.recherche_index r, arta a
WHERE r.ville_id IS NULL AND ST_Intersects(a.g, r.point)
GROUP BY r.genre;

INSERT INTO rapport
SELECT 4, 'Recuperation', 'restent sans ville', count(*)::text
FROM public.recherche_index r, arta a
WHERE r.ville_id IS NULL AND NOT ST_Intersects(a.g, r.point);

BEGIN;

-- ⚠️ PAS de ST_Multi : `Cities."Boundary"` est un POLYGON simple, cote base comme cote domaine
-- (`Polygon? Boundary` dans City.cs). Un MultiPolygon serait refuse par la colonne — et s'il
-- passait, EF le lirait mal. Le morceau retenu par ST_Dump est deja un polygone.
UPDATE public."Cities" c
SET "Boundary" = a.g
FROM arta a
WHERE c."Name" = 'Arta'
  AND ST_Area(a.g::geography)/1e6 > 500;

-- Remplacer par ROLLBACK pour un essai à blanc.
COMMIT;

-- ⚠️ APRES le COMMIT, deliberement. En essai a blanc cette lecture montre alors l'etat REEL —
-- Arta toujours a 10,9 km² — ce qui prouve que rien n'a ete ecrit. Placee avant, elle afficherait
-- 2 033 km² et laisserait croire a une modification qui vient d'etre annulee.
INSERT INTO rapport
SELECT 5, 'Apres', c."Name",
       round((ST_Area(c."Boundary"::geography)/1e6)::numeric, 1) || ' km²'
FROM public."Cities" c WHERE c."Boundary" IS NOT NULL;

SELECT section, detail, valeur FROM rapport ORDER BY ordre, detail;

-- ---------------------------------------------------------------------------------------------
-- L'index de recherche ne se met pas a jour tout seul.
-- ---------------------------------------------------------------------------------------------
-- L'emprise d'une ville vient de changer : `recherche_index.ville_id` est calcule par jointure
-- spatiale au rafraichissement, il est donc perime tant que celui-ci n'a pas eu lieu.
--
-- Hors transaction, apres le COMMIT : Postgres refuse CONCURRENTLY dans un bloc transactionnel.
\ir rafraichir-recherche.sql
