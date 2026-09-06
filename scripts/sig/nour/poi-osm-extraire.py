#!/usr/bin/env python3
"""Réponse Overpass (bâtiments remarquables) → `nour.poi_osm`.

    curl -X POST --data-binary @scripts/sig/nour/poi-osm.overpass \\
      https://overpass-api.de/api/interpreter -o poi.json
    python3 scripts/sig/nour/poi-osm-extraire.py poi.json > scripts/sig/nour/poi-osm.sql
    psql "$DB" -v ON_ERROR_STOP=1 -f scripts/sig/nour/poi-osm.sql

POURQUOI UNE CATÉGORIE FERMÉE. OSM décrit un même objet de plusieurs façons — un hôpital est
`amenity=hospital` chez l'un, `building=hospital` chez l'autre, parfois les deux. 961 objets
relevés le 2026-09-06 se répartissaient sur une trentaine de couples clé=valeur. Les laisser
tels quels obligerait le front à connaître la taxonomie OSM ; il n'a besoin que de savoir quelle
icône afficher. La table porte donc une `categorie` prise dans un vocabulaire FERMÉ, et le tag
d'origine à côté — pour qu'un classement contestable reste vérifiable.

L'ordre de test compte : `amenity` d'abord, `building` en dernier. Un `building=school` qui porte
aussi `amenity=hospital` est un hôpital installé dans une ancienne école, pas une école.

GÉOMÉTRIE : un point par objet. Overpass rend `center` pour les surfaces et `lat/lon` pour les
nœuds — on ne récupère pas les contours, parce que la table sert à POSITIONNER une icône et à
retrouver l'adresse qui contient le point. Le contour, lui, existe déjà dans `Adresses`.
"""

from __future__ import annotations

import json
import sys

# (clé OSM, valeur, catégorie, sous-catégorie). Premier couple trouvé dans cet ordre = retenu.
REGLES = [
    ("amenity", "hospital",        "sante",          "hopital"),
    ("amenity", "clinic",          "sante",          "clinique"),
    ("amenity", "doctors",         "sante",          "cabinet medical"),
    ("amenity", "dentist",         "sante",          "dentiste"),
    ("amenity", "pharmacy",        "sante",          "pharmacie"),
    ("amenity", "school",          "education",      "ecole"),
    ("amenity", "college",         "education",      "college"),
    ("amenity", "university",      "education",      "universite"),
    ("amenity", "kindergarten",    "education",      "maternelle"),
    ("amenity", "library",         "culture",        "bibliotheque"),
    ("amenity", "place_of_worship","culte",          "lieu de culte"),
    ("amenity", "police",          "securite",       "police"),
    ("amenity", "fire_station",    "securite",       "pompiers"),
    ("amenity", "prison",          "securite",       "prison"),
    ("amenity", "townhall",        "administration", "mairie"),
    ("amenity", "courthouse",      "administration", "tribunal"),
    ("amenity", "post_office",     "administration", "poste"),
    ("amenity", "embassy",         "administration", "ambassade"),
    ("amenity", "bank",            "finance",        "banque"),
    ("amenity", "marketplace",     "commerce",       "marche"),
    ("amenity", "fuel",            "transport",      "station service"),
    ("amenity", "bus_station",     "transport",      "gare routiere"),
    ("amenity", "community_centre","culture",        "centre communautaire"),
    ("office",  "government",      "administration", "service de l Etat"),
    ("office",  "administrative",  "administration", "service administratif"),
    ("office",  "diplomatic",      "administration", "representation diplomatique"),
    ("office",  "ngo",             "administration", "organisation non gouvernementale"),
    ("tourism", "hotel",           "hebergement",    "hotel"),
    ("tourism", "motel",           "hebergement",    "motel"),
    ("tourism", "guest_house",     "hebergement",    "maison d hotes"),
    ("tourism", "hostel",          "hebergement",    "auberge"),
    ("tourism", "museum",          "culture",        "musee"),
    ("leisure", "stadium",         "sport",          "stade"),
    ("leisure", "sports_centre",   "sport",          "centre sportif"),
    ("shop",    "supermarket",     "commerce",       "supermarche"),
    ("shop",    "mall",            "commerce",       "centre commercial"),
    ("shop",    "department_store","commerce",       "grand magasin"),
    ("aeroway", "terminal",        "transport",      "aerogare"),
    # `building=*` en DERNIER : c'est la description du bâti, pas de l'usage. Un bâtiment
    # scolaire peut abriter autre chose ; les clés d'usage ci-dessus l'emportent.
    ("building","hospital",        "sante",          "hopital"),
    ("building","school",          "education",      "ecole"),
    ("building","university",      "education",      "universite"),
    ("building","church",          "culte",          "eglise"),
    ("building","mosque",          "culte",          "mosquee"),
    ("building","government",      "administration", "batiment public"),
    ("building","hotel",           "hebergement",    "hotel"),
    ("building","civic",           "administration", "batiment public"),
]


