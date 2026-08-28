import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { HierarchyFacade } from '../../store/hierarchy.facade';
import { HierarchySelection } from '../../models/hierarchy.models';
import { UUID } from '../../../models/das.models';

/**
 * Cascade City→Commune→Zone→Quartier→Close. Découplée du module hôte : elle pilote la
 * HierarchyFacade et ÉMET la sélection ; l'hôte la route vers sa propre facade (Blocs,
 * Adresse…).
 *
 * **Le niveau bloc a été retiré le 2026-08-25.** Un bloc est le découpage de TRAVAIL (une unité
 * d'affectation de campagne), pas un niveau d'adressage : depuis que le code d'adresse est passé
 * à quatre segments, c'est la close qui nomme l'adresse, et filtrer par bloc n'apprenait plus
 * rien que la close ne dise mieux. L'entrée `showBloc` et le champ `blocId` ont été supprimés
 * plutôt que masqués — un champ mort dans un modèle de filtre finit toujours par être réactivé
 * « puisqu'il est déjà là ».
 *
 * L'écran des closes continue d'afficher des blocs : ce sont ses DONNÉES, pas un filtre.
 */
@Component({
  selector: 'das-hierarchy-cascade',
  standalone: true,
  imports: [TranslocoModule],
  templateUrl: './hierarchy-cascade.component.html',
  styleUrl: './hierarchy-cascade.component.scss',
})
export class HierarchyCascadeComponent implements OnInit {
  private hierarchy = inject(HierarchyFacade);

  /**
   * Affiche un multi-select de zones à côté du select Zone. Il ne FILTRE pas : il désigne les
   * zones à mettre en évidence sur la carte. Opt-in — c'est un besoin de l'écran cartographie,
   * pas de tous les consommateurs de la cascade.
   */
  readonly showZoneHighlight = input<boolean>(false);

  readonly selectionChange = output<HierarchySelection>();
  /** Zones à mettre en évidence. Indépendant de `selectionChange` : surligner n'est pas filtrer. */
  readonly zoneHighlightChange = output<UUID[]>();

  protected readonly cities = this.hierarchy.cities;
  protected readonly communes = this.hierarchy.communes;
  protected readonly zones = this.hierarchy.zones;
  protected readonly quartiers = this.hierarchy.quartiers;
  protected readonly closes = this.hierarchy.closes;
  protected readonly selection = this.hierarchy.selection;

  ngOnInit(): void { this.hierarchy.loadRoot(); }

  onCity(id: string): void { this.hierarchy.selectCity(id || null); this.emit(); }
  onCommune(id: string): void { this.hierarchy.selectCommune(id || null); this.emit(); }
  /** Panneau des zones. Fermé par défaut : ouvert, il pousserait les niveaux suivants hors de vue. */
  protected readonly zonesOpen = signal(false);
  toggleZonesPanel(): void { this.zonesOpen.update((o) => !o); }

  isZoneSelected(id: UUID): boolean { return this.selection().zoneIds.includes(id); }

  onToggleZone(id: UUID): void { this.hierarchy.toggleZone(id); this.emit(); }
  clearZones(): void { this.hierarchy.clearZones(); this.emit(); }

  /**
   * Libellé du bouton : « toutes », le nom quand il n'y en a qu'une, le compte au-delà.
   * Afficher les noms concaténés ferait déborder un contrôle qui doit rester de la taille
   * des autres selects de la cascade.
   */
  protected readonly zoneButtonLabel = computed(() => {
    const n = this.selection().zoneIds.length;
    if (n === 0) return 'hierarchy.allZones';
    if (n === 1) return 'hierarchy.oneZone';
    return 'hierarchy.someZones';
  });
  onQuartier(id: string): void { this.hierarchy.selectQuartier(id || null); this.emit(); }
  onClose(id: string): void { this.hierarchy.selectClose(id || null); this.emit(); }

  protected readonly highlightedZones = signal<UUID[]>([]);

  isZoneHighlighted(id: UUID): boolean { return this.highlightedZones().includes(id); }

  toggleZoneHighlight(id: UUID): void {
    this.highlightedZones.update((ids) => ids.includes(id) ? ids.filter((z) => z !== id) : [...ids, id]);
    this.zoneHighlightChange.emit(this.highlightedZones());
  }

  clearZoneHighlight(): void {
    this.highlightedZones.set([]);
    this.zoneHighlightChange.emit([]);
  }

  private emit(): void { this.selectionChange.emit(this.hierarchy.selection()); }
}
