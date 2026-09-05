import { Component, computed, inject, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoModule } from '@jsverse/transloco';
import { CloseGenerationFacade } from '../../../core/closes/store/close-generation.facade';
import { UUID } from '../../../core/models/das.models';

/**
 * Plan de numérotation d'une close proposée : l'ordre des maisons le long de la voie.
 *
 * **C'est l'écran qui coûte le plus cher à se tromper.** Le numéro finit figé dans un code
 * d'adresse qui n'est jamais réécrit ; l'ordre proposé, lui, est déduit de la géométrie, donc
 * faillible. D'où la relecture, et d'où le bouton d'inversion : le sens de parcours brut est
 * arbitraire, et un plan qui commence par le mauvais bout se corrige d'un clic plutôt qu'en
 * retapant cinquante numéros.
 *
 * `orderingSource` est affiché tel quel : `StreetLine` veut dire que l'ordre suit le tracé réel
 * de la rue, `ParcelCloud` qu'il est estimé sur le nuage des parcelles. La confiance à accorder
 * au plan n'est pas la même, et l'écran ne doit pas laisser croire qu'elle l'est.
 */
@Component({
  selector: 'das-close-numbering-panel',
  standalone: true,
  imports: [DecimalPipe, FormsModule, TranslocoModule],
  templateUrl: './close-numbering-panel.component.html',
  styleUrl: './close-numbering-panel.component.scss',
})
export class CloseNumberingPanelComponent {
  private facade = inject(CloseGenerationFacade);

  readonly proposalKey = input.required<string>();

  protected readonly plan = toSignal(this.facade.numbering$, { initialValue: null });
  protected readonly issues = toSignal(this.facade.numberingIssues$, { initialValue: [] as number[] });
  protected readonly isLoading = toSignal(this.facade.isNumbering$, { initialValue: false });
  protected readonly reverse = toSignal(this.facade.numberingReverse$, { initialValue: false });
  protected readonly reviewedKeys = toSignal(this.facade.reviewedKeys$, { initialValue: [] as string[] });

  protected readonly isReviewed = computed(() => this.reviewedKeys().includes(this.proposalKey()));

  /** Un plan qui porte des doublons serait refusé à l'écriture : on le dit avant, pas après. */
  protected readonly canMarkReviewed = computed(() => !!this.plan() && this.issues().length === 0);

  protected toggleDirection(): void {
    this.facade.openNumbering(this.proposalKey(), !this.reverse());
  }

  protected onNumeroChange(adresseId: UUID, value: string): void {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0) {
      this.facade.editPlannedNumero(adresseId, parsed);
    }
  }

  protected markReviewed(): void {
    this.facade.markReviewed(this.proposalKey());
  }
}
