import { Component, input } from '@angular/core';
import { MockBadgeComponent } from '../../ui/mock-badge/mock-badge.component';
import { FeatureKey } from '../../config/backend-readiness';

@Component({
  selector: 'das-page-header',
  standalone: true,
  imports: [MockBadgeComponent],
  templateUrl: './page-header.component.html',
  styleUrl: './page-header.component.scss',
})
export class PageHeaderComponent {
  readonly eyebrow = input<string>();
  readonly title = input.required<string>();
  /** Affiche le badge « Mock » si ce module n'a pas encore de backend câblé (cf. backend-readiness.ts). */
  readonly feature = input<FeatureKey>();
}
