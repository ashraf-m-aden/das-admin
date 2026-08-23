import { Component, computed, input } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { BACKEND_READINESS, FeatureKey } from '../../config/backend-readiness';

/** Pastille « Mock » posée sur un écran dont le backend n'est pas câblé. Ne rend rien si `feature` est câblé ou absent. */
@Component({
  selector: 'das-mock-badge',
  standalone: true,
  imports: [TranslocoModule],
  templateUrl: './mock-badge.component.html',
  styleUrl: './mock-badge.component.scss',
})
export class MockBadgeComponent {
  readonly feature = input<FeatureKey>();

  protected readonly visible = computed(() => {
    const f = this.feature();
    return !!f && BACKEND_READINESS[f].status === 'mock';
  });

  protected readonly hintKey = computed(() => {
    const f = this.feature();
    return (f && BACKEND_READINESS[f].noteKey) || 'common.mockBadgeHint';
  });
}
