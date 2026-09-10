import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, NgZone,
  OnDestroy, OnInit, computed, inject, signal, viewChild,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
import { TranslocoModule } from '@jsverse/transloco';
import * as maplibregl from 'maplibre-gl';
import { MapStyleService } from '../../core/map/map-style.service';
import { AppConfigService } from '../../core/config/app-config.service';
import { enregistrerIconesPoi } from '../../core/ui/map/poi-icones';

/** Ce que renvoie `GET /api/public/search`. */
interface ResultatApi {
  cle: string;
  genre: string;
  libelle: string;
  complement: string | null;
  longitude: number;
  latitude: number;
}

/** Ce que le panneau montre : une entité cliquée sur la tuile, ou un résultat de recherche. */
export interface LieuSelectionne {
  genre: 'adresse' | 'lieu' | 'quartier';
  titre: string;
  sousTitre?: string;
  lignes: { libelle: string; valeur: string }[];
  lngLat: [number, number];
}

/**
 * La CARTE PUBLIQUE du référentiel — `/carte`, hors du shell et sans authentification.
 *
 * <b>Pourquoi un composant à part et non `das-map`.</b> `das-map` sert l'administration : panneau
 * de couches, liaisons de tuiles, feature-state pilotés depuis le store, recadrage sur des
 * sélections métier. Rien de cela n'a de sens ici, où l'on veut le comportement d'un grand public
 * — chercher, cliquer, lire. Les deux partagent ce qui compte vraiment : le service de style et
 * les icônes de lieux.
 *
 * <b>Aucune donnée ne transite par l'API.</b> Tout ce que le panneau affiche est lu dans les
 * attributs de la tuile vectorielle déjà chargée. C'est ce qui permet à l'écran de rester public :
 * il n'y a rien à autoriser, la tuile est la seule source.
 */
