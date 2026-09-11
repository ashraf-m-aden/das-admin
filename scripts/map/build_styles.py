"""Génère les styles de carte à partir de la palette partagée.

    python scripts/map/build_styles.py

Écrit UN STYLE PAR LANGUE dans `src/assets/` et `public/assets/`. Le placeholder
`__TILES_BASE_URL__` est résolu à l'exécution par le composant avec
`config.mapTileUrl`.

Pourquoi un fichier par langue plutôt qu'un seul style corrigé à l'exécution :
les seuls libellés traduisibles du fond sont les sous-catégories de POI, écrites
dans une expression `match` imbriquée. La réécrire côté client à chaque
changement de langue supposerait de connaître sa forme exacte — un couplage
silencieux qui casserait à la première refonte du style. Trois fichiers statiques
se mettent en cache, se servent tels quels et se relisent.

⚠️ `commercial-style.json` (sans suffixe) est le FRANÇAIS, et c'est un contrat
externe : `docs/carte-vitrine.md` et la règle CORS de `nginx.conf` l'exposent
sous ce nom aux tiers — La Poste de Djibouti le récupère directement. Ne jamais
le renommer ; les autres langues s'ajoutent à côté en `commercial-style.<lang>.json`.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from basemap_layers import (  # noqa: E402
    CODE_A_VENIR,
    SOUS_CATEGORIE,
    ground,
    labels,
    roads,
    sources,
)
from palette import GLYPHS  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
DOSSIERS = ("src/assets", "public/assets")
LANGUES = ("fr", "en", "ar")


def commercial_style(lang: str) -> dict:
    return {
        "version": 8,
        "name": f"DAS Djibouti — fond vitrine ({lang})",
        "metadata": {
            "das:generated-by": "scripts/map/build_styles.py",
            "das:usage": "carte publique / commerciale, sans couche de travail",
            "das:lang": lang,
        },
        "glyphs": GLYPHS,
        "center": [43.145, 11.588],
        "zoom": 12,
        "bearing": 0,
        "pitch": 0,
        "sources": sources(),
        "layers": ground() + roads() + labels(with_poi=True, lang=lang),
    }


def nom_fichier(lang: str) -> str:
    """Le français garde le nom nu : c'est celui que les tiers consomment."""
    return "commercial-style.json" if lang == "fr" else f"commercial-style.{lang}.json"


def main() -> None:
    manquants = {
        lang: set(SOUS_CATEGORIE["fr"]) ^ set(SOUS_CATEGORIE[lang]) for lang in LANGUES
    }
    for lang, ecart in manquants.items():
        if ecart:
            raise SystemExit(f"sous-catégories désynchronisées en {lang} : {sorted(ecart)}")

    # Même discipline que l'i18n du front : une langue qui manque ici ferait
    # tomber la génération, pas afficher un français isolé sur une carte arabe.
    sans_traduction = [lang for lang in LANGUES if lang not in CODE_A_VENIR]
    if sans_traduction:
        raise SystemExit(f"« code à venir » non traduit en : {sans_traduction}")

    for lang in LANGUES:
        style = commercial_style(lang)
        payload = json.dumps(style, indent=2, ensure_ascii=False) + "\n"
        for dossier in DOSSIERS:
            cible = ROOT / dossier / nom_fichier(lang)
            cible.write_text(payload, encoding="utf-8")
        print(
            f"{lang}: {nom_fichier(lang)} — {len(payload)} octets, "
            f"{len(style['layers'])} couches, {len(style['sources'])} sources"
        )


if __name__ == "__main__":
    main()
