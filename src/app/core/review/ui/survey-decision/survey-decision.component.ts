import { Component, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { UUID } from '../../../models/das.models';
import { ValidationType } from '../../models/review.models';

/**
 * Les trois issues d'un relevé soumis : valider (provisoire ou définitif), rejeter, renvoyer
 * en correction.
 *
 * Extrait de la file de validation le 2026-08-31, au moment où le détail de campagne a eu
 * besoin des mêmes gestes. Les recopier là-bas aurait dupliqué **quatre règles** qui ne
 * peuvent pas diverger sans conséquence : le motif de rejet obligatoire (5 caractères, il part
 * tel quel à l'agent), la confirmation de la validation définitive (elle fige le `addressCode`),
 * l'ordre des issues, et le fait qu'aucune ne s'applique hors d'un relevé `Submitted`.
 *
 * Composant PRÉSENTATIONNEL : aucune facade, aucun store. Il émet des intentions ; l'écran hôte
 * décide quoi en faire et porte l'appel. C'est ce qui lui permet de servir deux écrans qui ne
 * rafraîchissent pas la même liste après la décision.
 */
@Component({
  selector: 'das-survey-decision',
  standalone: true,
  imports: [ReactiveFormsModule, TranslocoModule],
  templateUrl: './survey-decision.component.html',
  styleUrl: './survey-decision.component.scss',
})
export class SurveyDecisionComponent {
  private fb = inject(FormBuilder);

  readonly surveyId = input.required<UUID>();
  /** Décision en cours sur CE relevé : les boutons se verrouillent pour éviter le double envoi. */
  readonly deciding = input(false);
  /**
   * Relevé DÉJÀ validé provisoirement, qu'on rouvre pour trancher.
   *
   * Deux issues seulement ont un sens ici : **figer** en `Definitive`, ou **rejeter**.
   * Revalider en `Temporary` ne changerait rien (c'est l'état actuel), et le renvoi en
   * correction ramènerait en `Draft` un relevé déjà accepté et déjà livré — l'agent
   * corrigerait une saisie qui sert de référence en production.
   *
   * Les DEUX issues restantes gardent leurs règles intactes : motif de rejet obligatoire,
   * confirmation avant le gel du `addressCode`. C'est tout l'intérêt de passer par ce
   * composant plutôt que par un second jeu de boutons.
   */
  readonly provisional = input(false);

  readonly validate = output<ValidationType>();
  readonly reject = output<string>();
  readonly requestCorrection = output<void>();

  /**
   * Motif OBLIGATOIRE. Un rejet fait retomber l'adresse en `registered` (CLAUDE.md §5) et ce
   * motif est le SEUL message que l'agent recevra : rejeter sans rien dire, c'est renvoyer
   * quelqu'un sur le terrain sans lui dire quoi corriger. 5 caractères minimum — « non » ou
   * « ko » n'est pas un motif.
   */
  protected readonly rejectForm = this.fb.nonNullable.group({
    reason: ['', [Validators.required, Validators.minLength(5)]],
  });

  protected readonly rejecting = signal(false);
  /**
   * `Definitive` fige le `addressCode` et sort la parcelle des campagnes suivantes. Rien dans
   * la réponse `200` ne le dira après coup : le seul moment où l'on peut encore l'arrêter est
   * avant l'envoi.
   */
  protected readonly confirmingDefinitive = signal(false);

  startReject(): void {
    this.rejectForm.reset({ reason: '' });
    this.confirmingDefinitive.set(false);
    this.rejecting.set(true);
  }
  cancelReject(): void { this.rejecting.set(false); }
  confirmReject(): void {
    if (this.rejectForm.invalid) { this.rejectForm.markAllAsTouched(); return; }
    this.rejecting.set(false);
    this.reject.emit(this.rejectForm.getRawValue().reason.trim());
  }

  /** Provisoire : la parcelle devient livrable mais reste recontrôlable — rien d'irréversible, donc pas de confirmation. */
  validateTemporary(): void { this.validate.emit('Temporary'); }

  requestDefinitive(): void {
    this.rejecting.set(false);
    this.confirmingDefinitive.set(true);
  }
  cancelDefinitive(): void { this.confirmingDefinitive.set(false); }
  confirmDefinitive(): void {
    this.confirmingDefinitive.set(false);
    this.validate.emit('Definitive');
  }
}
