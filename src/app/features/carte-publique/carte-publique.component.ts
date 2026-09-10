import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, NgZone,
  OnDestroy, OnInit, computed, inject, signal, viewChild,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslocoModule } from '@jsverse/transloco';
import * as maplibregl from 'maplibre-gl';
import { MapStyleService } from '../../core/map/map-style.service';
import { enregistrerIconesPoi } from '../../core/ui/map/poi-icones';

/** Ce que le panneau montre. Vient TOUJOURS de la tuile cliquée — aucun appel d'API. */
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
      const carte = new maplibregl.Map({
        container: this.conteneur().nativeElement,
        style,
        center: [43.145, 11.588],
        zoom: 12,
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
      });
    });
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
   * Recherche dans ce qui est RENDU à l'écran, sans appel réseau.
   *
   * ⚠️ C'est une limite assumée et il faut la connaître : `querySourceFeatures` ne voit que les
   * tuiles chargées, donc l'emprise visible et son voisinage immédiat. Chercher « Ambouli » depuis
   * une vue centrée sur Balbala ne rend rien. Une recherche sur tout le référentiel demanderait un
   * index côté serveur — c'est le chantier suivant, pas un défaut de celui-ci.
   */
  protected chercher(): void {
    const carte = this.carte;
    const terme = this.recherche().trim().toLowerCase();
    if (!carte || terme.length < 2) {
      this.resultats.set([]);
      return;
    }

    const trouves: LieuSelectionne[] = [];
    const vues = new Set<string>();

    for (const [source, sourceLayer, couche] of [
      ['poi', 'poi_sites_tiles', 'poi-point'],
      ['quartiers', 'quartiers_tiles', 'quartier-fond'],
      ['streets', 'streets_tiles', 'rue'],
    ] as const) {
      for (const f of carte.querySourceFeatures(source, { sourceLayer })) {
        const nom = String(f.properties?.['Nom'] ?? f.properties?.['Name'] ?? '');
        if (!nom || !nom.toLowerCase().includes(terme) || vues.has(nom)) continue;
        vues.add(nom);

        const centre = this.centreDe(f);
        if (!centre) continue;
        trouves.push(couche === 'rue'
          ? { genre: 'quartier', titre: nom, sousTitre: String(f.properties?.['Type'] ?? ''), lignes: [], lngLat: centre }
          : this.decrire({ ...f, layer: { id: couche } } as unknown as maplibregl.MapGeoJSONFeature, centre));
        if (trouves.length >= 8) break;
      }
      if (trouves.length >= 8) break;
    }

    this.resultats.set(trouves);
  }

  /** Un point représentatif de l'entité, quel que soit son type de géométrie. */
  private centreDe(f: GeoJSON.Feature): [number, number] | null {
    const g = f.geometry;
    if (g.type === 'Point') return g.coordinates as [number, number];
    const plat: number[][] = [];
    const parcourir = (c: unknown): void => {
      if (Array.isArray(c) && typeof c[0] === 'number') plat.push(c as number[]);
      else if (Array.isArray(c)) c.forEach(parcourir);
    };
    parcourir((g as { coordinates: unknown }).coordinates);
    if (plat.length === 0) return null;
    const somme = plat.reduce((a, c) => [a[0] + c[0], a[1] + c[1]], [0, 0]);
    return [somme[0] / plat.length, somme[1] / plat.length];
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
