-- Etat cible du plan de numerotation - Djibouti-ville
-- Genere par scripts/postcodes/generate_reprise_sql.py, ne pas editer a la main.
-- 48 quartiers numerotes, 10 crees, 8 zones.
-- Ecartes : 207, 311, 403, 408, 616 (voir EXCLUS dans le script).

BEGIN;
SET LOCAL statement_timeout = '120s';

-- 1. Les zones. Une zone sans quartier est un etat normal (guide 3.2).
INSERT INTO "Zones" ("Id", "Name", "Code", "CommuneId", "CityId")
SELECT gen_random_uuid(), v.name, v.code, c."Id", c."CityId"
FROM (VALUES
    ('Ras-Dika 1', 'Z1', 'RAS DIKA'),
    ('Boulaos 2', 'Z2', 'BOULAOS'),
    ('Boulaos 3', 'Z3', 'BOULAOS'),
    ('Boulaos 4', 'Z4', 'BOULAOS'),
    ('Balbala 5', 'Z5', 'BALBALA'),
    ('Balbala 6', 'Z6', 'BALBALA'),
    ('Aires speciales', 'Z9', 'BOULAOS'),
    ('Aires speciales', 'Z9', 'BALBALA')
) AS v(name, code, commune)
JOIN "Communes" c ON c."Name" = v.commune
WHERE NOT EXISTS (
  SELECT 1 FROM "Zones" z WHERE z."CommuneId" = c."Id" AND z."Code" = v.code
);

