import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, shareReplay } from 'rxjs';
import type { StyleSpecification, VectorSourceSpecification } from 'maplibre-gl';
import { AppConfigService } from '../config/app-config.service';
import { AuthStorageService } from '../auth/services/auth-storage.service';

/** Sources tuiles scopables par client (multi-tenant). */
const TENANT_SCOPED_SOURCES = ['blocs', 'adresses'] as const;

@Injectable({ providedIn: 'root' })
export class MapStyleService {
  private http = inject(HttpClient);
  private config = inject(AppConfigService);
  private auth = inject(AuthStorageService);

  private style$?: Observable<StyleSpecification>;

  getStyle(): Observable<StyleSpecification> {
    if (!this.style$) {
      this.style$ = this.http
        .get<string>('assets/map-style.json', { responseType: 'text' as 'json' })
        .pipe(
          map((raw) => {
            const tilesBaseUrl = this.config.get('mapTileUrl') || '';
            const resolved = (raw as unknown as string).replaceAll('__TILES_BASE_URL__', tilesBaseUrl);
            const style = JSON.parse(resolved) as StyleSpecification;
            return this.signerTuiles(style);
          }),
          shareReplay(1),
        );
    }
    return this.style$;
  }

  /** Un cache par langue : changer de langue rejoue le style, pas la requête déjà faite. */
  private readonly commercial$ = new Map<string, Observable<StyleSpecification>>();

  /**
   * Le style de la CARTE PUBLIQUE — celui que D.A.S publie à ses consommateurs et que
   * `/carte` affiche. Rendu calqué sur Google Maps : fond clair, voirie blanche à liseré,
   * lieux en pastille, et le code postal en vedette (filigrane au dézoom, hachure des
   * quartiers sans code).
   *
   * ⚠️ **C'est le MÊME fichier que celui servi aux clients** (`assets/commercial-style.json`,
   * récupéré tel quel par La Poste). On ne maintient pas deux rendus : ce que voit un partenaire
   * est ce que nous voyons. Le marqueur `__TILES_BASE_URL__` est résolu par chaque client avec
   * SON service de tuiles — ici le nôtre, chez eux le relais de leur back-end.
   *
   * ⚠️ **Un fichier PAR LANGUE, et le français garde le nom nu.** Les seuls libellés
   * traduisibles du fond — sous-catégories de lieux, « code à venir » — sont écrits dans des
   * expressions `match` imbriquées, générées par `scripts/map/build_styles.py`. Les réécrire à
   * l'exécution supposerait de connaître leur forme exacte : un couplage silencieux qui casserait
   * à la première refonte du style. `commercial-style.json` est donc le français, et c'est un
   * CONTRAT EXTERNE (`docs/carte-vitrine.md`, la règle `/carto/` de `nginx.conf`) — ne pas le
   * renommer ; les autres langues vivent à côté en `commercial-style.<lang>.json`.
   */
  getCommercialStyle(lang = 'fr'): Observable<StyleSpecification> {
    const enCache = this.commercial$.get(lang);
    if (enCache) return enCache;

    const fichier = lang === 'fr' ? 'commercial-style.json' : `commercial-style.${lang}.json`;
    const flux = this.http
      .get<string>(`assets/${fichier}`, { responseType: 'text' as 'json' })
      .pipe(
        map((raw) => {
          // Le relais PUBLIC, a liste blanche et protege par cle — pas `mapTileUrl`, qui vise
          // le relais d'administration et refuserait une requete sans jeton de session.
          const tilesBaseUrl = String(this.config.get('mapPublicTileUrl') || '');
          const style = JSON.parse(
            (raw as unknown as string).replaceAll('__TILES_BASE_URL__', tilesBaseUrl),
          ) as StyleSpecification;
          return this.ajouterParametre(style, 'cle', String(this.config.get('mapPublicKey') ?? ''));
        }),
        shareReplay(1),
      );
    this.commercial$.set(lang, flux);
    return flux;
  }

  /**
   * Style dérivé pour un client commercial : chaque source scopable reçoit
   * un `client_id` que le backend/Martin utilise pour restreindre les tuiles.
   * Remplace l'ancien reroutage `das_ilots` (source supprimée).
   */
  getClientStyle(clientId: string): Observable<StyleSpecification> {
    return this.getStyle().pipe(
      map((style) => {
        const cloned = structuredClone(style);
        for (const name of TENANT_SCOPED_SOURCES) {
          const source = cloned.sources[name] as VectorSourceSpecification | undefined;
          if (source?.tiles) {
            source.tiles = source.tiles.map((tile) =>
              tile.includes('?')
                ? `${tile}&client_id=${encodeURIComponent(clientId)}`
                : `${tile}?client_id=${encodeURIComponent(clientId)}`,
            );
          }
        }
        return cloned;
      }),
    );
  }

  /**
   * Ajoute le jeton de session aux URL de tuiles du style d'administration.
   *
   * ⚠️ **Dans la QUERY STRING, et c'est la seule voie possible.** MapLibre construit lui-même ses
   * requêtes de tuiles : elles ne passent pas par `HttpClient`, donc l'intercepteur d'authen-
   * tification ne les voit jamais et aucun en-tête `Authorization` ne peut y être posé. Le back
   * ne lit `?jeton=` que sur `/api/tiles` — nulle part ailleurs.
   *
   * ⚠️ **Le style est mis en cache (`shareReplay`) avec le jeton du moment.** Après expiration,
   * les tuiles répondent 401 jusqu'au prochain chargement de l'application. C'est acceptable
   * tant que la session dure plus longtemps qu'une visite ; si ce n'est plus vrai, il faudra
   * réémettre le style au rafraîchissement du jeton plutôt que d'allonger la durée de vie.
   */
  private signerTuiles(style: StyleSpecification): StyleSpecification {
    return this.ajouterParametre(style, 'jeton', this.auth.load()?.accessToken ?? '');
  }

  /** Pose `?cle=` ou `?jeton=` sur chaque URL de tuile, sans écraser un paramètre existant. */
  private ajouterParametre(style: StyleSpecification, nom: string, valeur: string): StyleSpecification {
    if (!valeur) return style;

    for (const source of Object.values(style.sources)) {
      const vecteur = source as VectorSourceSpecification;
      if (!vecteur?.tiles) continue;
      vecteur.tiles = vecteur.tiles.map((url) =>
        url.includes(`${nom}=`)
          ? url
          : `${url}${url.includes('?') ? '&' : '?'}${nom}=${encodeURIComponent(valeur)}`,
      );
    }

    return style;
  }
}
