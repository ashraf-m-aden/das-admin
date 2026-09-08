-- Extension de `public."Blocs"` depuis `nour.ilots_complet` (livraison SIG du 2026-09-08).
--
--   Dans pgAdmin : ouvrir ce fichier et l'exécuter tel quel.
--   En ligne de commande : psql "$DB" -v ON_ERROR_STOP=1 -f scripts/sig/nour/99_blocs_depuis_ilots_complet.sql
--
-- SQL pur, aucune commande psql.
-- ⚠️ **ESSAI À BLANC : remplacer le `COMMIT;` final par `ROLLBACK;`.**
-- Prérequis : `nour.ilots_complet` chargée (6 932 lignes) et reprojetée en 4326 par `90_post.sql`.
--
-- ---------------------------------------------------------------------------------------------
-- CE QUE LA LIVRAISON APPORTE
-- ---------------------------------------------------------------------------------------------
-- Mesuré le 2026-09-08, `ilots_complet` (6 932) face à `Blocs` (7 115) :
--
--   5 055 codes communs, dont 4 972 de géométrie IDENTIQUE au bit près
--                        et 83 différentes, écart d'aire moyen 0,0 m²
--   1 877 codes NOUVEAUX — dont 1 786 à Balbala
--   2 060 blocs absents de la livraison = les 1 994 des trois villes secondaires,
--         hors périmètre de ce lot, + 66
--
-- La livraison **étend** donc le référentiel sans le réécrire. Ce script n'écrit que des lignes
-- nouvelles : **aucun UPDATE**, les 83 géométries divergentes sont laissées telles quelles et
-- signalées au rapport — un écart moyen de 0,0 m² ne justifie pas de toucher à l'existant.
--
-- ---------------------------------------------------------------------------------------------
-- ⚠️ LE RATTACHEMENT AU QUARTIER SE FAIT PAR LE NOM, PAS PAR LA GÉOMÉTRIE
-- ---------------------------------------------------------------------------------------------
-- C'est contre-intuitif et c'est délibéré. **`code_ilot` contient le nom du quartier** :
-- `BOULAOS-Ambouli-A` = commune, quartier, lettre. Rattacher un îlot au quartier qui le contient
-- géométriquement produirait des lignes dont le `Code` contredit le `QuartierId`.
--
-- Le recoupement a été fait, et il diverge : sur les 1 349 îlots qu'un polygone de quartier
-- couvre, 693 confirment le nom livré et **656 le contredisent** — `T3` tombe dans `BALBALA Q11`,
-- `QUARAWIL` dans `Pompage`, `LOT. HAYABLEH` dans `Cheik Moussa`. Et **528 îlots ne tombent dans
-- aucun quartier** : les polygones de `Quartiers` ne couvrent pas tout Balbala.
--
-- La géométrie n'est donc pas utilisable comme source ici. Elle sert de CONTRÔLE : le rapport
-- compte les désaccords, pour qu'ils soient arbitrés plus tard avec l'expert SIG.
--
-- Six alias d'écriture, chacun **confirmé par la géométrie** (l'îlot tombe bien dans le quartier
-- cible), sont appliqués. Ce sont des différences de graphie, pas des quartiers distincts.

CREATE TEMP TABLE alias AS
SELECT * FROM (VALUES
       ('BALBALA Q5',    'BALBALA Q 5'),        -- espace avant le chiffre       157 ilots
       ('CHEICK MOUSSA', 'Cheik Moussa'),       -- CK / K                         92
       ('WAHLADABA S.',  'Wahladaba Sud'),      -- abreviation du point cardinal  83
       ('CITE C OUSMAN', 'Cité Cheikh Osman'),  -- C. = Cheikh, OUSMAN = Osman    31
       ('LOT. HAYABLEH', 'HAYABLEH'),           -- lotissement de Hayableh        23
       ('Einguela 2',    'Einguela')            -- sous-decoupage non repris       1
) AS v(livre, referentiel);

-- Quartiers de Djibouti-ville : le lot ne couvre que cette commune, et restreindre evite
-- d'apparier sur un homonyme d'une ville secondaire.
CREATE TEMP TABLE qdj AS
SELECT q."Id", q."Nom", q."Boundary", upper(unaccent(btrim(q."Nom"))) AS cle
FROM public."Quartiers" q JOIN public."Cities" c ON c."Id" = q."CityId"
WHERE c."Name" = 'Djibouti';

-- ⚠️ `Blocs."Boundary"` est un POLYGON simple, la livraison des MULTIPOLYGON — meme piege que
-- `Cities."Boundary"` le 2026-09-06 (« Geometry type (MultiPolygon) does not match column type »).
-- Mesure : 1 839 des 1 877 ilots n'ont qu'un morceau, 38 en ont 2 ou 3. Pour ces 38, ne garder
-- que le plus grand coute 5 900 m² au total, 1,9 % en mediane — sauf DEUX cas a 47,7 % et 23,7 %,
-- qui seraient mutiles. On garde donc le plus grand morceau quand la perte est marginale, et on
-- ECARTE au-dela de 10 % : le rapport les nomme, pour arbitrage (scinder en deux blocs, ou passer
-- la colonne en MultiPolygon).
CREATE TEMP TABLE candidat AS
SELECT i.code_ilot, i.lettre_ilot, i.quartier_ville, i.commune_ville,
       (SELECT d.geom FROM ST_Dump(i.wkb_geometry) d ORDER BY ST_Area(d.geom) DESC LIMIT 1) AS g,
       ST_NumGeometries(i.wkb_geometry) AS morceaux,
       1 - (SELECT max(ST_Area(d.geom)) FROM ST_Dump(i.wkb_geometry) d)
           / nullif(ST_Area(i.wkb_geometry), 0) AS part_perdue,
       coalesce(qd."Id", qa."Id") AS quartier_id,
       coalesce(qd."Nom", qa."Nom") AS quartier_nom
