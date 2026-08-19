#!/usr/bin/env python3
"""
Renommage mecanique registry -> adresse (CLAUDE.md SS7).
Scope strict : src/ et public/assets/i18n/ uniquement. Jamais la racine du repo
(Docker/Jenkins/CI portent aussi le mot "registry"). Dry-run par defaut ; --apply pour executer.

Regle de graphie : tout ce qui contient deja "Registry"/"registry" devient "Adresse"/"adresse".
Les types Address* (modele calquant le payload, ex. AddressListItem, AddressDetail) ne bougent
PAS : ils ne contiennent pas "registry" et ne sont donc jamais touches par ce script.
"""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

CONTENT_GLOBS = ["src/**/*.ts", "src/**/*.html", "src/**/*.scss"]
I18N_FILES = ["public/assets/i18n/fr.json", "public/assets/i18n/en.json"]

# Identifiants composes -> remplacement exact (word-boundary), les plus specifiques
# n'ont pas besoin d'ordre particulier grace a \b, mais on les liste explicitement
# pour que le rapport de dry-run soit lisible poste par poste.
IDENTIFIER_MAP = [
    ("initialRegistryFilters", "initialAdresseFilters"),
    ("initialRegistryState", "initialAdresseState"),
    ("MockRegistryApiService", "MockAdresseApiService"),
    ("RegistryActions", "AdresseActions"),
    ("RegistryApiPort", "AdresseApiPort"),
    ("RegistryApiService", "AdresseApiService"),
    ("RegistryEffects", "AdresseEffects"),
    ("RegistryFacade", "AdresseFacade"),
    ("registryFeatureKey", "adresseFeatureKey"),
    ("registryFeature", "adresseFeature"),
    ("RegistryFilterOptions", "AdresseFilterOptions"),
    ("RegistryFilters", "AdresseFilters"),
    ("RegistryListComponent", "AdresseListComponent"),
    ("RegistryMapComponent", "AdresseMapComponent"),
    ("RegistryPageResult", "AdressePageResult"),
    ("RegistryQuery", "AdresseQuery"),
    ("registryReducer", "adresseReducer"),
    ("registryRoutes", "adresseRoutes"),
    ("RegistryState", "AdresseState"),
    ("RegistrySummary", "AdresseSummary"),
]

# Catch-all final : tout "Registry"/"registry" isole restant (routes, selecteurs CSS,
# fragments de nom de fichier references en texte, cles i18n, commentaires).
BARE_MAP = [
    ("Registry", "Adresse"),
    ("registry", "adresse"),
]

# Renommages physiques (repertoires puis fichiers, dans cet ordre).
DIR_RENAMES = [
    ("src/app/core/registry", "src/app/core/adresse"),
    ("src/app/features/registry", "src/app/features/adresse"),
]

# Chemins exprimes relatifs a leur nouveau parent (apres DIR_RENAMES ci-dessus).
FILE_RENAMES = [
    ("src/app/core/adresse/models/registry.models.ts", "src/app/core/adresse/models/adresse.models.ts"),
    ("src/app/core/adresse/services/mock-registry-api.service.ts", "src/app/core/adresse/services/mock-adresse-api.service.ts"),
    ("src/app/core/adresse/services/registry-api.port.ts", "src/app/core/adresse/services/adresse-api.port.ts"),
    ("src/app/core/adresse/services/registry-api.service.ts", "src/app/core/adresse/services/adresse-api.service.ts"),
    ("src/app/core/adresse/store/registry.actions.ts", "src/app/core/adresse/store/adresse.actions.ts"),
    ("src/app/core/adresse/store/registry.effects.ts", "src/app/core/adresse/store/adresse.effects.ts"),
    ("src/app/core/adresse/store/registry.facade.ts", "src/app/core/adresse/store/adresse.facade.ts"),
    ("src/app/core/adresse/store/registry.reducer.ts", "src/app/core/adresse/store/adresse.reducer.ts"),
    ("src/app/core/adresse/store/registry.selectors.ts", "src/app/core/adresse/store/adresse.selectors.ts"),
    ("src/app/core/adresse/store/registry.state.ts", "src/app/core/adresse/store/adresse.state.ts"),
    ("src/app/features/adresse/registry.routes.ts", "src/app/features/adresse/adresse.routes.ts"),
    ("src/app/features/adresse/registry-list", "src/app/features/adresse/adresse-list"),
    ("src/app/features/adresse/registry-map", "src/app/features/adresse/adresse-map"),
]

