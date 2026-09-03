#!/usr/bin/env python3
"""GeoJSON de frontière → l'INSERT SQL de `public.contour_national`.

Pourquoi cet outil plutôt qu'`ogr2ogr` : GDAL pèse plus d'un giga de dépendances pour importer
UN polygone, et il n'est pas installé sur le poste de dev. Ici, seule la bibliothèque standard
de Python est utilisée — la géométrie n'est ni reprojetée ni simplifiée, elle est recopiée
telle quelle dans un littéral que PostGIS sait lire (`ST_GeomFromGeoJSON`).

Pourquoi pas un copier-coller manuel dans pgAdmin : le contour d'un pays fait des dizaines de
milliers de coordonnées. Un collage tronqué produit une géométrie *plausible* — donc un contour
faux, qui se croit. Ici, le fichier est lu en entier ou l'outil s'arrête.

    python3 scripts/sig/contour-national-depuis-geojson.py dji.geojson > contour-insert.sql
    psql "$DB" -v ON_ERROR_STOP=1 -f contour-insert.sql

L'import géo reste hors du front (CLAUDE.md §9) : cet outil ne produit que du SQL, à appliquer
contre la base comme les autres scripts de `scripts/sig/`.
"""

from __future__ import annotations

import argparse
import json
import sys
from typing import Any

# Emprise de Djibouti, garde-fou contre le mauvais pays ou le fichier mondial non filtré —
# pas un filtre : une géométrie hors de cette boîte ne se verrait qu'à l'écran, tard.
#
# Élargie à l'est le 2026-09-02 : la boîte venait de `docker/martin/config.yaml` (43.5), qui
# borne les tuiles du référentiel — donc des données TERRESTRES. Or une frontière nationale
# inclut les EAUX TERRITORIALES : le tracé OSM va jusqu'à 43.658 dans le détroit de
# Bab-el-Mandeb, et l'avertissement se déclenchait sur une géométrie parfaitement correcte.
# Un garde-fou qui crie au loup finit ignoré.
EMPRISE_DJIBOUTI = (41.7, 10.9, 43.7, 12.8)


def charger_geometrie(doc: Any, filtre: str | None) -> dict:
    """Extrait LA géométrie, quel que soit l'emballage GeoJSON reçu.

    Les trois formes circulent selon la source : geoBoundaries livre une `FeatureCollection`
    d'un seul élément, un export SIG livre souvent une `Feature`, et certaines API livrent la
    géométrie nue. Les distinguer ici évite de demander à l'appelant de préparer son fichier.
    """
    type_doc = doc.get("type")

    if type_doc in ("Polygon", "MultiPolygon"):
        return doc

    if type_doc == "Feature":
        return doc["geometry"]

    if type_doc == "FeatureCollection":
        features = doc.get("features") or []
        if not features:
            sortir("La FeatureCollection est vide.")

        # Un fichier mondial (Natural Earth entier, par exemple) porte ~250 pays : sans filtre,
        # on importerait le premier venu. Le filtre cherche dans TOUTES les propriétés, les
        # noms de colonnes variant d'une source à l'autre (ADM0_A3, shapeGroup, ISO_A3…).
        if filtre:
            aiguille = filtre.casefold()
            retenues = [
                f for f in features
                if any(aiguille == str(v).casefold() for v in (f.get("properties") or {}).values())
            ]
            if not retenues:
                sortir(f"Aucune entité ne porte « {filtre} » dans ses propriétés.")
            if len(retenues) > 1:
                sortir(f"{len(retenues)} entités portent « {filtre} » — filtre trop large.")
            return retenues[0]["geometry"]

        if len(features) > 1:
            sortir(
                f"{len(features)} entités dans le fichier : préciser laquelle avec "
                f"--filtre DJI (ou --filtre Djibouti)."
            )
        return features[0]["geometry"]

    sortir(f"Type GeoJSON non géré : {type_doc!r}.")


def parcourir_coordonnees(noeud: Any):
    """Toutes les paires [lng, lat], quelle que soit la profondeur d'imbrication des anneaux."""
    if isinstance(noeud, (int, float)):
        return
    if noeud and isinstance(noeud[0], (int, float)):
        yield noeud[0], noeud[1]
        return
    for enfant in noeud:
        yield from parcourir_coordonnees(enfant)


def sortir(message: str) -> None:
    print(f"ERREUR : {message}", file=sys.stderr)
    raise SystemExit(1)


