-- Une rue = UN tronçon entre deux intersections. Découpage du réseau urbain.
--
--   Dans pgAdmin : ouvrir ce fichier et l'exécuter tel quel.
--   En ligne de commande : psql "$DB" -v ON_ERROR_STOP=1 -f scripts/sig/streets-decouper-troncons.sql
--
-- SQL pur, aucune commande psql.
-- ⚠️ **ESSAI À BLANC : remplacer le `COMMIT;` final par `ROLLBACK;`.**
-- ⚠️ **REMPLACE `streets-eclater-morceaux.sql`**, qui ne traitait que les rues multi-morceaux —
--    un sous-cas. Ne pas jouer les deux.
--
-- ---------------------------------------------------------------------------------------------
-- LE CONSTAT : « LES BLOCS D'UNE CLOSE SONT TROP ÉLOIGNÉS LES UNS DES AUTRES »
-- ---------------------------------------------------------------------------------------------
-- Cas relevé par Ashraf le 2026-09-06, close `PK-04` sur la rue `OSM-W101529382` :
--
--   la rue          2 907 m, UN SEUL morceau, aucun préfixe exclu, type « Rue »
--   la close        39 blocs, étalés sur 2 956 m, solidité 0,212
--
-- Et ce n'est pas un cas isolé : 1 484 rues sur 4 283 dépassent 300 m, le 9ᵉ décile est à
-- 3 864 m. **Le défaut est général.**
--
-- ⚠️ **`maxBlocGapMeters` NE CORRIGE PAS CELA**, et c'est le piège. Vérifié sur `PK-04` : après
-- coupure de contiguïté à 25 m, le plus gros sous-groupe garde **26 blocs étalés sur 1 436 m**.
-- Une file de blocs distants de 20 m chacun est « contiguë » et court pourtant sur des
-- kilomètres. La contiguïté n'est pas la compacité — aucun seuil d'écart n'exprime un diamètre.
--
-- CAUSE. `IX_Closes_QuartierId_StreetId` est UNIQUE : une close est toute la façade d'UNE rue
-- dans un quartier. **Une close hérite donc de la longueur de sa rue.** Une rue de 2,9 km fait
-- une close de 2,9 km. Le seul levier est la rue elle-même.
--
-- ---------------------------------------------------------------------------------------------
-- LA COUPE, ET POURQUOI AUX INTERSECTIONS
-- ---------------------------------------------------------------------------------------------
-- Le tronçon entre deux croisements est l'unité urbaine réelle — c'est ce qu'on désigne quand on
-- dit « cette rue-là ». Mesuré sur le réseau urbain : la coupe aux intersections donne des
-- tronçons de **41 m en médiane, 133 m au 9ᵉ décile**.
--
-- Trois stratégies comparées sur les 7 115 blocs (2026-09-06) :
--
--                                    actuel   plafond 250 m   intersections + 250 m
--   solidité médiane                  0,842       0,916              0,979
--   étalement médian de la close          —        87 m               63 m
--   étalement au 95ᵉ centile              —       269 m              207 m
--   paires en interpénétration        1 906       1 863              1 099
--   blocs de la plus grosse close     1 068          15                 15
--
-- Le plafond SEUL ne règle presque rien sur l'interpénétration (1 863 contre 1 906) : il raccourcit
-- les closes sans les empêcher de s'enchevêtrer. C'est la coupe aux intersections qui compte.
-- Le plafond de 250 m reste utile pour les **468 tronçons** qu'aucun croisement ne coupe.
--
-- ---------------------------------------------------------------------------------------------
-- CE QUI EST PRÉSERVÉ
-- ---------------------------------------------------------------------------------------------
-- Chaque rue **garde son `Id` et son plus long tronçon**. C'est ce qui protège les références :
-- `Closes.StreetId` (ON DELETE RESTRICT) et `StreetSuggestions.StreetId`. Les autres tronçons
-- deviennent de nouvelles rues, code suffixé `-T2`, `-T3`…, même `Name` et même `Type`.
--
-- Aucune ligne n'est supprimée. Le script est donc rejouable, mais **PAS idempotent** : rejoué,
-- il redécouperait les tronçons déjà créés. Le rapport compte les codes en `-T*` déjà présents
-- pour le signaler.
--
-- ⚠️ **LES AXES INTERURBAINS SONT ÉCARTÉS** (`SIG-RT*`, `SIG-PI*`, `SIG-VE*`, `OSM-ROUTE-*`,
-- `OSM-PISTE-*`). Ce ne sont pas des rues : les découper créerait des milliers de tronçons de
-- désert sans usage. Ils restent exclus de la génération par `excludeStreetCodePrefixes`.
--
-- ⚠️ **CE QUE LE SCRIPT NE RÈGLE PAS.** Il reste 1 099 paires de closes en interpénétration :
-- deux rues parallèles distantes de 40 m se disputent la même rangée de blocs, et « bloc → rue la
-- plus proche » les entrelace. C'est le primitif d'appariement qui est en cause, pas la donnée.
-- Le correctif est une contrainte d'acceptation CÔTÉ BACK — refuser une proposition dont
-- l'enveloppe convexe recouvre les blocs d'une autre — avec la solidité (aire / enveloppe) et un
-- seuil mesuré à 0,65.

