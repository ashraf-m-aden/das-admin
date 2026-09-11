"""Aligne le FOND de `map-style.json` (admin) sur le rendu Google du style vitrine.

Ne touche qu'aux couches de fond : arrière-plan, terre/mer, voirie. Les couches
métier (zones, blocs, closes, adresses, SIG, contour national) et surtout leurs
IDENTIFIANTS restent intacts : `basemap-groups.ts` les référence un par un, et
un id renommé transforme une case à cocher en bouton inerte, sans erreur.

    python scripts/map/patch_admin_style.py
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from palette import C, TILES  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
TARGETS = ["src/assets/map-style.json", "public/assets/map-style.json"]


def line(stops):
    return ["interpolate", ["exponential", 1.5], ["zoom"], *stops]


def override(color):
    """Conserve la priorité au `feature-state.colorOverride` de l'admin."""
    return ["case", ["!=", ["feature-state", "colorOverride"], None], ["feature-state", "colorOverride"], color]


PAINTS = {
    "streets-track": {"line-color": C["track_case"], "line-dasharray": [2.5, 2],
                      "line-width": line([13, 0.8, 15, 1.6, 17, 3, 19, 6])},
    "streets-minor-case": {"line-color": C["road_case_soft"],
                           "line-width": line([13, 1.4, 15, 4, 17, 10, 19, 22, 20, 30])},
    "streets-minor-fill": {"line-color": override(C["road_fill"]),
                           "line-width": line([13, 0.5, 15, 2.4, 17, 7, 19, 17, 20, 24])},
    "streets-major-case": {"line-color": C["road_case"],
                           "line-width": line([12, 3, 14, 6, 16, 12, 18, 22, 20, 42])},
    "streets-major-fill": {"line-color": override(C["road_fill"]),
                           "line-width": line([12, 1.6, 14, 3.8, 16, 9, 18, 17, 20, 34])},
}

GROUND = [
    {"id": "land", "type": "fill", "source": "contourNational", "source-layer": "contour_national",
     "paint": {"fill-color": C["land"]}},
    {"id": "coastline", "type": "line", "source": "contourNational", "source-layer": "contour_national",
     "paint": {"line-color": C["coast"], "line-width": 0.8, "line-opacity": 0.7}},
]


def patch(style: dict) -> dict:
    # 1. l'arrière-plan devient la mer, la terre est peinte par-dessus
    for layer in style["layers"]:
        if layer["id"] == "bg":
            layer["paint"]["background-color"] = C["water"]

    # 2. terre + trait de côte insérés juste après le fond, si absents
    existing = {layer["id"] for layer in style["layers"]}
    ground = [dict(layer) for layer in GROUND if layer["id"] not in existing]
    if ground:
        index = next(i for i, layer in enumerate(style["layers"]) if layer["id"] == "bg") + 1
        style["layers"][index:index] = ground

    # 3. palette de voirie
    for layer in style["layers"]:
        if layer["id"] in PAINTS:
            layer["paint"].update(PAINTS[layer["id"]])

    # 4. la source du contour doit couvrir les faibles zooms (fond de pays)
    source = style["sources"].get("contourNational")
    if source:
        source["minzoom"] = 0
        source.setdefault("maxzoom", 12)
    return style


def main() -> None:
    for rel in TARGETS:
        path = ROOT / rel
        raw = path.read_text(encoding="utf-8")
        style = json.loads(raw)
        before = len(style["layers"])
        style = patch(style)
        path.write_text(json.dumps(style, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"{rel}: {before} -> {len(style['layers'])} couches")


if __name__ == "__main__":
    main()
