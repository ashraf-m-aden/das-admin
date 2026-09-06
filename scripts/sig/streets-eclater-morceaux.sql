-- Une rue = UN trait continu. Éclatement des 221 rues faites de morceaux disjoints.
--
--   Dans pgAdmin : ouvrir ce fichier et l'exécuter tel quel.
--   En ligne de commande : psql "$DB" -v ON_ERROR_STOP=1 -f scripts/sig/streets-eclater-morceaux.sql
--
-- SQL pur, aucune commande psql.
-- ⚠️ **ESSAI À BLANC : remplacer le `COMMIT;` final par `ROLLBACK;`.**
--
-- ---------------------------------------------------------------------------------------------
-- LE DÉFAUT, ET D'OÙ IL VIENT
-- ---------------------------------------------------------------------------------------------
-- Mesuré le 2026-09-06 sur 4 283 rues géométriques : **221 portent une géométrie en plusieurs
-- morceaux DISJOINTS**, et l'une d'elles en compte **240**. Une « rue » saute alors d'un bout de
-- la ville à l'autre.
--
-- C'est un défaut de MES imports, pas de la donnée source : `routes-osm-vers-streets.sql` et
-- `voirie-sig-vers-streets.sql` regroupent les tronçons par NOM avec `ST_Collect`. Deux rues
-- homonymes situées dans deux quartiers différents — cas courant — deviennent une seule entité.
--
-- ⚠️ POURQUOI CELA CASSE LES CLOSES. `IX_Closes_QuartierId_StreetId` est UNIQUE : une close est
-- toute la façade d'UNE rue dans un quartier. Elle **hérite donc de la géométrie de sa rue**. Une
-- rue en 240 morceaux éparpillés produit une close éparpillée, qui traverse et « perce » les
-- closes voisines par le flanc. Aucun réglage de `maxDistanceMeters` ou `maxBlocGapMeters` ne
-- corrige cela : le défaut est dans l'entité rue, pas dans l'appariement.
--
-- Mesuré, en éclatant les morceaux et en complétant l'exclusion des axes interurbains :
--
--   blocs de la plus grosse close proposée   1 068  →  21
--   solidité médiane (aire / enveloppe)      0,842  →  0,936
--   closes sans interpénétration        507 / 1 741  →  1 466 / 2 783
--
-- ---------------------------------------------------------------------------------------------
-- CE QUE LE SCRIPT FAIT, ET CE QU'IL NE FAIT PAS
-- ---------------------------------------------------------------------------------------------
-- La rue d'origine **garde son identifiant et son plus long morceau** : c'est ce qui protège les
-- closes déjà créées, dont la clé étrangère pointe sur cet `Id`. Les autres morceaux deviennent
-- de NOUVELLES rues, code suffixé `-M2`, `-M3`… et même `Name`/`Type`.
--
-- ⚠️ **Vérifié avant d'écrire** : les 2 closes existantes (`Q7-02`, `CL1`) s'appuient sur
-- `OSM-148704475` et `OSM-352595737`, toutes deux d'un seul morceau. Aucune n'est touchée. Le
-- rapport le revérifie à l'exécution plutôt que de s'en remettre à ce commentaire.
--
-- Le script ne renomme RIEN : deux morceaux d'une même rue homonyme gardent le même `Name`. Les
-- distinguer (« rue de la Mosquée — Quartier 4 » / « — Quartier 7 ») est un travail humain.

CREATE TEMP TABLE morceau AS
SELECT s."Id" AS ancien_id, s."Code", s."Name", s."Type",
       d.path[1] AS rang, d.geom AS g,
       ST_Length(ST_Transform(d.geom, 32638)) AS metres,
       row_number() OVER (PARTITION BY s."Id" ORDER BY ST_Length(ST_Transform(d.geom,32638)) DESC) AS taille_rang
FROM public."Streets" s, LATERAL ST_Dump(s."Boundary") d
WHERE s."Boundary" IS NOT NULL
  AND ST_NumGeometries(ST_Multi(s."Boundary")) > 1;

CREATE TEMP TABLE rapport(ordre int, section text, detail text, valeur text);

INSERT INTO rapport
SELECT 1, 'avant', 'rues en plusieurs morceaux',
       count(DISTINCT ancien_id) || ' rues, ' || count(*) || ' morceaux, ' ||
       max(rang) || ' au maximum pour une seule' FROM morceau;

INSERT INTO rapport
SELECT 1, 'avant', 'closes assises sur une de ces rues',
       count(*) || ' (doit valoir 0 — sinon le morceau conserve est celui qui compte)'
FROM public."Closes" c WHERE c."StreetId" IN (SELECT ancien_id FROM morceau);

-- Seules les écritures qui suivent sont dans la transaction.
BEGIN;

-- 1. La rue d'origine ne garde que son plus long morceau. Son `Id` ne bouge pas : les closes,
--    les suggestions de nom et toute autre référence restent valides.
UPDATE public."Streets" s SET "Boundary" = m.g
FROM morceau m WHERE m.ancien_id = s."Id" AND m.taille_rang = 1;

-- 2. Les morceaux restants deviennent des rues à part entière.
INSERT INTO public."Streets" ("Id", "Code", "Name", "Type", "Boundary")
SELECT gen_random_uuid(), m."Code" || '-M' || m.taille_rang, m."Name", m."Type", m.g
FROM morceau m WHERE m.taille_rang > 1
ON CONFLICT DO NOTHING;

-- Remplacer par ROLLBACK pour un essai à blanc.
COMMIT;

INSERT INTO rapport
SELECT 2, 'apres', 'rues au total', count(*)::text FROM public."Streets";

INSERT INTO rapport
SELECT 2, 'apres', 'rues encore en plusieurs morceaux',
       count(*) || ' (doit valoir 0)'
FROM public."Streets" WHERE "Boundary" IS NOT NULL
  AND ST_NumGeometries(ST_Multi("Boundary")) > 1;

INSERT INTO rapport
SELECT 2, 'apres', 'closes intactes',
       count(*) || ' close(s), ' || count(*) FILTER (WHERE s."Boundary" IS NOT NULL) || ' avec une rue geometrique'
FROM public."Closes" c JOIN public."Streets" s ON s."Id" = c."StreetId";

INSERT INTO rapport
SELECT 3, 'controle', 'longueur des rues',
       'mediane ' || round(percentile_cont(0.5) WITHIN GROUP (ORDER BY ST_Length(ST_Transform("Boundary",32638)))::numeric)
       || ' m, p90 ' || round(percentile_cont(0.9) WITHIN GROUP (ORDER BY ST_Length(ST_Transform("Boundary",32638)))::numeric)
       || ' m, max ' || round(max(ST_Length(ST_Transform("Boundary",32638)))::numeric) || ' m'
FROM public."Streets" WHERE "Boundary" IS NOT NULL;

SELECT section, detail, valeur FROM rapport ORDER BY ordre, detail;
