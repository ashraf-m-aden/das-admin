import { Component, OnInit, inject, input, output } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { HierarchyFacade } from '../../store/hierarchy.facade';
import { HierarchySelection } from '../../models/hierarchy.models';

/**
 * Cascade City→Commune→Zone→Quartier(→Bloc). Découplée du module hôte : elle
 * pilote la HierarchyFacade et ÉMET la sélection ; l'hôte la route vers son
 * propre facade (Blocs, Adresse…). `showBloc` active le 5e niveau.
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

  readonly showBloc = input<boolean>(false);
  readonly selectionChange = output<HierarchySelection>();

  protected readonly cities = this.hierarchy.cities;
  protected readonly communes = this.hierarchy.communes;
  protected readonly zones = this.hierarchy.zones;
  protected readonly quartiers = this.hierarchy.quartiers;
  protected readonly blocs = this.hierarchy.blocs;
  protected readonly selection = this.hierarchy.selection;

  ngOnInit(): void { this.hierarchy.loadRoot(); }

  onCity(id: string): void { this.hierarchy.selectCity(id || null); this.emit(); }
  onCommune(id: string): void { this.hierarchy.selectCommune(id || null); this.emit(); }
  onZone(id: string): void { this.hierarchy.selectZone(id || null); this.emit(); }
  onQuartier(id: string): void { this.hierarchy.selectQuartier(id || null); this.emit(); }
  onBloc(id: string): void { this.hierarchy.selectBloc(id || null); this.emit(); }

  private emit(): void { this.selectionChange.emit(this.hierarchy.selection()); }
}