def main() -> None:
    parseur = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parseur.add_argument("fichier", help="GeoJSON contenant la frontière (Feature, FeatureCollection ou géométrie).")
    parseur.add_argument("--filtre", help="Valeur de propriété identifiant le pays dans un fichier multi-entités (ex. DJI).")
    parseur.add_argument("--nom", default="Djibouti", help="Colonne `nom` (défaut : Djibouti).")
    parseur.add_argument(
        "--source",
        required=True,
        help="Provenance du tracé, écrite telle quelle en base. Obligatoire : une frontière sans "
             "provenance est inexploitable six mois plus tard (ex. « geoBoundaries gbOpen ADM0 DJI, 2026-09 »).",
    )
    parseur.add_argument(
        "--remplacer",
        action="store_true",
        help="Vide la table avant l'insertion. Sans cette option, un second passage AJOUTE une "
             "ligne et la carte superpose deux contours.",
    )
    args = parseur.parse_args()

    with open(args.fichier, encoding="utf-8") as flux:
        doc = json.load(flux)

    geometrie = charger_geometrie(doc, args.filtre)
    type_geom = geometrie.get("type")
    if type_geom not in ("Polygon", "MultiPolygon"):
        sortir(f"Géométrie {type_geom!r} : seuls Polygon et MultiPolygon sont des contours.")

    points = list(parcourir_coordonnees(geometrie["coordinates"]))
    if len(points) < 4:
        sortir(f"{len(points)} points seulement — ce n'est pas un contour de pays.")

    lngs = [p[0] for p in points]
    lats = [p[1] for p in points]
    emprise = (min(lngs), min(lats), max(lngs), max(lats))

    # Contrôle affiché sur stderr, donc jamais mêlé au SQL redirigé vers le fichier.
    print(f"{type_geom}, {len(points)} points", file=sys.stderr)
    print(f"emprise : {emprise[0]:.3f} {emprise[1]:.3f} → {emprise[2]:.3f} {emprise[3]:.3f}", file=sys.stderr)

    xmin, ymin, xmax, ymax = EMPRISE_DJIBOUTI
    if not (xmin <= emprise[0] and emprise[2] <= xmax and ymin <= emprise[1] and emprise[3] <= ymax):
        print(
            f"AVERTISSEMENT : l'emprise déborde de Djibouti ({xmin} {ymin} → {xmax} {ymax}). "
            f"Mauvais pays, ou fichier mondial non filtré ? Le SQL est produit quand même.",
            file=sys.stderr,
        )

    # `separators` sans espaces : sur un contour détaillé, cela retire des dizaines de milliers
    # de caractères d'un littéral que personne ne relira de toute façon.
    geojson_compact = json.dumps(geometrie, separators=(",", ":"))
    if "$json$" in geojson_compact:  # jamais vu, mais le dollar-quoting casserait en silence
        sortir("Le GeoJSON contient le marqueur $json$ — impossible de le citer sans risque.")

    lignes = [
        "-- Généré par scripts/sig/contour-national-depuis-geojson.py — ne pas éditer à la main.",
        f"-- Source : {args.source}",
        f"-- Fichier : {args.fichier}",
        f"-- {type_geom}, {len(points)} points, emprise {emprise[0]:.3f} {emprise[1]:.3f} "
        f"→ {emprise[2]:.3f} {emprise[3]:.3f}",
        "",
        "BEGIN;",
        "",
    ]
    if args.remplacer:
        lignes += ["-- --remplacer : sinon un second passage superposerait deux contours.",
                   "DELETE FROM public.contour_national;", ""]
    lignes += [
        "INSERT INTO public.contour_national (nom, source, geom)",
        "SELECT",
        f"  {citer(args.nom)},",
        f"  {citer(args.source)},",
        "  -- ST_MakeValid : une frontière exportée s'auto-intersecte presque toujours d'un poil.",
        "  -- Une géométrie invalide ne fait PAS échouer l'INSERT — elle fait échouer le découpage",
        "  -- en tuiles côté Martin, donc une couche muette sans le moindre message.",
        "  ST_Multi(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($json$",
        geojson_compact,
        "  $json$), 4326)));",
        "",
        "COMMIT;",
        "",
        "-- Contrôle : une ligne, valide = true, emprise ≈ 41.7-43.5 E / 10.9-12.8 N.",
        "-- SELECT nom, source, ST_IsValid(geom) AS valide, ST_NPoints(geom) AS points,",
        "--        Box2D(geom) AS emprise FROM public.contour_national;",
    ]
    print("\n".join(lignes))


def citer(valeur: str) -> str:
    """Littéral SQL — l'apostrophe se double, comme dans « Côte d'Or »."""
    return "'" + valeur.replace("'", "''") + "'"


if __name__ == "__main__":
    main()
