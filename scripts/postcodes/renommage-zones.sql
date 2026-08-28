-- Renommage des zones — le `Name` seul change, `Code` et commune restent identiques.
--
-- Ancien nom              -> Nouveau nom      (code inchangé)
--   Ras-Dika 1            -> Ras-Dika            Z1
--   Boulaos 2             -> Boulaos 1           Z2
--   Boulaos 3             -> Boulaos 2           Z3
--   Boulaos 4             -> Boulaos 3           Z4
--   Balbala 5             -> Balbala 1           Z5
--   Balbala 6             -> Balbala 2           Z6
--   Aires speciales / Zone Centre : inchangés
--
-- ⚠️ Le renommage se fait EN DEUX TEMPS. `IX_Zones_CommuneId_Name` est UNIQUE et non
-- différable, et les nouveaux noms empiètent sur les anciens : passer Z3 de « Boulaos 3 » à
-- « Boulaos 2 » alors que Z2 s'appelle encore « Boulaos 2 » viole l'index. Le passage par un
-- nom temporaire (l'Id, forcément unique) évite d'avoir à trouver un ordre sans collision —
-- ordre qui n'existe pas toujours, un renommage circulaire n'en ayant aucun.
--
-- Note : le nom ne porte plus le chiffre des centaines de l'areaNumber (« Boulaos 1 » contient
-- les 2xx). C'est désormais le `Code` qui le porte — Z2 = 2xx, Z5 = 5xx. La correspondance
-- n'est pas perdue, elle a changé de colonne.
--
-- Idempotent : réexécuté, le second UPDATE ne trouve plus rien à changer.
--
--   docker run --rm -i --add-host=host.docker.internal:host-gateway \
--     postgis/postgis:17-3.5 psql "$DB" -v ON_ERROR_STOP=1 -f - < scripts/postcodes/renommage-zones.sql

BEGIN;

CREATE TEMP TABLE zone_cible (id uuid PRIMARY KEY, nom text) ON COMMIT DROP;
INSERT INTO zone_cible (id, nom) VALUES
  ('71801a01-56ed-4084-a27a-2569d4ad0aba'::uuid, 'Ras-Dika'),         -- Z1, RAS DIKA
  ('49229e75-6644-4c9e-9148-b937d3563dfe'::uuid, 'Boulaos 1'),        -- Z2, BOULAOS
  ('2e85f702-3468-4aed-9c01-413c0e47ec82'::uuid, 'Boulaos 2'),        -- Z3, BOULAOS
  ('50eb86cc-3dbc-48ca-9299-9b75c26d098c'::uuid, 'Boulaos 3'),        -- Z4, BOULAOS
  ('94d097d2-8d9a-4a21-8a9e-63042d547acc'::uuid, 'Balbala 1'),        -- Z5, BALBALA
  ('b09bf606-b366-49d6-a835-40d1f4de876e'::uuid, 'Balbala 2'),        -- Z6, BALBALA
  ('bce9663f-269c-41e4-84f6-1231b2005551'::uuid, 'Aires speciales'),  -- Z9, BALBALA
  ('d63326db-561a-4f07-afdb-a0f701f46384'::uuid, 'Aires speciales'),  -- Z9, BOULAOS
  ('a0000000-0000-4000-8000-000000000001'::uuid, 'Zone Centre');      -- ZC, BOULAOS

-- Toute la table est décrite : une zone hors de cette liste signifierait que la base a
-- divergé depuis le relevé, et le renommage ne doit pas s'appliquer à l'aveugle.
DO $garde$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM "Zones" z WHERE NOT EXISTS (SELECT 1 FROM zone_cible t WHERE t.id = z."Id");
  IF n <> 0 THEN RAISE EXCEPTION '% zone(s) en base absente(s) de la cible', n; END IF;

  SELECT count(*) INTO n FROM zone_cible t WHERE NOT EXISTS (SELECT 1 FROM "Zones" z WHERE z."Id" = t.id);
  IF n <> 0 THEN RAISE EXCEPTION '% zone(s) de la cible absente(s) en base', n; END IF;
END $garde$;

-- Phase 1 : noms temporaires, uniques par construction.
UPDATE "Zones" z SET "Name" = '__' || z."Id"::text
FROM zone_cible t WHERE t.id = z."Id" AND z."Name" <> t.nom;

-- Phase 2 : les noms définitifs.
UPDATE "Zones" z SET "Name" = t.nom
FROM zone_cible t WHERE t.id = z."Id" AND z."Name" <> t.nom;

DO $garde$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM "Zones" z JOIN zone_cible t ON t.id = z."Id" WHERE z."Name" <> t.nom;
  IF n <> 0 THEN RAISE EXCEPTION '% zone(s) mal renommée(s)', n; END IF;

  SELECT count(*) INTO n FROM "Zones" WHERE "Name" LIKE '\_\_%';
  IF n <> 0 THEN RAISE EXCEPTION '% nom temporaire resté en base', n; END IF;
END $garde$;

COMMIT;
