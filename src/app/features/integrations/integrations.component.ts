import { Component, OnInit, inject } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { IntegrationsFacade } from '../../core/integrations/store/integrations.facade';
import { PageHeaderComponent } from '../../core/layout/page-header/page-header.component';
import { DasDatePipe } from '../../core/i18n/das-locale.pipes';
import { IntegrationStatus } from '../../core/integrations/models/integrations.models';

const STATUS: Record<IntegrationStatus, { color: string; bg: string }> = {
  connected: { color: '#15803d', bg: '#dcfce7' },
  disconnected: { color: '#6b7280', bg: '#eef1f6' },
  error: { color: '#b91c1c', bg: '#fee2e2' },
};

@Component({
  selector: 'das-integrations',
  standalone: true,
  imports: [TranslocoModule, DasDatePipe, PageHeaderComponent],
  templateUrl: './integrations.component.html',
  styleUrl: './integrations.component.scss',
})
export class IntegrationsComponent implements OnInit {
  protected facade = inject(IntegrationsFacade);

  ngOnInit(): void { this.facade.load(); }

  status(s: IntegrationStatus) { return STATUS[s]; }
  statusLabelKey(s: IntegrationStatus): string { return `integrations.status.${s}`; }
  toggle(id: string, current: IntegrationStatus): void { this.facade.toggle(id, current !== 'connected'); }
}
