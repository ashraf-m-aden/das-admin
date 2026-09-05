#!/usr/bin/env python3
"""Réponse Overpass (routes nommées) → un GeoJSON, une entité par NOM de rue.

Étape 1 sur 2. L'étape 2 (`routes-osm-vers-streets.sql`) confronte ce fichier à `Streets` et
n'écrit que ce qui manque. Séparer les deux permet de relire le résultat du regroupement avant
d'écrire quoi que ce soit dans le référentiel.

    curl -X POST -d '[out:json][timeout:280];way["highway"]["name"](10.85,41.70,12.80,43.50);out geom;' \\
      https://overpass-api.de/api/interpreter -o routes-osm.json
    python3 scripts/sig/routes-osm-extraire.py routes-osm.json > routes-osm.geojson

Trois décisions portées ici, chacune apprise de la donnée réelle (extraction du 2026-09-02,
1 105 tronçons nommés) :

1. **Le nom OSM est bilingue.** À Djibouti, `name` vaut « Avenue Ali Bahdon شارع علي بهدون » sur
   828 tronçons sur 1 105 : le français ET l'arabe collés dans le même champ. Le référentiel est
   francophone. On prend donc `name:fr` (présent sur 879 tronçons), et à défaut on retire les
   caractères arabes de `name`. Insérer le champ brut aurait produit des libellés bilingues
   impossibles à rapprocher des 199 noms existants.

2. **Une rue = N tronçons OSM.** OSM découpe une avenue à chaque intersection, changement de
   revêtement ou de sens. Regrouper par nom est ce qui redonne UNE rue — et c'est possible parce
   que `Streets."Boundary"` est un `MultiLineString` (vérifié le 2026-09-02 ; une note plus
   ancienne du dépôt le disait `LineString`, c'est faux et cela bloquait à tort la reprise des
   rues en plusieurs morceaux).

3. **`Type` appartient à un vocabulaire FERMÉ** : Piste, Avenue, Rue, Impasse, Boulevard, Route.
   Ce sont les seules valeurs que les filtres de `map-style.json` savent dessiner — une rue
   portant `Type = 'Chemin'` serait en base et invisible sur la carte, sans erreur nulle part.
   Le type vient d'abord du NOM (« Boulevard de la République » → Boulevard), qui est la volonté
   du nommage, et seulement à défaut du tag `highway`.
"""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from collections import defaultdict

# Ce qui n'est pas une rue adressable. `construction` est exclu aussi : une voie en travaux n'a
# pas à entrer au référentiel tant qu'elle n'existe pas.
HIGHWAY_EXCLUS = {"path", "footway", "steps", "cycleway", "pedestrian", "construction", "proposed"}

# Vocabulaire fermé, aligné sur les filtres de `map-style.json`. Toute autre valeur serait
# stockée sans jamais être dessinée.
TYPE_PAR_PREFIXE = [
    (r"^(boulevard|bould|bvd|blvd|bld)\b", "Boulevard"),
    (r"^(avenue|av)\b", "Avenue"),
    (r"^(impasse|imp)\b", "Impasse"),
    (r"^(route|rte|rn\s*\d|nationale)\b", "Route"),
    (r"^(piste)\b", "Piste"),
    (r"^(rue)\b", "Rue"),
]

TYPE_PAR_HIGHWAY = {
    "motorway": "Route", "motorway_link": "Route",
    "trunk": "Route", "trunk_link": "Route",
    "primary": "Route", "primary_link": "Route",
    "secondary": "Boulevard", "secondary_link": "Boulevard",
    "tertiary": "Boulevard", "tertiary_link": "Boulevard",
    "residential": "Rue", "unclassified": "Rue", "living_street": "Rue", "service": "Rue",
    "track": "Piste",
}


def sans_arabe(texte: str) -> str:
    """Retire les caractères arabes et ce qui ne sert plus qu'à les séparer."""
    garde = "".join(c for c in texte if not ("؀" <= c <= "ۿ" or "ﭐ" <= c <= "﻿"))
    return re.sub(r"\s{2,}", " ", garde).strip(" -–—/")