-- 1. Chaque rue urbaine, éclatée en ses morceaux disjoints (traite au passage les 221 rues
--    multi-morceaux : un morceau isolé se découpe indépendamment des autres).
CREATE TEMP TABLE piece AS
SELECT s."Id" AS sid, s."Code", s."Name", s."Type",
       d.path[1] AS part, d.geom AS g
FROM public."Streets" s, LATERAL ST_Dump(ST_Transform(s."Boundary", 32638)) d
WHERE s."Boundary" IS NOT NULL
  AND s."Code" NOT LIKE 'SIG-RT%' AND s."Code" NOT LIKE 'SIG-PI%' AND s."Code" NOT LIKE 'SIG-VE%'
  AND s."Code" NOT LIKE 'OSM-ROUTE-%' AND s."Code" NOT LIKE 'OSM-PISTE-%'
  AND ST_GeometryType(d.geom) = 'ST_LineString';
CREATE INDEX ON piece USING GIST (g);
ANALYZE piece;

-- 2. Points de croisement avec les AUTRES morceaux. C'est la lame du découpage.
--    `ST_Snap` avant `ST_Split` : sans lui, un point calculé au flottant près ne tombe pas
--    exactement sur la ligne et la coupe est ignorée SANS ERREUR — même famille de piège que
--    `ST_Node` omis avant `ST_Split` sur le contour national.
CREATE TEMP TABLE lame AS
SELECT p.sid, p.part, ST_Collect(x.pt) AS blade
FROM piece p
JOIN LATERAL (
  SELECT (ST_Dump(ST_Intersection(p.g, q.g))).geom AS pt
  FROM piece q
  WHERE (q.sid, q.part) <> (p.sid, p.part) AND ST_Intersects(p.g, q.g)
) x ON ST_GeometryType(x.pt) = 'ST_Point'
GROUP BY p.sid, p.part;

CREATE TEMP TABLE coupe AS
SELECT p.sid, p."Code", p."Name", p."Type", p.part,
       CASE WHEN l.blade IS NULL THEN p.g
            ELSE ST_Split(ST_Snap(p.g, l.blade, 0.001), l.blade) END AS g
FROM piece p LEFT JOIN lame l ON l.sid = p.sid AND l.part = p.part;

CREATE TEMP TABLE troncon0 AS
SELECT sid, "Code", "Name", "Type", (ST_Dump(g)).geom AS g FROM coupe;

-- 3. Plafond de 250 m : 468 tronçons ne rencontrent aucun croisement et resteraient longs.
CREATE TEMP TABLE troncon AS
SELECT sid, "Code", "Name", "Type", z.g,
       row_number() OVER (PARTITION BY sid ORDER BY ST_Length(z.g) DESC) AS rang