# A l'interieur des repertoires renommes ci-dessus, fichiers dont le NOM contient aussi "registry".
FILE_RENAMES_POST = [
    ("src/app/features/adresse/adresse-list/registry-list.component.ts", "src/app/features/adresse/adresse-list/adresse-list.component.ts"),
    ("src/app/features/adresse/adresse-list/registry-list.component.html", "src/app/features/adresse/adresse-list/adresse-list.component.html"),
    ("src/app/features/adresse/adresse-list/registry-list.component.scss", "src/app/features/adresse/adresse-list/adresse-list.component.scss"),
    ("src/app/features/adresse/adresse-map/registry-map-component.ts", "src/app/features/adresse/adresse-map/adresse-map-component.ts"),
    ("src/app/features/adresse/adresse-map/registry-map-component.html", "src/app/features/adresse/adresse-map/adresse-map-component.html"),
    ("src/app/features/adresse/adresse-map/registry-map-component.scss", "src/app/features/adresse/adresse-map/adresse-map-component.scss"),
    ("src/app/features/adresse/adresse-map/registry-map-component.spec.ts", "src/app/features/adresse/adresse-map/adresse-map-component.spec.ts"),
]


def content_files():
    files = []
    for pattern in CONTENT_GLOBS:
        files.extend(ROOT.glob(pattern))
    files.extend(ROOT / f for f in I18N_FILES)
    return sorted(set(files))


def compute_replacements(text):
    changes = []
    for old, new in IDENTIFIER_MAP + BARE_MAP:
        pattern = re.compile(r"\b" + re.escape(old) + r"\b")
        count = len(pattern.findall(text))
        if count:
            changes.append((old, new, count))
            text = pattern.sub(new, text)
    return text, changes


def dry_run():
    print("=== DRY RUN : renommage registry -> adresse ===\n")
    print("-- Repertoires --")
    for src, dst in DIR_RENAMES:
        exists = (ROOT / src).exists()
        print(f"  {'[OK]' if exists else '[MANQUANT]'} {src} -> {dst}")

    print("\n-- Fichiers (apres deplacement des repertoires) --")
    for src, dst in FILE_RENAMES + FILE_RENAMES_POST:
        print(f"  {src} -> {dst}")

    print("\n-- Contenu (occurrences par fichier) --")
    total = 0
    for f in content_files():
        if not f.exists():
            continue
        text = f.read_text(encoding="utf-8")
        _, changes = compute_replacements(text)
        if changes:
            rel = f.relative_to(ROOT)
            print(f"  {rel}")
            for old, new, count in changes:
                print(f"      {old} -> {new}  ({count}x)")
                total += count
    print(f"\nTotal occurrences a remplacer : {total}")
    print("\nRelancer avec --apply pour executer.")


def apply():
    print("=== APPLY : renommage registry -> adresse ===\n")

    # 1) Contenu d'abord (pendant que les chemins actuels sont encore valides).
    for f in content_files():
        if not f.exists():
            continue
        text = f.read_text(encoding="utf-8")
        new_text, changes = compute_replacements(text)
        if changes:
            f.write_text(new_text, encoding="utf-8")
            print(f"  contenu modifie : {f.relative_to(ROOT)}")

    # 2) git mv des repertoires puis des fichiers.
    for src, dst in DIR_RENAMES:
        s, d = ROOT / src, ROOT / dst
        if s.exists():
            subprocess.run(["git", "mv", str(s), str(d)], check=True, cwd=ROOT)
            print(f"  git mv {src} -> {dst}")

    for src, dst in FILE_RENAMES + FILE_RENAMES_POST:
        s, d = ROOT / src, ROOT / dst
        if s.exists():
            subprocess.run(["git", "mv", str(s), str(d)], check=True, cwd=ROOT)
            print(f"  git mv {src} -> {dst}")

    print("\nTermine. Lancer `ng build` pour verifier.")


if __name__ == "__main__":
    if "--apply" in sys.argv:
        apply()
    else:
        dry_run()
