import { Component, OnInit, inject, output } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { HierarchyFacade } from '../../store/hierarchy.facade';
import { HierarchySelection } from '../../models/hierarchy.models';

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

  readonly selectionChange = output<HierarchySelection>();

  protected readonly cities = this.hierarchy.cities;
  protected readonly communes = this.hierarchy.communes;
  protected readonly zones = this.hierarchy.zones;
  protected readonly quartiers = this.hierarchy.quartiers;
  protected readonly closes = this.hierarchy.closes;
  protected readonly selection = this.hierarchy.selection;

  ngOnInit(): void { this.hierarchy.loadRoot(); }

  onCity(id: string): void { this.hierarchy.selectCity(id || null); this.emit(); }
  onCommune(id: string): void { this.hierarchy.selectCommune(id || null); this.emit(); }
  onZone(id: string): void { this.hierarchy.selectZone(id || null); this.emit(); }
  onQuartier(id: string): void { this.hierarchy.selectQuartier(id || null); this.emit(); }
  onClose(id: string): void { this.hierarchy.selectClose(id || null); this.emit(); }

  private emit(): void { this.selectionChange.emit(this.hierarchy.selection()); }
}
