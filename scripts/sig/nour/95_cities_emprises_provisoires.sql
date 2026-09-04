-- =====================================================================
--  D.A.S — création des 4 villes manquantes, avec emprise PROVISOIRE
-- ---------------------------------------------------------------------
--  `Cities` ne contient que Djibouti (Code 77) et Ali Sabieh (Code 78),
--  alors que le pays compte 6 chefs-lieux. `nour.villes_pt` les liste tous.
--  Manquent : Arta, Dikhil, Obock, Tadjourah.
--
--  EMPRISE PROVISOIRE — à lire avant de s'en servir :
--  la seule surface disponible dans la livraison est le polygone de RÉGION
--  (`nour.contour_rdd`). Une région n'est PAS une emprise urbaine :
--  Dikhil = 6 633 km², Tadjourah = 6 571, Obock = 4 409, Arta = 1 825.
--  On pose donc un contenant, pas un contour de ville. Tout calcul
--  « adresse dans la ville » sera juste ; tout calcul de densité, de
--  surface ou de cadrage automatique sera grossièrement faux.
--  À remplacer dès que l'expert livre des emprises urbaines.
--
--  `Code` est laissé à NULL VOLONTAIREMENT. C'est le préfixe du code postal
--  (`postcode` = `City.Code` || `Quartier.AreaNumber`, cf. guide §3.1) :
--  l'inventer fabriquerait des codes postaux nationaux faux. Il doit être
--  attribué par le porteur du plan de numérotation.
--
--  Id déterministe = md5('das_city:'||nom en minuscules) => script IDEMPOTENT.
--  N'écrit QUE des INSERT : aucune ligne existante n'est modifiée.
--
--  Vérifié avant écriture : les 6 polygones de région sont valides et chacun
--  contient bien son chef-lieu (`nour.villes_pt`). Tadjourah est en 3 parties
--  (îles) ; on retient la plus grande, `Cities."Boundary"` étant typé POLYGON.
-- =====================================================================
BEGIN;

CREATE TEMP TABLE villes_a_creer (nom text, region text) ON COMMIT DROP;
INSERT INTO villes_a_creer (nom, region) VALUES
  ('Arta',      'Arta'),
  ('Dikhil',    'Dikhil'),
  ('Obock',     'Obock'),
  ('Tadjourah', 'Tadjourah');

INSERT INTO "Cities" ("Id", "Name", "Code", "Boundary")
SELECT md5('das_city:' || lower(v.nom))::uuid,
       v.nom,
       NULL::int,
       ST_Force2D(
         (SELECT d.geom
          FROM   ST_Dump(r.wkb_geometry) d
          ORDER  BY ST_Area(d.geom) DESC
          LIMIT  1))
FROM   villes_a_creer v
JOIN   nour.contour_rdd r ON lower(r.names_) = lower(v.region)
WHERE  NOT EXISTS (
         SELECT 1 FROM "Cities" c WHERE lower(c."Name") = lower(v.nom));

COMMIT;

-- Contrôle
SELECT c."Name",
       c."Code",
       c."Boundary" IS NOT NULL                          AS a_emprise,
       ST_GeometryType(c."Boundary")                     AS type_geom,
       round((ST_Area(c."Boundary"::geography)/1e6)::numeric) AS km2_provisoire
FROM   "Cities" c
ORDER  BY c."Name";