-- 2. Liberation prealable des AreaNumber repris. "IX_Quartiers_CityId_AreaNumber"
--    est UNIQUE et non differable : sans ce passage a NULL, les permutations
--    (Quartier 7 101 -> 310 libere 101 pour Heron) echoueraient en collision.
CREATE TEMP TABLE reprise_cible (
  quartier_id uuid PRIMARY KEY, area integer, zone_code text, commune text
) ON COMMIT DROP;
INSERT INTO reprise_cible (quartier_id, area, zone_code, commune) VALUES
    /* Héron                             */ ('3c0954d9-f1ed-41ce-b431-b34c0f1be12f'::uuid, 101, 'Z1', 'RAS DIKA'),
    /* Marabout                          */ ('42513af6-59a7-4a05-b741-dea68fe42709'::uuid, 102, 'Z1', 'RAS DIKA'),
    /* Plateau du Serpent                */ ('9425251a-7244-42f7-bcf6-33a19de16f87'::uuid, 104, 'Z1', 'RAS DIKA'),
    /* Lotissement de la République      */ ('f76b152b-4992-4671-bd6b-4f721a5cebe1'::uuid, 105, 'Z1', 'RAS DIKA'),
    /* Centre Commercial et Admnistratif */ ('f1d3b61d-415c-4eb6-9ae2-0bae21c51a01'::uuid, 106, 'Z1', 'RAS DIKA'),
    /* Cité Saoudienne                   */ ('1e912a31-2f0b-462a-8c25-f8a166172a46'::uuid, 201, 'Z2', 'BOULAOS'),
    /* Einguela                          */ ('7286cbaa-f32b-453f-a640-7b1f771a2f86'::uuid, 202, 'Z2', 'BOULAOS'),
    /* Quartier 1                        */ ('3c6133f0-9733-44d8-9d03-576a21ea093b'::uuid, 203, 'Z2', 'BOULAOS'),
    /* Quartier 2                        */ ('a6668e0a-2bed-442b-af6f-a5d4b13660e4'::uuid, 204, 'Z2', 'BOULAOS'),
    /* Quartier 3                        */ ('43432c44-abae-4cad-86c9-b3de3e25ded4'::uuid, 205, 'Z2', 'BOULAOS'),
    /* Quartier 4                        */ ('f39b6559-cad1-44b3-bc79-f90e12da53ff'::uuid, 206, 'Z2', 'BOULAOS'),
    /* Cité F.N.P.                       */ ('e06ebf26-5a3a-478f-ad94-e5be0ddca1ee'::uuid, 301, 'Z3', 'BOULAOS'),
    /* Cité d' Arhiba                    */ ('6926b403-7e07-4fae-bc6e-7956d00e70f6'::uuid, 303, 'Z3', 'BOULAOS'),
    /* Cité Makka al Moukarama           */ ('3ad79a0c-6382-487b-8440-4b4832a509fa'::uuid, 304, 'Z3', 'BOULAOS'),
    /* Wadagir                           */ ('578d2c93-b7a0-4373-bb49-72f01df01c0f'::uuid, 306, 'Z3', 'BOULAOS'),
    /* Cité Poudrière                    */ ('6d0878aa-cba1-4621-9f11-6f57909e1c98'::uuid, 307, 'Z3', 'BOULAOS'),
    /* Quartier 5                        */ ('8ce8640d-8ccf-4f6a-80bb-35e2d3e2190c'::uuid, 308, 'Z3', 'BOULAOS'),
    /* Quartier 6                        */ ('c4ad6eaa-4d1b-4222-aae7-4afc8d731c69'::uuid, 309, 'Z3', 'BOULAOS'),
    /* Quartier 7                        */ ('deadd2cc-fefc-403b-af2a-b7fcb9b6769f'::uuid, 310, 'Z3', 'BOULAOS'),
    /* Palmeraie                         */ ('0518b057-a4e1-44a4-b12b-185b8477afdb'::uuid, 312, 'Z3', 'BOULAOS'),
    /* Cité Gachamaleh                   */ ('657027a3-4f4f-47e9-9ea4-b65bac253528'::uuid, 313, 'Z3', 'BOULAOS'),
    /* Quartier 7 Bis                    */ ('c37cd747-37c2-42d0-b8c5-e5371598281b'::uuid, 314, 'Z3', 'BOULAOS'),
    /* Cité du Stade                     */ ('082ad830-f2e7-4c53-b132-5bc9df0b1242'::uuid, 315, 'Z3', 'BOULAOS'),
    /* Guelleh Batal                     */ ('9b4fcb01-b4ba-4b81-a493-c781e4844b2d'::uuid, 316, 'Z3', 'BOULAOS'),
    /* Zone Industrielle Sud             */ ('d0fc3bac-5549-4e23-bfb3-84705db1d6ad'::uuid, 317, 'Z3', 'BOULAOS'),
    /* Ambouli                           */ ('fa5425ac-16f1-4515-9f2f-e72b606eabfd'::uuid, 401, 'Z4', 'BOULAOS'),
    /* Cité Progrès                      */ ('a273b5c0-952c-48dd-a05e-a4436126fc96'::uuid, 402, 'Z4', 'BOULAOS'),
    /* Haramous                          */ ('70b45b03-e4f3-40f7-81ab-fed2ce07a411'::uuid, 404, 'Z4', 'BOULAOS'),
    /* Djebel                            */ ('42a60c14-977f-47d4-8945-ec7b6f00846c'::uuid, 405, 'Z4', 'BOULAOS'),
    /* Lotissement de l'Aérogare         */ ('24c56b28-0888-46fe-99b7-80e20f537949'::uuid, 406, 'Z4', 'BOULAOS'),
    /* Lotissement de l' Aviation        */ ('83b15506-8088-4ea3-a1d7-58569f25ee38'::uuid, 407, 'Z4', 'BOULAOS'),
    /* HAYABLEH                          */ ('c542bc30-5d2a-4337-93df-4b51d876d05f'::uuid, 508, 'Z5', 'BALBALA'),
    /* Cite Barwaqo                      */ ('5a13ea8c-e165-4fbe-b251-84e10c0568f0'::uuid, 509, 'Z5', 'BALBALA'),
    /* BALBALA Q 5                       */ ('63e360d1-cee4-48f8-9446-bfc3ed74307e'::uuid, 511, 'Z5', 'BALBALA'),
    /* Cheik Moussa                      */ ('9c7c8b4c-369e-4ae4-b86c-cc3725cbc94d'::uuid, 512, 'Z5', 'BALBALA'),
    /* PK12                              */ ('bbda0d75-3d4e-4c20-82ac-6d37e4713c6c'::uuid, 603, 'Z6', 'BALBALA'),
    /* CITE HODAN                        */ ('c61c5f31-6a65-462d-854f-1ab3a57516b0'::uuid, 604, 'Z6', 'BALBALA'),
    /* Wahladaba Sud                     */ ('07f69413-5f13-4220-a6f7-002779b51b44'::uuid, 605, 'Z6', 'BALBALA'),
    /* Bahache                           */ ('9f60d7e6-e922-4909-af7d-cd62f56e1b33'::uuid, 607, 'Z6', 'BALBALA'),
    /* Cité Luxembourg                   */ ('f8d7bfe3-1974-411b-b0ea-d54fecf586a2'::uuid, 608, 'Z6', 'BALBALA'),
    /* Quarawil                          */ ('7db00ec7-10c3-4475-897c-b689f11b5e18'::uuid, 609, 'Z6', 'BALBALA'),
    /* Pompage                           */ ('39d30770-cdaf-42f2-998f-3ace877f80d0'::uuid, 610, 'Z6', 'BALBALA'),
    /* BACHE A EAU                       */ ('c2488599-c32e-4a0a-b761-4c7a06d705b8'::uuid, 612, 'Z6', 'BALBALA'),
    /* T3                                */ ('d4c274fd-2e9a-4873-ba84-a3f4834938fc'::uuid, 613, 'Z6', 'BALBALA'),
    /* BALBALA Q11                       */ ('b74f777c-2119-4782-a367-ac7e5ec4e6df'::uuid, 614, 'Z6', 'BALBALA'),
    /* BALBALA ANCIEN                    */ ('1e222daa-c0cd-48d8-b521-323ca52efd6e'::uuid, 615, 'Z6', 'BALBALA'),
    /* DRY PORT                          */ ('2b28f32d-f58b-4740-97ef-fe2452598807'::uuid, 902, 'Z9', 'BOULAOS'),
    /* Cimetière                         */ ('2152ac52-3184-4240-837f-0f7fa86e65f5'::uuid, 903, 'Z9', 'BALBALA');

