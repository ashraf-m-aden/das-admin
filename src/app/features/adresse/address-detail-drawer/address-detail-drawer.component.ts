import { Component, computed, inject, signal } from '@angular/core';
import { AsyncPipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoModule } from '@jsverse/transloco';
import { AdresseFacade } from '../../../core/adresse/store/adresse.facade';
import { AuthFacade } from '../../../core/auth/store/auth.facade';
import { AddressDetail, UpdateAdressePayload } from '../../../core/adresse/models/adresse.models';
import { AddressWorkflowStage, UUID, UserRole } from '../../../core/models/das.models';
import { UnitType } from '../../../core/units/models/units.models';

type Tab = 'details' | 'linked';

const STAGE_COLOR: Record<AddressWorkflowStage, string> = {
  registered: '#6b7280', surveyed: '#d97706', verified: '#16a34a', approved: '#0d9488', published: '#7c3aed',
};

const CAN_EDIT_ROLES: UserRole[] = ['Admin', 'Gestionnaire'];

@Component({
  selector: 'das-address-detail-drawer',
  standalone: true,
  imports: [AsyncPipe, FormsModule, TranslocoModule, DecimalPipe],
  templateUrl: './address-detail-drawer.component.html',
  styleUrl: './address-detail-drawer.component.scss',
})
export class AddressDetailDrawerComponent {
  private facade = inject(AdresseFacade);
  private authFacade = inject(AuthFacade);

  protected readonly detail$ = this.facade.detail$;
  protected readonly isLoading$ = this.facade.isDetailLoading$;
  protected readonly isMutating$ = this.facade.isMutating$;
  protected readonly updateErrorMessageKey$ = this.facade.updateErrorMessageKey$;

  private readonly roles = toSignal(this.authFacade.roles$, { initialValue: [] as UserRole[] });
  protected readonly canEdit = computed(() => this.roles().some((r) => CAN_EDIT_ROLES.includes(r)));

  protected readonly tab = signal<Tab>('details');
  protected readonly editingNumero = signal(false);
  protected readonly editNumeroValue = signal<number | null>(null);

  setTab(t: Tab): void { this.tab.set(t); }
  close(): void { this.facade.closeDetail(); }

  startEditNumero(d: AddressDetail): void {
    this.editingNumero.set(true);
    this.editNumeroValue.set(d.numero);
  }
  cancelEditNumero(): void { this.editingNumero.set(false); }

  saveNumero(d: AddressDetail): void {
    const numero = this.editNumeroValue();
    if (numero === null || numero <= 0) return;
    // boundaryWkt renvoyé tel quel : PATCH exige un remplacement complet, et le reconstruire
    // depuis la tuile vectorielle produirait une géométrie simplifiée/tronquée aux bords.
    const payload: UpdateAdressePayload = { numero, boundaryWkt: d.boundaryWkt };
    this.facade.updateAdresse(d.id as UUID, payload);
    this.editingNumero.set(false);
  }

  stageColor(stage: AddressWorkflowStage): string { return STAGE_COLOR[stage]; }
  stageLabelKey(stage: AddressWorkflowStage): string { return `status.stage.${stage}`; }
  occupancyLabelKey(occ: string): string { return `adresse.occupancy.${occ}`; }

  private static readonly UNIT_TYPE_ICON: Record<UnitType, string> = {
    Apartment: 'ti ti-door', Shop: 'ti ti-building-store', Office: 'ti ti-briefcase',
  };
  unitTypeIcon(type: UnitType): string { return AddressDetailDrawerComponent.UNIT_TYPE_ICON[type]; }
  unitTypeLabelKey(type: UnitType): string { return `adresse.unitType.${type.toLowerCase()}`; }
}