@Component({
  selector: 'das-carte-publique',
  standalone: true,
  imports: [DecimalPipe, FormsModule, TranslocoModule],
  templateUrl: './carte-publique.component.html',
  styleUrl: './carte-publique.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartePubliqueComponent implements OnInit, OnDestroy {
  private readonly conteneur = viewChild.required<ElementRef<HTMLDivElement>>('conteneur');
  private readonly mapStyle = inject(MapStyleService);
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);
  private readonly frappe = new Subject<string>();
  private readonly route = inject(ActivatedRoute);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly enErreur = signal(false);
  protected readonly selection = signal<LieuSelectionne | null>(null);
  protected readonly recherche = signal('');
  protected readonly resultats = signal<LieuSelectionne[]>([]);
  protected readonly panneauOuvert = computed(() => this.selection() !== null);

  /** Le quartier sous le curseur : son code postal s'affiche en médaillon flottant. */
  protected readonly quartierSurvole = signal<{ nom: string; postcode: string | null } | null>(null);

  private carte?: maplibregl.Map;
  private repere?: maplibregl.Marker;

  /**
   * ⚠️ Le feature-state du survol doit être RETIRÉ explicitement du précédent. MapLibre ne le fait
   * pas tout seul : sans cela chaque quartier traversé reste allumé et toute la ville finit
   * surlignée.
   */
  private survolId: string | number | null = null;

  ngOnInit(): void {
    this.brancherRecherche();
    this.mapStyle.getCommercialStyle()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (style) => this.demarrer(style),
        error: () => this.enErreur.set(true),
      });
  }

  ngOnDestroy(): void {
    this.carte?.remove();
  }

  private demarrer(style: maplibregl.StyleSpecification): void {
    // Hors de la zone Angular : MapLibre émet des dizaines d'événements par seconde au survol et
    // au déplacement, chacun déclencherait un cycle de détection pour rien.
    this.zone.runOutsideAngular(() => {
      const vue = this.vueDemandee();

      const carte = new maplibregl.Map({
        container: this.conteneur().nativeElement,
        style,
        center: vue.centre ?? [43.145, 11.588],
        zoom: vue.zoom ?? 12,
        attributionControl: false,
        maxBounds: [[41.0, 10.4], [44.2, 13.3]],
      });
      this.carte = carte;

      carte.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
      carte.addControl(new maplibregl.AttributionControl({
        compact: true,
        customAttribution: 'Référentiel D.A.S — Djibouti · OpenStreetMap (ODbL)',
      }), 'bottom-right');

      carte.on('error', () => this.zone.run(() => this.enErreur.set(true)));
      carte.once('load', () => {
        void enregistrerIconesPoi(carte);
        this.brancherInteractions(carte);
        if (vue.repere) {
          this.zone.run(() => this.selectionner(vue.repere!));
        }
      });
    });
  }

  /**
   * Cadrage demandé par l'URL — `?lat=&lng=&z=&marker=&label=`.
   *
   * <b>C'est le contrat d'ouverture depuis un consommateur externe.</b> La Plateforme 1 de La
   * Poste construit exactement ces paramètres dans `openInDasViewer()` pour ouvrir la carte
   * centrée sur une agence. Les noms et la forme de `marker` — « longitude,latitude » — viennent
   * de là et ne doivent pas changer sans prévenir l'autre dépôt.
   *
   * Tout est facultatif et validé : un paramètre absent ou illisible rend simplement le cadrage
   * par défaut, jamais une carte vide. Une URL bricolée à la main ne doit pas casser l'écran.
   */
  private vueDemandee(): {
    centre: [number, number] | null;
    zoom: number | null;
    repere: LieuSelectionne | null;
  } {
    const p = this.route.snapshot.queryParamMap;

    const nombre = (v: string | null): number | null => {
      if (v === null) return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const lat = nombre(p.get('lat'));
    const lng = nombre(p.get('lng'));
    const centre: [number, number] | null =
      lat !== null && lng !== null ? [lng, lat] : null;

    // `marker` vaut « longitude,latitude » — l'ordre de MapLibre, pas celui de lat/lng.
    let repereCoord: [number, number] | null = null;
    const marker = p.get('marker');
    if (marker) {
      const [mx, my] = marker.split(',').map((v) => Number(v));
      if (Number.isFinite(mx) && Number.isFinite(my)) {
        repereCoord = [mx, my];
      }
    }
    repereCoord ??= centre;

    const label = p.get('label');
    const repere: LieuSelectionne | null = repereCoord
      ? {
          genre: 'lieu',
          titre: label?.trim() || 'carte.lieuSansNom',
          sousTitre: undefined,
          lignes: [],
          lngLat: repereCoord,
        }
      : null;

    // Le zoom est borné à ce que le style couvre : au-delà de 19 les tuiles n'existent plus et
    // la carte se vide, ce qui se lit comme une panne.
    const z = nombre(p.get('z'));
    const zoom = z === null ? null : Math.min(Math.max(z, 5), 19);

    return { centre, zoom, repere };
  }

  private brancherInteractions(carte: maplibregl.Map): void {
    // ── Survol des quartiers : surbrillance + médaillon du code postal ───────────────────────
    carte.on('mousemove', 'quartier-fond', (e: maplibregl.MapLayerMouseEvent) => {
      const f = e.features?.[0];
      if (!f) return;
      carte.getCanvas().style.cursor = 'pointer';

      if (this.survolId !== null && this.survolId !== f.id) {
        carte.setFeatureState(
          { source: 'quartiers', sourceLayer: 'quartiers_tiles', id: this.survolId },
          { survol: false },
        );
      }
      this.survolId = f.id ?? null;
      if (this.survolId !== null) {
        carte.setFeatureState(
          { source: 'quartiers', sourceLayer: 'quartiers_tiles', id: this.survolId },
          { survol: true },
        );
      }

      this.zone.run(() => this.quartierSurvole.set({
        nom: String(f.properties?.['Nom'] ?? ''),
        postcode: (f.properties?.['Postcode'] as string) ?? null,
      }));
    });

    carte.on('mouseleave', 'quartier-fond', () => {
      carte.getCanvas().style.cursor = '';
      if (this.survolId !== null) {
        carte.setFeatureState(
          { source: 'quartiers', sourceLayer: 'quartiers_tiles', id: this.survolId },
          { survol: false },
        );
        this.survolId = null;
      }
      this.zone.run(() => this.quartierSurvole.set(null));
    });

    // ── Clic : le lieu l'emporte sur la parcelle, la parcelle sur le quartier ────────────────
    // L'ordre suit ce que l'usager vise : il clique une pastille pour un lieu, un bâtiment pour
    // une adresse, et le vide pour savoir dans quel quartier il se trouve.
    carte.on('click', (e: maplibregl.MapMouseEvent) => {
      const touche = carte.queryRenderedFeatures(e.point, {
        layers: ['poi-point', 'bati', 'quartier-fond'],
      });
      const lieu = touche.find((f: maplibregl.MapGeoJSONFeature) => f.layer.id === 'poi-point')
        ?? touche.find((f: maplibregl.MapGeoJSONFeature) => f.layer.id === 'bati')
        ?? touche.find((f: maplibregl.MapGeoJSONFeature) => f.layer.id === 'quartier-fond');
      if (!lieu) return;
      this.zone.run(() => this.selectionner(this.decrire(lieu, [e.lngLat.lng, e.lngLat.lat])));
    });

    carte.on('mouseenter', 'poi-point', () => (carte.getCanvas().style.cursor = 'pointer'));
  }

  /** Traduit une entité de tuile en fiche lisible. Les attributs viennent des vues `*_tiles`. */
  private decrire(f: maplibregl.MapGeoJSONFeature, lngLat: [number, number]): LieuSelectionne {
    const p = f.properties ?? {};

    if (f.layer.id === 'poi-point') {
      const batiments = Number(p['Batiments'] ?? 1);
      return {
        genre: 'lieu',
        titre: (p['Nom'] as string) || 'carte.lieuSansNom',
        sousTitre: (p['SousCategorie'] as string) || (p['Categorie'] as string),
        lignes: batiments > 1 ? [{ libelle: 'carte.batiments', valeur: String(batiments) }] : [],
        lngLat,
      };
    }

    if (f.layer.id === 'bati') {
      const lignes = [
        { libelle: 'carte.numero', valeur: String(p['Numero'] ?? '—') },
        { libelle: 'carte.etape', valeur: String(p['workflowStage'] ?? '—') },
      ];
      if (p['PoiNom']) lignes.unshift({ libelle: 'carte.occupe', valeur: String(p['PoiNom']) });
      return {
        genre: 'adresse',
        titre: `${p['Numero'] ?? '—'}`,
        sousTitre: (p['PoiCategorie'] as string) ?? undefined,
        lignes,
        lngLat,
      };
    }

    return {
      genre: 'quartier',
      titre: String(p['Nom'] ?? ''),
      sousTitre: (p['CommuneName'] as string) ?? (p['CityName'] as string),
      lignes: [
        { libelle: 'carte.postcode', valeur: String(p['Postcode'] ?? '—') },
        { libelle: 'carte.ville', valeur: String(p['CityName'] ?? '—') },
      ],
      lngLat,
    };
  }

  private selectionner(lieu: LieuSelectionne): void {
    this.selection.set(lieu);
    this.resultats.set([]);
    this.repere?.remove();
    if (this.carte) {
      this.repere = new maplibregl.Marker({ color: '#1a73e8' })
        .setLngLat(lieu.lngLat)
        .addTo(this.carte);
    }
  }

  /**
   * Recherche sur TOUT le référentiel, servie par `GET /api/public/search`.
   *
   * ⚠️ La version précédente cherchait dans les tuiles rendues (`querySourceFeatures`) : elle ne
   * voyait que l'emprise visible, et chercher « Ambouli » depuis Balbala ne rendait rien. L'index
   * serveur (`public.recherche_index`) couvre villes, quartiers, rues nommées, lieux remarquables
   * et parcelles identifiées.
   *
   * `debounceTime` : la recherche part à chaque frappe. Sans lui, taper « boulevard » lance neuf
   * requêtes dont huit sont périmées avant d'arriver. `switchMap` annule la précédente, ce qui
   * évite aussi qu'une réponse lente écrase une réponse récente.
   */
  private brancherRecherche(): void {
    this.frappe
      .pipe(
        debounceTime(220),
        distinctUntilChanged(),
        switchMap((terme) =>
          this.http.get<ResultatApi[]>(`${this.config.get('apiBaseUrl')}/public/search`, {
            params: { q: terme, limite: 8 },
          }),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (resultats) => this.resultats.set(resultats.map((r) => this.depuisApi(r))),
        // Une recherche qui échoue vide la liste sans alerter : l'écran reste utilisable à la
        // souris, et une bannière d'erreur à chaque frappe serait pire que le silence.
        error: () => this.resultats.set([]),
      });
  }

  protected chercher(): void {
    const terme = this.recherche().trim();
    if (terme.length < 2) {
      this.resultats.set([]);
      return;
    }
    this.frappe.next(terme);
  }

  private depuisApi(r: ResultatApi): LieuSelectionne {
    return {
      genre: r.genre === 'adresse' ? 'adresse' : r.genre === 'lieu' ? 'lieu' : 'quartier',
      titre: r.libelle,
      sousTitre: r.complement ?? undefined,
      lignes: [],
      lngLat: [r.longitude, r.latitude],
    };
  }

  protected allerVers(lieu: LieuSelectionne): void {
    this.carte?.flyTo({ center: lieu.lngLat, zoom: 17, duration: 800 });
    this.selectionner(lieu);
  }

  protected fermer(): void {
    this.selection.set(null);
    this.repere?.remove();
    this.repere = undefined;
  }
}