UPDATE "Quartiers" SET "AreaNumber" = NULL
WHERE "Id" IN (SELECT quartier_id FROM reprise_cible);

-- 3. AreaNumber + zone. La commune est posee explicitement : une zone sans commune
--    est refusee par le contrat, et deux quartiers sont en base sans commune.
UPDATE "Quartiers" q
SET "AreaNumber" = t.area,
    "ZoneId"     = z."Id",
    "CommuneId"  = c."Id"
FROM reprise_cible t
JOIN "Communes" c ON c."Name" = t.commune
JOIN "Zones" z ON z."Code" = t.zone_code AND z."CommuneId" = c."Id"
WHERE q."Id" = t.quartier_id;

-- 4. Les quartiers manquants retrouves dans le SIG, avec leur emprise.
--    delimitations_quartiers est en 32638 MULTIPOLYGON, "Quartiers"."Boundary" en
--    4326 POLYGON : toutes ces emprises sont mono-partie et valides, verifie en amont.
INSERT INTO "Quartiers" ("Id", "Nom", "Code", "AreaNumber", "CityId", "CommuneId", "ZoneId", "Boundary")
SELECT gen_random_uuid(), v.nom, v.code, v.area, c."CityId", c."Id", z."Id",
       ST_Force2D(ST_Transform(ST_GeometryN(d.wkb_geometry, 1), 4326))
FROM (VALUES
    ('Dôgley', 'DG', 507, 'BALBALA', 'Z5'),
    ('Place Mahadsanid', 'PM', 515, 'BALBALA', 'Z5'),
    ('Shabeley', 'SH', 602, 'BALBALA', 'Z6'),
    ('Cité Doumeira', 'DO', 503, 'BALBALA', 'Z5'),
    ('Warabley', 'WB', 505, 'BALBALA', 'Z5'),
    ('Layableh', 'LY', 506, 'BALBALA', 'Z5'),
    ('Nasib Wanag', 'NW', 514, 'BALBALA', 'Z5'),
    ('Harirad', 'HI', 516, 'BALBALA', 'Z5'),
    ('Cité Gar Gar', 'GG', 601, 'BALBALA', 'Z6'),
    ('Cité Cheikh Osman', 'CQ', 618, 'BALBALA', 'Z6')
) AS v(nom, code, area, commune, zone_code)
JOIN "Communes" c ON c."Name" = v.commune
JOIN "Zones" z ON z."Code" = v.zone_code AND z."CommuneId" = c."Id"
JOIN delimitations_quartiers d ON d.nom = v.nom
WHERE NOT EXISTS (
  SELECT 1 FROM "Quartiers" x WHERE x."CityId" = c."CityId" AND x."Nom" = v.nom
);

-- 5. Garde-fous. Toute violation annule la transaction entiere.
DO $garde$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM "Quartiers" q
  JOIN reprise_cible t ON t.quartier_id = q."Id"
  WHERE q."AreaNumber" IS DISTINCT FROM t.area OR q."ZoneId" IS NULL;
  IF n <> 0 THEN RAISE EXCEPTION '% quartiers repris non conformes', n; END IF;

  SELECT count(*) INTO n FROM "Quartiers" WHERE "AreaNumber" IN (507, 515, 602, 503, 505, 506, 514, 516, 601, 618)
    AND "CityId" = (SELECT "Id" FROM "Cities" WHERE "Name" = 'Djibouti');
  IF n <> 10 THEN RAISE EXCEPTION 'creations manquantes : % sur 10', n; END IF;

  SELECT count(*) INTO n FROM (
    SELECT "CityId", "AreaNumber" FROM "Quartiers"
    WHERE "AreaNumber" IS NOT NULL
    GROUP BY 1, 2 HAVING count(*) > 1) s;
  IF n <> 0 THEN RAISE EXCEPTION 'AreaNumber en doublon dans une ville'; END IF;

  SELECT count(*) INTO n FROM "Quartiers"
  WHERE "ZoneId" IS NOT NULL AND "CommuneId" IS NULL;
  IF n <> 0 THEN RAISE EXCEPTION 'quartier avec zone mais sans commune'; END IF;

  SELECT count(*) INTO n FROM "Quartiers" q JOIN "Zones" z ON z."Id" = q."ZoneId"
  WHERE z."CommuneId" <> q."CommuneId";
  IF n <> 0 THEN RAISE EXCEPTION 'zone hors de la commune du quartier'; END IF;
END $garde$;

COMMIT;

