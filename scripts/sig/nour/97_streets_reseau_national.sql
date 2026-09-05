-- =====================================================================
--  D.A.S — versement du réseau routier national de `nour` dans `Streets`
-- ---------------------------------------------------------------------
--  SOURCE : nour.routes_1 (73), routes_2 (31), pistes_1 (438), pistes_2 (153)
--           = 695 tronçons, 4 453 km. Tous en MULTILINESTRING 4326.
--
--  CE QUE CES DONNÉES SONT — et ne sont pas :
--  les 695 tronçons sont **tous anonymes**. Le seul champ texte, `id_`, porte
--  la couleur du crayon du cartographe (`magenta0`, `noir282`, `bleu1000`),
--  pas un nom de voie. `Name` est donc laissé à NULL : c'est la vérité de la
--  donnée, pas une omission. Il y a un précédent — `Streets` contient déjà
--  249 lignes anonymes à code `SIG-*` (203 Pistes, 23 Rues, 13 Boulevards,
--  10 Routes).
--
--  DÉDOUBLONNAGE — pourquoi pas un simple ST_DWithin :
--  un test de proximité déclare « déjà repris » tout tronçon qui FRÔLE une rue
--  existante, même sur quelques mètres. Sur ce lot il annonçait 333 doublons
--  sur 695. En mesurant la **part de longueur** réellement couverte par un
--  tampon de 10 m autour des `Streets`, il n'en reste que 3. L'écart n'est pas
--  un détail de seuil : les routes nationales traversent la ville en croisant
--  des dizaines de rues sans être ces rues.
--  Critère retenu : doublon si ≥ 80 % de la longueur est couverte.
--
--  CODES : `SIG-RT1/RT2/PI1/PI2-<ogc_fid sur 5 chiffres>`, dans la continuité
--  des `SIG-VS-`, `SIG-VE-`, `SIG-VTB-`, `SIG-VTNB-` déjà en base. `Code` est
--  NOT NULL, il fallait en produire un ; il est déterministe, donc rejouable.
--  `Type` : 'Route' pour les routes, 'Piste' pour les pistes — vocabulaire
--  existant ('Rue', 'Boulevard', 'Avenue', 'Route', 'Piste').
--
--  Id déterministe = md5('das_street:'||Code) => IDEMPOTENT.
--  N'écrit QUE des INSERT : aucune ligne existante n'est modifiée.
-- =====================================================================
BEGIN;
SET LOCAL statement_timeout = '900s';

CREATE TEMP TABLE source_lin ON COMMIT DROP AS
  SELECT 'SIG-RT1-' AS prefixe, 'Route' AS typ, ogc_fid, wkb_geometry AS g FROM nour.routes_1
  UNION ALL SELECT 'SIG-RT2-', 'Route', ogc_fid, wkb_geometry FROM nour.routes_2
  UNION ALL SELECT 'SIG-PI1-', 'Piste', ogc_fid, wkb_geometry FROM nour.pistes_1
  UNION ALL SELECT 'SIG-PI2-', 'Piste', ogc_fid, wkb_geometry FROM nour.pistes_2;

-- Part de longueur déjà couverte par les Streets existantes.
CREATE TEMP TABLE recouvrement ON COMMIT DROP AS
SELECT s.prefixe, s.typ, s.ogc_fid, s.g,
       ST_Length(s.g::geography) AS longueur_m,
       COALESCE((
         SELECT ST_Length(ST_Intersection(
                  s.g,
                  ST_Union(ST_Buffer(st."Boundary"::geography, 10)::geometry)
                )::geography)
         FROM   "Streets" st
         WHERE  st."Boundary" && ST_Expand(s.g, 0.0005)
       ), 0) AS couvert_m
FROM   source_lin s;

INSERT INTO "Streets" ("Id", "Code", "Name", "Type", "Boundary")
SELECT md5('das_street:' || r.prefixe || lpad(r.ogc_fid::text, 5, '0'))::uuid,
       r.prefixe || lpad(r.ogc_fid::text, 5, '0'),
       NULL::varchar,
       r.typ,
       ST_Multi(r.g)
FROM   recouvrement r
WHERE  r.longueur_m > 0
  AND  r.couvert_m / r.longueur_m < 0.80
  AND  NOT EXISTS (
         SELECT 1 FROM "Streets" s
         WHERE s."Code" = r.prefixe || lpad(r.ogc_fid::text, 5, '0'));

COMMIT;

-- Contrôle
SELECT split_part("Code", '-', 2) AS lot,
       "Type",
       count(*) AS lignes,
       count("Name") AS nommees,
       round((ST_Length(ST_Collect("Boundary")::geography) / 1000)::numeric) AS km
FROM   "Streets"
WHERE  "Code" LIKE 'SIG-RT_-%' OR "Code" LIKE 'SIG-PI_-%'
GROUP  BY 1, 2
ORDER  BY 1;
