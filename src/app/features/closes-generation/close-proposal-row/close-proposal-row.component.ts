import { Component, inject, input, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { CloseGenerationFacade } from '../../../core/closes/store/close-generation.facade';
import { CloseStreetOption, ProposedClose } from '../../../core/closes/models/closes.models';
import { UUID } from '../../../core/models/das.models';

/**
 * Une proposition de close, relisible et modifiable : rue, numéro, code, blocs.
 *
 * N'injecte pas `Store` — tout passe par `CloseGenerationFacade` (CLAUDE.md §3.3).
 *
 * L'ordre des informations suit celui de la relecture : d'abord ce qui nomme la close (la rue),
 * puis ce qu'elle contient (les blocs), puis ce qui cloche (les avertissements). Les compteurs
 * d'adresses sont à droite parce qu'ils ne se lisent qu'en cas de doute.
 */
@Component({
  selector: 'das-close-proposal-row',
  standalone: true,
  imports: [DecimalPipe, FormsModule, TranslocoModule],
  templateUrl: './close-proposal-row.component.html',
  styleUrl: './close-proposal-row.component.scss',
})
export class CloseProposalRowComponent {
  private facade = inject(CloseGenerationFacade);

  readonly proposal = input.required<ProposedClose>();
  readonly streets = input<CloseStreetOption[]>([]);
  readonly reviewed = input<boolean>(false);
  readonly selected = input<boolean>(false);
  readonly numberingOpen = input<boolean>(false);

  readonly select = output<void>();

  /** Formulaire de renommage de rue, ouvert à la demande — 941 rues sur 1 344 n'ont pas de nom. */
  protected readonly renaming = signal(false);
  protected readonly newStreetName = signal('');
  protected readonly expanded = signal(false);

  protected onStreetChange(streetId: UUID): void {
    this.facade.changeStreet(this.proposal().key, streetId);
  }

  protected onNumberChange(value: string): void {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0) {
      this.facade.changeNumber(this.proposal().key, parsed);
    }
  }

  protected onCodeChange(code: string): void {
    this.facade.changeCode(this.proposal().key, code.trim());
  }

  protected removeBloc(blocId: UUID): void {
    this.facade.removeBloc(this.proposal().key, blocId);
  }

  protected discard(): void { this.facade.discard(this.proposal().key); }

  protected openNumbering(): void { this.facade.openNumbering(this.proposal().key, false); }
  protected closeNumbering(): void { this.facade.closeNumbering(); }

  protected startRename(): void {
    this.renaming.set(true);
    this.newStreetName.set(this.proposal().streetName ?? '');
  }

  protected confirmRename(): void {
    const name = this.newStreetName().trim();
    const street = this.streets().find((s) => s.id === this.proposal().streetId);
    if (name && street) {
      this.facade.renameStreet(street, name);
    }
    this.renaming.set(false);
  }

  protected cancelRename(): void { this.renaming.set(false); }
}
