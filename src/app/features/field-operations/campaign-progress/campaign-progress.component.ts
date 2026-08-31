import { Component, input, output } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { CampaignProgress } from '../../../core/models/das.models';

/**
 * Panneau « Avancement » d'une campagne : chiffres d'affectation, chiffres de relevés, et
 * répartition par agent.
 *
 * Extrait de `campaign-detail` le 2026-08-28. Le motif est le même que pour `das-pager` : cet
 * écran cumulait cinq panneaux dans une seule feuille de style, qui butait sur le budget de
 * 8 ko par composant à chaque ajout de fonctionnalité. Rogner le CSS à chaque fois traitait le
 * symptôme ; sortir un panneau entier, avec son gabarit et son style, traite la cause.
 *
 * Présentationnel : il reçoit un `CampaignProgress` et n'émet qu'une intention de navigation.
 * La couleur d'agent est passée en entrée plutôt que recalculée ici, pour rester identique à
 * celle de la carte et du tableau des blocs — deux générateurs de couleur qui divergent, c'est
 * une légende fausse.
 *
 * Les quatre compteurs de relevés sont CLIQUABLES depuis le 2026-08-31 : ils annonçaient
 * « 2 brouillons » sans que rien ne permette de les ouvrir. Le panneau ne sait pas ce qu'on en
 * fait — il dit quel statut a été demandé, l'écran hôte décide.
 */
@Component({
  selector: 'das-campaign-progress',
  standalone: true,
  imports: [TranslocoModule],
  templateUrl: './campaign-progress.component.html',
  styleUrl: './campaign-progress.component.scss',
})
export class CampaignProgressComponent {
  readonly progress = input.required<CampaignProgress>();
  /** Résolveur de couleur fourni par l'écran hôte, pour partager sa palette d'agents. */
  readonly agentColor = input.required<(agentId: string) => string>();

  /**
   * Statut de relevé sur lequel l'opérateur veut voir le détail. Typé en clair plutôt
   * qu'importé du module review : ce panneau n'a aucune dépendance vers la file de validation.
   */
  readonly pickSurveyStatus = output<'Draft' | 'Submitted' | 'Validated' | 'Rejected'>();
}
