import { Component, computed, input, output } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';

/**
 * Pagination réutilisable : taille de page, plage affichée, navigation.
 *
 * Extraite le 2026-08-28 du motif `.pager` de l'écran adresses, au moment d'en avoir besoin
 * sur un deuxième écran. La recopier aurait coûté deux fois : une divergence de comportement à
 * terme, et surtout ~600 octets de CSS dans la feuille de l'écran campagne, déjà au ras du
 * budget de 8 ko. Ici le style est porté par le composant, donc compté une seule fois.
 *
 * Le composant ne sait RIEN de la source des données : il reçoit des nombres et émet des
 * intentions. Il sert aussi bien une pagination serveur qu'une pagination front.
 *
 * `adresse-list` porte encore sa propre copie — sa migration est mécanique mais touche un
 * écran qui marche, elle est laissée à un lot séparé.
 */
@Component({
  selector: 'das-pager',
  standalone: true,
  imports: [TranslocoModule],
  templateUrl: './das-pager.component.html',
  styleUrl: './das-pager.component.scss',
})
export class DasPagerComponent {
  readonly page = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly total = input.required<number>();
  readonly pageSizes = input<number[]>([10, 25, 50]);

  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();

  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.total() / Math.max(1, this.pageSize()))));

  /** Bornes affichées. `from` vaut 0 sur une liste vide : « 0 à 0 sur 0 » se lit mieux que « 1 à 0 ». */
  protected readonly from = computed(() =>
    this.total() === 0 ? 0 : (this.page() - 1) * this.pageSize() + 1);
  protected readonly to = computed(() =>
    Math.min(this.page() * this.pageSize(), this.total()));

  /**
   * Fenêtre de 5 numéros centrée sur la page courante, recalée aux bords.
   * Sans recalage, la première et la dernière page n'offrent que trois boutons.
   */
  protected readonly pages = computed(() => {
    const total = this.pageCount();
    const debut = Math.max(1, Math.min(this.page() - 2, total - 4));
    return Array.from({ length: Math.min(5, total) }, (_, i) => debut + i);
  });

  goTo(page: number): void {
    const borne = Math.min(Math.max(1, page), this.pageCount());
    if (borne !== this.page()) this.pageChange.emit(borne);
  }

  changeSize(value: string): void {
    const size = Number(value);
    if (Number.isFinite(size) && size > 0) this.pageSizeChange.emit(size);
  }
}