def sans_arabe(texte: str) -> str:
    """À Djibouti, `name` colle souvent le français et l'arabe dans le même champ."""
    garde = "".join(c for c in texte if not ("؀" <= c <= "ۿ" or "ﭐ" <= c <= "﻿"))
    return " ".join(garde.split()).strip(" -–—/")


def classer(tags: dict) -> tuple[str, str, str] | None:
    for cle, valeur, cat, sous in REGLES:
        if tags.get(cle) == valeur:
            return cat, sous, f"{cle}={valeur}"
    return None


def sql(v: str | None) -> str:
    return "NULL" if v is None else "'" + v.replace("'", "''") + "'"


def main() -> None:
    if len(sys.argv) != 2:
        print("usage: poi-osm-extraire.py <reponse-overpass.json>", file=sys.stderr)
        raise SystemExit(2)

    elements = json.load(open(sys.argv[1], encoding="utf-8"))["elements"]

    lignes, ignores, sans_nom = [], 0, 0
    for e in elements:
        tags = e.get("tags") or {}
        classe = classer(tags)
        if not classe:
            ignores += 1
            continue
        cat, sous, tag_src = classe

        # `center` pour les surfaces et les relations, `lat`/`lon` pour les nœuds.
        lat = e.get("lat", (e.get("center") or {}).get("lat"))
        lon = e.get("lon", (e.get("center") or {}).get("lon"))
        if lat is None or lon is None:
            ignores += 1
            continue

        nom = tags.get("name:fr") or sans_arabe(tags.get("name", "")) or None
        if not nom:
            sans_nom += 1
        lignes.append(
            f"({sql(e['type'])},{e['id']},{sql(nom)},{sql(cat)},{sql(sous)},{sql(tag_src)},"
            f"ST_SetSRID(ST_MakePoint({lon},{lat}),4326))"
        )

    print("-- Généré par scripts/sig/nour/poi-osm-extraire.py — ne pas éditer à la main.")
    print("-- Source : OpenStreetMap (ODbL). L'attribution est obligatoire dès l'affichage.")
    print("DROP TABLE IF EXISTS nour.poi_osm CASCADE;")
    print("""CREATE TABLE nour.poi_osm (
  osm_type      text NOT NULL,
  osm_id        bigint NOT NULL,
  nom           text,
  categorie     text NOT NULL,
  sous_categorie text NOT NULL,
  tag_source    text NOT NULL,
  geom          geometry(Point,4326) NOT NULL,
  PRIMARY KEY (osm_type, osm_id)
);""")
    print("INSERT INTO nour.poi_osm (osm_type,osm_id,nom,categorie,sous_categorie,tag_source,geom) VALUES")
    print(",\n".join(lignes) + ";")
    print("CREATE INDEX poi_osm_geom_idx ON nour.poi_osm USING GIST (geom);")
    print("CREATE INDEX poi_osm_categorie_idx ON nour.poi_osm (categorie);")

    print(f"{len(lignes)} objets retenus, {sans_nom} sans nom, {ignores} ecartes", file=sys.stderr)


if __name__ == "__main__":
    main()
