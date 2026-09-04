-- Vue de tuiles des villes, pour la couche de contexte national du panneau des couches.
--
-- ⚠️ EMPLACEMENT. Cette vue appartient au backend, aux côtés de `blocs_tiles`, `streets_tiles`,
-- `closes_tiles` et `quartiers_tiles` — sa place définitive est `dasApi/scripts/creer-vues-tiles.sql`.
-- Elle est versionnée ici parce que c'est le front qui en a eu besoin ; à recopier là-bas, sans
-- quoi une reconstruction de la base la perdrait et la couche deviendrait muette en silence
-- (une source Martin qui ne résout pas échoue SANS erreur).
--
-- Pourquoi une vue alors que Martin publie déjà la table `Cities` : pour écarter les villes
-- SANS emprise. `Cities."Boundary"` est nullable et l'API crée les villes avec
-- `boundaryWkt: null` (guide §3.1) — servir ces lignes produirait des tuiles contenant des
-- entités que MapLibre compte sans jamais les dessiner. Même raison que `quartiers_tiles`.
--
-- Nommage des colonnes en PascalCase : c'est la casse SQL exacte que les expressions de
-- `map-style.json` attendent sur les sources Martin, et elle est sensible à la casse.
--
-- ⚠️ Les emprises servies ici sont PROVISOIRES : ce sont les polygones de RÉGION de
-- `nour.contour_rdd`, posés le 2026-09-04 faute d'emprises urbaines (voir
-- `scripts/sig/nour/95_` et `96_`). Dikhil « fait » 6 633 km². Bon pour situer, faux pour
-- mesurer. C'est pourquoi la couche est dessinée en CONTOUR et non en aplat.
--
--   docker run --rm -i --add-host=host.docker.internal:host-gateway \
--     postgis/postgis:17-3.5 psql "$DB" -v ON_ERROR_STOP=1 -f - < scripts/sig/vue-cities-tiles.sql

-- `Fid` : identifiant NUMERIQUE stable, indispensable a l'etiquetage.
-- Une emprise de ville couvre plusieurs tuiles ; MapLibre place alors une etiquette
-- par tuile et ne les dedoublonne que par `feature.id`, qui doit etre un ENTIER.
-- Avec `promoteId: "Id"` (un UUID), la deduplication echoue en silence et « DJIBOUTI »
-- s'affiche deux fois. Le style promeut donc `Fid`, pas `Id`.
-- `Id` reste expose : c'est lui qui identifie la ville cote metier.
-- `Fid` est en DERNIERE position : `CREATE OR REPLACE VIEW` n'autorise que l'ajout
-- de colonnes en fin de liste, jamais l'insertion en tete ni le renommage
-- (« cannot change name of view column »). L'ordre n'a aucune importance pour
-- Martin, qui reconnait la colonne geometrique par son type.
CREATE OR REPLACE VIEW cities_tiles AS
SELECT
  c."Id",
  c."Name",
  c."Code",
  c."Boundary",
  row_number() OVER (ORDER BY c."Id")::int AS "Fid"
FROM "Cities" c
WHERE c."Boundary" IS NOT NULL;

COMMENT ON VIEW cities_tiles IS
  'Villes dessinables (emprise non nulle) pour la couche de fond « Villes ». '
  'Emprises provisoires = polygones de région, cf. scripts/sig/nour/.';

-- ---------------------------------------------------------------------------
-- Vue d'ETIQUETTES : un POINT par ville, pas le polygone.
--
-- Pourquoi une source distincte plutôt qu'un `symbol` sur `cities_tiles` :
-- une emprise de ville traverse plusieurs tuiles, et MapLibre calcule l'ancre
-- d'une étiquette de polygone à partir de la géométrie CLIPPÉE dans chaque
-- tuile. Les ancres tombent donc à des endroits différents et la déduplication
-- inter-tuiles ne peut pas les rapprocher : « DJIBOUTI » s'affiche deux fois.
-- Donner un id numérique (`Fid`) ne suffit pas — vérifié le 2026-09-04.
--
-- Avec un POINT calculé ici, la ville n'existe que dans UNE tuile par niveau
-- de zoom : une ancre, une étiquette, quel que soit le découpage.
--
-- `ST_PointOnSurface` et non `ST_Centroid` : le centroïde d'un polygone
-- concave (le contour de Djibouti l'est, il épouse le golfe) peut tomber
-- HORS de la ville. `PointOnSurface` garantit un point à l'intérieur.
-- Le CAST explicite en `geometry(Point,4326)` n'est pas cosmetique : dans une
-- vue, `geometry_columns` deduit le typmod de l'EXPRESSION, et
-- `ST_PointOnSurface(...)` retourne un `geometry` sans contrainte -> la colonne
-- est publiee en type GEOMETRY, SRID 0. Martin ignore alors la source : elle
-- n'apparait pas au catalogue et la tuile repond 404, sans autre message.
-- DROP puis CREATE, car `CREATE OR REPLACE VIEW` ne sait pas changer un type.
DROP VIEW IF EXISTS cities_labels_tiles;
CREATE VIEW cities_labels_tiles AS
SELECT
  c."Id",
  c."Name",
  c."Code",
  ST_SetSRID(ST_PointOnSurface(c."Boundary"), 4326)::geometry(Point, 4326) AS "Boundary",
  row_number() OVER (ORDER BY c."Id")::int AS "Fid"
FROM "Cities" c
WHERE c."Boundary" IS NOT NULL;

COMMENT ON VIEW cities_labels_tiles IS
  'Point d''etiquette par ville (ST_PointOnSurface). Evite le doublon d''etiquette '
  'que produit un symbole pose sur un polygone reparti sur plusieurs tuiles.';
