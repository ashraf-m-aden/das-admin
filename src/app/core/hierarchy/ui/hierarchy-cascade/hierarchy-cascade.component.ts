import { Component, OnInit, inject } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { HierarchyFacade } from '../../store/hierarchy.facade';
import { BlocksFacade } from '../../../blocks/store/blocks.facade';

/**
 * Cascade City→Commune→Zone→Quartier. Pilote la HierarchyFacade (chargement des
 * enfants) et propage la sélection dans BlocksFacade.setFilters → la tuile se
 * filtre côté carte et la liste se recharge côté store. Réutilisable hors Blocs.
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
  private blocks = inject(BlocksFacade);

  protected readonly cities = this.hierarchy.cities;
  protected readonly communes = this.hierarchy.communes;
  protected readonly zones = this.hierarchy.zones;
  protected readonly quartiers = this.hierarchy.quartiers;
  protected readonly selection = this.hierarchy.selection;

  ngOnInit(): void { this.hierarchy.loadRoot(); }

  onCity(id: string): void { this.hierarchy.selectCity(id || null); this.sync(); }
  onCommune(id: string): void { this.hierarchy.selectCommune(id || null); this.sync(); }
  onZone(id: string): void { this.hierarchy.selectZone(id || null); this.sync(); }
  onQuartier(id: string): void { this.hierarchy.selectQuartier(id || null); this.sync(); }

  private sync(): void { this.blocks.setFilters(this.hierarchy.selection()); }
}
