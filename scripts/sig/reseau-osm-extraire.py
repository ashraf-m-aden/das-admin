#!/usr/bin/env python3
"""Réponse Overpass (RÉSEAU COMPLET) → un GeoJSON, une entité par voie OSM.

Complément de `routes-osm-extraire.py`, qui ne prend que les voies NOMMÉES et les regroupe par
nom. Celui-ci garde TOUT, nommé ou non, et une ligne par voie OSM — le regroupement se fait
ensuite en base (`reseau-osm-vers-streets.sql`), parce qu'il demande de la topologie.

    curl -X POST -d '[out:json][timeout:270];way["highway"](11.549,43.070,11.623,43.170);out geom;' \\
      https://overpass-api.de/api/interpreter -o reseau-osm.json
    python3 scripts/sig/reseau-osm-extraire.py reseau-osm.json > scripts/sig/reseau-osm.geojson

POURQUOI ce second script. La première reprise OSM filtrait sur `["name"]` et a ramené 190 rues.
Résultat mesuré le 2026-09-02 : **Balbala comptait 1 441 blocs, 323 adresses et 11 rues.** Sur
2 765 voies OSM de Balbala, **2 744 n'ont pas de nom** — le filtre écartait tout le quartier.
L'absence de nom n'est pas un critère d'exclusion (décision d'Ashraf, `Streets."Name"` est
nullable et le front gère déjà « rue sans nom »).

CE QUI EST ÉCARTÉ : `path`, `footway`, `steps`, `cycleway`, `pedestrian` — des cheminements
piétons, pas des rues adressables — ainsi que `construction` et `proposed`, qui n'existent pas
encore sur le terrain.

`way_id` EST CONSERVÉ, et c'est important : c'est lui qui donnera le `Code` de la rue
(`OSM-W123456`), donc le lien de retour vers OSM lors d'une mise à jour ultérieure. Un code
calculé (rang, hash de géométrie) se serait décalé au premier rafraîchissement.
"""

from __future__ import annotations

import json
import re
import sys
import unicodedata

EXCLUS = {"path", "footway", "steps", "cycleway", "pedestrian", "construction", "proposed"}

# Vocabulaire FERMÉ, aligné sur les filtres de `map-style.json` : toute autre valeur serait
# stockée en base sans jamais être dessinée.
TYPE_PAR_HIGHWAY = {
    "motorway": "Route", "motorway_link": "Route",
    "trunk": "Route", "trunk_link": "Route",
    "primary": "Route", "primary_link": "Route",
    "secondary": "Boulevard", "secondary_link": "Boulevard",
    "tertiary": "Boulevard", "tertiary_link": "Boulevard",
    "residential": "Rue", "unclassified": "Rue", "living_street": "Rue", "service": "Rue",
    "track": "Piste",
}

TYPE_PAR_PREFIXE = [
    (r"^(boulevard|bould|bvd|blvd|bld)\b", "Boulevard"),
    (r"^(avenue|av)\b", "Avenue"),
    (r"^(impasse|imp)\b", "Impasse"),
    (r"^(route|rte|rn\s*\d|nationale)\b", "Route"),
    (r"^(piste)\b", "Piste"),
    (r"^(rue)\b", "Rue"),
]


def sans_arabe(texte: str) -> str:
    """À Djibouti, `name` colle le français et l'arabe : « Avenue Ali Bahdon شارع علي بهدون »."""
    garde = "".join(c for c in texte if not ("؀" <= c <= "ۿ" or "ﭐ" <= c <= "﻿"))
    return re.sub(r"\s{2,}", " ", garde).strip(" -–—/")


def type_de(nom: str | None, highway: str) -> str:
    if nom:
        plat = "".join(
            c for c in unicodedata.normalize("NFD", nom) if unicodedata.category(c) != "Mn"
        ).lower()
        for motif, valeur in TYPE_PAR_PREFIXE:
            if re.match(motif, plat):
                return valeur
    return TYPE_PAR_HIGHWAY.get(highway, "Rue")


def main() -> None:
    if len(sys.argv) != 2:
        print("usage: reseau-osm-extraire.py <reponse-overpass.json>", file=sys.stderr)
        raise SystemExit(2)

    with open(sys.argv[1], encoding="utf-8") as flux:
        elements = json.load(flux)["elements"]

    features, ignores = [], {}
    for e in elements:
        if e.get("type") != "way" or len(e.get("geometry") or []) < 2:
            ignores["geometrie degeneree"] = ignores.get("geometrie degeneree", 0) + 1
            continue
        tags = e.get("tags", {})
        highway = tags.get("highway", "")
        if highway in EXCLUS:
            ignores[f"highway={highway}"] = ignores.get(f"highway={highway}", 0) + 1
            continue

        nom = tags.get("name:fr") or sans_arabe(tags.get("name", "")) or None
        features.append({
            "type": "Feature",
            "properties": {
                "way_id": e["id"],
                "nom": nom,
                "highway": highway,
                "type_street": type_de(nom, highway),
            },
            # 6 décimales ≈ 10 cm : au-delà, on gonfle le fichier (donc le script SQL qui
            # l'embarque) pour une précision qu'aucune carte n'affiche.
            "geometry": {
                "type": "LineString",
                "coordinates": [[round(p["lon"], 6), round(p["lat"], 6)] for p in e["geometry"]],
            },
        })

    print(json.dumps({"type": "FeatureCollection", "features": features},
                     ensure_ascii=False, separators=(",", ":")))

    nommees = sum(1 for f in features if f["properties"]["nom"])
    print(f"{len(features)} voies retenues — {nommees} nommées, {len(features) - nommees} sans nom",
          file=sys.stderr)
    for motif, n in sorted(ignores.items(), key=lambda kv: -kv[1]):
        print(f"  ignoré — {motif} : {n}", file=sys.stderr)


if __name__ == "__main__":
    main()
