-- Vue de tuiles des quartiers : porte la zone ET le code postal, pour les couches de fond.
--
-- ⚠️ EMPLACEMENT. Cette vue appartient au backend, aux côtés de `blocs_tiles`, `streets_tiles`
-- et `closes_tiles` — sa place définitive est `dasApi/scripts/creer-vues-tiles.sql`. Elle est
-- versionnée ici parce que c'est le front qui en a eu besoin ; à recopier là-bas, sans quoi une
-- reconstruction de la base la perdrait et les deux couches deviendraient muettes en silence
-- (une source Martin qui ne résout pas échoue SANS erreur).
--
-- Pourquoi une vue et pas la table `Quartiers`, que Martin publie déjà : `postcode` n'est pas
-- une colonne, c'est un DÉRIVÉ de `City."Code"` et `Quartier."AreaNumber"`. Le composer côté
-- front est explicitement interdit (CLAUDE.md §9) — la seule place correcte pour ce calcul est
-- ici, au plus près de la donnée qui le fonde.
--
-- Nommage des colonnes en PascalCase : c'est la casse SQL exacte que les expressions de
-- `map-style.json` attendent sur les sources Martin, et elle est sensible à la casse.
--
--   docker run --rm -i --add-host=host.docker.internal:host-gateway \
--     postgis/postgis:17-3.5 psql "$DB" -v ON_ERROR_STOP=1 -f - < scripts/sig/vue-quartiers-tiles.sql

CREATE OR REPLACE VIEW quartiers_tiles AS
SELECT
  q."Id",
  q."Nom",
  q."Code",
  q."AreaNumber",
  -- Même règle que le back : code ville sur 2 chiffres + numéro de quartier sur 3.
  -- NULL dès qu'un des deux manque — le vide est une information, pas un défaut à combler.
  CASE
    WHEN ci."Code" IS NULL OR q."AreaNumber" IS NULL THEN NULL
    ELSE lpad(ci."Code"::text, 2, '0') || lpad(q."AreaNumber"::text, 3, '0')
  END AS "Postcode",
  q."ZoneId",
  z."Name" AS "ZoneName",
  z."Code" AS "ZoneCode",
  q."CommuneId",
  cm."Name" AS "CommuneName",
  q."CityId",
  ci."Name" AS "CityName",
  q."Boundary"
FROM "Quartiers" q
JOIN "Cities" ci ON ci."Id" = q."CityId"
LEFT JOIN "Zones" z ON z."Id" = q."ZoneId"
LEFT JOIN "Communes" cm ON cm."Id" = q."CommuneId"
-- Un quartier sans emprise n'est pas dessinable : l'exclure ici évite de servir des tuiles
-- contenant des entités vides, que MapLibre compterait sans jamais les afficher.
WHERE q."Boundary" IS NOT NULL;
