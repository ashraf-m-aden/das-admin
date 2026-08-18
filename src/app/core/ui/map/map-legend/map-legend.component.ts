import { Component, input } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { AddressWorkflowStage } from '../../../models/das.models';

export interface LegendEntry {
  stage: AddressWorkflowStage;
  color: string;
}

@Component({
  selector: 'das-map-legend',
  standalone: true,
  imports: [TranslocoModule],
  templateUrl: './map-legend.component.html',
  styleUrl: './map-legend.component.scss',
})
export class MapLegendComponent {
  /** Entrées (étape + couleur) fournies par le parent depuis sa palette. */
  readonly entries = input.required<LegendEntry[]>();

  /** Titre optionnel de la légende (clé Transloco). */
  readonly titleKey = input<string>('map.legend.title');

  stageLabelKey(stage: AddressWorkflowStage): string { return `status.stage.${stage}`; }
}
