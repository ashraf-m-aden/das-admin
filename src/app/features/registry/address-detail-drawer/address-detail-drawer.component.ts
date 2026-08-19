import { Component, inject, signal } from '@angular/core';
import { AsyncPipe, DecimalPipe } from '@angular/common';
import { TranslocoModule } from '@jsverse/transloco';
import { RegistryFacade } from '../../../core/registry/store/registry.facade';
import { AddressWorkflowStage } from '../../../core/models/das.models';

type Tab = 'details' | 'linked';

const STAGE_COLOR: Record<AddressWorkflowStage, string> = {
  registered: '#6b7280', surveyed: '#d97706', verified: '#16a34a', approved: '#0d9488', published: '#7c3aed',
};

@Component({
  selector: 'das-address-detail-drawer',
  standalone: true,
  imports: [AsyncPipe, TranslocoModule, DecimalPipe],
  templateUrl: './address-detail-drawer.component.html',
  styleUrl: './address-detail-drawer.component.scss',
})
export class AddressDetailDrawerComponent {
  private facade = inject(RegistryFacade);

  protected readonly detail$ = this.facade.detail$;
  protected readonly isLoading$ = this.facade.isDetailLoading$;

  protected readonly tab = signal<Tab>('details');

  setTab(t: Tab): void { this.tab.set(t); }
  close(): void { this.facade.closeDetail(); }

  stageColor(stage: AddressWorkflowStage): string { return STAGE_COLOR[stage]; }
  stageLabelKey(stage: AddressWorkflowStage): string { return `status.stage.${stage}`; }
  occupancyLabelKey(occ: string): string { return `registry.occupancy.${occ}`; }
}