def nom_francais(tags: dict) -> str | None:
    nom = tags.get("name:fr") or sans_arabe(tags.get("name", ""))
    nom = re.sub(r"\s{2,}", " ", nom).strip()
    return nom or None


def normaliser(nom: str) -> str:
    """Clé de rapprochement : c'est elle qui décide si une rue est un doublon.

    Volontairement agressive — accents, casse, ponctuation et abréviations écrasés — parce que
    les deux jeux ne s'écrivent pas pareil : le référentiel porte « BLD BONHOURE » ou
    « Bvd Guelleh Batal » quand OSM écrit « Boulevard Bonhoure ». Comparer les chaînes brutes
    aurait déclaré neuves des rues déjà présentes, et c'est exactement le doublon à éviter.
    """
    sans_accent = "".join(
        c for c in unicodedata.normalize("NFD", nom) if unicodedata.category(c) != "Mn"
    )
    texte = re.sub(r"[^A-Za-z0-9]+", " ", sans_accent.upper()).strip()
    mots = []
    for mot in texte.split():
        mot = {
            "AV": "AVENUE", "AVE": "AVENUE",
            "BLD": "BOULEVARD", "BVD": "BOULEVARD", "BLVD": "BOULEVARD", "BOULD": "BOULEVARD",
            "IMP": "IMPASSE", "RTE": "ROUTE",
        }.get(mot, mot)
        # Articles et particules : « Rue de Moscou » et « Rue Moscou » sont la même rue.
        if mot in {"DE", "DU", "DES", "LA", "LE", "LES", "L", "D", "DELA"}:
            continue
        mots.append(mot)
    return " ".join(mots)


def type_de(nom: str, highway: str) -> str:
    sans_accent = "".join(
        c for c in unicodedata.normalize("NFD", nom) if unicodedata.category(c) != "Mn"
    ).lower()
    for motif, valeur in TYPE_PAR_PREFIXE:
        if re.match(motif, sans_accent):
            return valeur
    return TYPE_PAR_HIGHWAY.get(highway, "Rue")


def main() -> None:
    if len(sys.argv) != 2:
        print("usage: routes-osm-extraire.py <reponse-overpass.json>", file=sys.stderr)
        raise SystemExit(2)

    with open(sys.argv[1], encoding="utf-8") as flux:
        elements = json.load(flux)["elements"]

    groupes: dict[str, dict] = defaultdict(lambda: {"lignes": [], "noms": [], "highways": []})
    ignores = defaultdict(int)

    for e in elements:
        if e.get("type") != "way" or len(e.get("geometry") or []) < 2:
            ignores["geometrie absente ou degeneree"] += 1
            continue
        tags = e.get("tags", {})
        highway = tags.get("highway", "")
        if highway in HIGHWAY_EXCLUS:
            ignores[f"highway={highway}"] += 1
            continue
        nom = nom_francais(tags)
        if not nom:
            ignores["nom vide apres retrait de l arabe"] += 1
            continue

        cle = normaliser(nom)
        g = groupes[cle]
        g["lignes"].append([[p["lon"], p["lat"]] for p in e["geometry"]])
        g["noms"].append(nom)
        g["highways"].append(highway)

    features = []
    for cle, g in sorted(groupes.items()):
        # Le nom RETENU est le plus fréquent : sur une avenue coupée en 20 tronçons, une faute
        # de frappe isolée ne doit pas devenir le libellé du référentiel.
        nom = max(set(g["noms"]), key=g["noms"].count)
        highway = max(set(g["highways"]), key=g["highways"].count)
        features.append({
            "type": "Feature",
            "properties": {
                "nom": nom,
                "cle": cle,
                "type_street": type_de(nom, highway),
                "highway": highway,
                "troncons": len(g["lignes"]),
            },
            "geometry": {"type": "MultiLineString", "coordinates": g["lignes"]},
        })

    print(json.dumps({"type": "FeatureCollection", "features": features}, ensure_ascii=False))

    print(f"{len(features)} rues regroupées depuis {sum(f['properties']['troncons'] for f in features)} tronçons",
          file=sys.stderr)
    for motif, n in sorted(ignores.items(), key=lambda kv: -kv[1]):
        print(f"  ignoré — {motif} : {n}", file=sys.stderr)


if __name__ == "__main__":
    main()