FROM nour.ilots_complet i
LEFT JOIN qdj qd ON qd.cle = upper(unaccent(btrim(i.quartier_ville)))
LEFT JOIN alias  a ON upper(unaccent(btrim(a.livre))) = upper(unaccent(btrim(i.quartier_ville)))
LEFT JOIN qdj   qa ON qa.cle = upper(unaccent(btrim(a.referentiel)))
WHERE NOT EXISTS (SELECT 1 FROM public."Blocs" b WHERE b."Code" = i.code_ilot);

CREATE TEMP TABLE rapport(ordre int, section text, detail text, valeur text);

INSERT INTO rapport
SELECT 1, 'avant', 'Blocs', count(*) || ' lignes' FROM public."Blocs";

INSERT INTO rapport
SELECT 1, 'avant', 'livraison', (SELECT count(*) FROM nour.ilots_complet) || ' ilots, '
       || (SELECT count(*) FROM candidat) || ' absents de Blocs';

INSERT INTO rapport
SELECT 2, 'a inserer', 'rattaches a un quartier et conservables',
       count(*)::text FROM candidat WHERE quartier_id IS NOT NULL AND coalesce(part_perdue,0) <= 0.10;

INSERT INTO rapport
SELECT 2, 'a inserer', 'multi-morceaux acceptes (plus grand conserve)',
       count(*) || ', ' || round(sum(part_perdue*100)::numeric,1) || ' % d aire cumulee perdue'
FROM candidat WHERE quartier_id IS NOT NULL AND part_perdue > 0 AND part_perdue <= 0.10;

INSERT INTO rapport
SELECT 2, 'a inserer', 'ECARTES car trop morceles (> 10 %)',
       count(*) || ' — ' || coalesce(string_agg(code_ilot || ' (' || round(part_perdue*100) || ' %)', ', '), '(aucun)')
FROM candidat WHERE part_perdue > 0.10;

INSERT INTO rapport
SELECT 2, 'a inserer', 'ECARTES faute de quartier', count(*) || ' — ' ||
       coalesce(string_agg(DISTINCT quartier_ville, ', '), '(aucun)')
FROM candidat WHERE quartier_id IS NULL;

INSERT INTO rapport
SELECT 3, 'controle', 'codes en double DANS la livraison',
       coalesce(count(*), 0) || ' (doit valoir 0)'
FROM (SELECT code_ilot FROM nour.ilots_complet GROUP BY 1 HAVING count(*) > 1) z;

INSERT INTO rapport
SELECT 3, 'controle', 'geometries divergentes sur les codes communs',
       count(*) FILTER (WHERE NOT ST_Equals(b."Boundary", i.wkb_geometry))
       || ' sur ' || count(*) || ' — laissees intactes'
FROM nour.ilots_complet i JOIN public."Blocs" b ON b."Code" = i.code_ilot;

-- Contrôle géométrique : le quartier retenu par le NOM contient-il l'îlot ?
INSERT INTO rapport
SELECT 3, 'controle', 'le quartier retenu couvre bien l ilot',
       count(*) FILTER (WHERE ST_Intersects(c.g, q."Boundary")) || ' sur ' || count(*)
FROM candidat c JOIN qdj q ON q."Id" = c.quartier_id WHERE q."Boundary" IS NOT NULL;

-- Seule l'écriture qui suit est dans la transaction.
BEGIN;

INSERT INTO public."Blocs" ("Id", "Code", "Name", "Number", "QuartierId", "Boundary", "CloseId")
SELECT gen_random_uuid(), c.code_ilot, c.lettre_ilot, NULL, c.quartier_id, c.g, NULL
FROM candidat c
WHERE c.quartier_id IS NOT NULL AND coalesce(c.part_perdue, 0) <= 0.10;

-- Remplacer par ROLLBACK pour un essai à blanc.
COMMIT;

INSERT INTO rapport
SELECT 4, 'apres', 'Blocs', count(*) || ' lignes' FROM public."Blocs";

INSERT INTO rapport
SELECT 4, 'apres', 'Djibouti-ville', count(*) || ' blocs'
FROM public."Blocs" b JOIN public."Quartiers" q ON q."Id" = b."QuartierId"
JOIN public."Cities" ci ON ci."Id" = q."CityId" WHERE ci."Name" = 'Djibouti';

INSERT INTO rapport
SELECT 5, 'controle final', 'codes dupliques', count(*) || ' (doit valoir 0)'
FROM (SELECT "Code" FROM public."Blocs" GROUP BY "Code" HAVING count(*) > 1) z;

INSERT INTO rapport
SELECT 5, 'controle final', 'blocs sans geometrie', count(*) || ' (doit valoir 0)'
FROM public."Blocs" WHERE "Boundary" IS NULL;

INSERT INTO rapport
SELECT 5, 'controle final', 'geometries invalides', count(*) || ' (doit valoir 0)'
FROM public."Blocs" WHERE NOT ST_IsValid("Boundary");

SELECT section, detail, valeur FROM rapport ORDER BY ordre, detail;