FROM (
  SELECT t.sid, t."Code", t."Name", t."Type",
         ST_LineSubstring(t.g, s.i::float/n.parts, (s.i+1)::float/n.parts) AS g
  FROM troncon0 t
  CROSS JOIN LATERAL (SELECT greatest(1, ceil(ST_Length(t.g)/250.0)::int) AS parts) n
  CROSS JOIN LATERAL generate_series(0, n.parts-1) AS s(i)
) z
WHERE ST_Length(z.g) > 1;

CREATE TEMP TABLE rapport(ordre int, section text, detail text, valeur text);

INSERT INTO rapport
SELECT 1, 'avant', 'rues urbaines',
       (SELECT count(DISTINCT sid) FROM piece) || ' rues, ' || (SELECT count(*) FROM piece) || ' morceaux';

INSERT INTO rapport
SELECT 1, 'avant', 'longueur des rues urbaines',
       'mediane ' || round(percentile_cont(0.5) WITHIN GROUP (ORDER BY ST_Length(g))::numeric)
       || ' m, p90 ' || round(percentile_cont(0.9) WITHIN GROUP (ORDER BY ST_Length(g))::numeric)
       || ' m, max ' || round(max(ST_Length(g))::numeric) || ' m'
FROM piece;

INSERT INTO rapport
SELECT 1, 'avant', 'deja decoupe (rejeu)',
       count(*) || ' rue(s) au code -T* — si > 0, le script a deja tourne'
FROM public."Streets" WHERE "Code" ~ '-T[0-9]+$';

INSERT INTO rapport
SELECT 2, 'apres', 'troncons obtenus', count(*)::text FROM troncon;

INSERT INTO rapport
SELECT 2, 'apres', 'longueur des troncons',
       'mediane ' || round(percentile_cont(0.5) WITHIN GROUP (ORDER BY ST_Length(g))::numeric)
       || ' m, p90 ' || round(percentile_cont(0.9) WITHIN GROUP (ORDER BY ST_Length(g))::numeric)
       || ' m, max ' || round(max(ST_Length(g))::numeric) || ' m'
FROM troncon;

INSERT INTO rapport
SELECT 2, 'apres', 'rues creees', (count(*) FILTER (WHERE rang > 1))::text FROM troncon;

-- Seules les écritures qui suivent sont dans la transaction.
BEGIN;

-- La rue d'origine garde son Id et son plus long tronçon : les closes et les suggestions de nom
-- qui la référencent restent valides.
UPDATE public."Streets" s
SET "Boundary" = ST_Transform(t.g, 4326)
FROM troncon t WHERE t.sid = s."Id" AND t.rang = 1;

INSERT INTO public."Streets" ("Id", "Code", "Name", "Type", "Boundary")
SELECT gen_random_uuid(), t."Code" || '-T' || t.rang, t."Name", t."Type", ST_Transform(t.g, 4326)
FROM troncon t WHERE t.rang > 1;

-- Remplacer par ROLLBACK pour un essai à blanc.
COMMIT;

INSERT INTO rapport
SELECT 3, 'controle', 'rues au total', count(*)::text FROM public."Streets";

INSERT INTO rapport
SELECT 3, 'controle', 'closes intactes',
       count(*) || ' close(s) — leur rue existe toujours'
FROM public."Closes" c JOIN public."Streets" s ON s."Id" = c."StreetId";

INSERT INTO rapport
SELECT 3, 'controle', 'suggestions de nom intactes',
       count(*)::text FROM public."StreetSuggestions" g JOIN public."Streets" s ON s."Id" = g."StreetId";

INSERT INTO rapport
SELECT 3, 'controle', 'codes en double',
       count(*) || ' (informatif : Streets.Code ne porte pas de contrainte d unicite)'
FROM (SELECT "Code" FROM public."Streets" GROUP BY "Code" HAVING count(*) > 1) z;

SELECT section, detail, valeur FROM rapport ORDER BY ordre, detail;
