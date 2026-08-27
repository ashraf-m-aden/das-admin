import { Component, computed, inject, signal } from '@angular/core';
import { AsyncPipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoModule } from '@jsverse/transloco';
import { AdresseFacade } from '../../../core/adresse/store/adresse.facade';
import { AuthFacade } from '../../../core/auth/store/auth.facade';
import { AddressDetail, UpdateAdressePayload } from '../../../core/adresse/models/adresse.models';
import { AddressWorkflowStage, UUID, UserRole } from '../../../core/models/das.models';
import { DasDatePipe } from '../../../core/i18n/das-locale.pipes';
import { UnitType } from '../../../core/units/models/units.models';
import { AdresseSurvey, ReviewPhoto, SurveyStatus } from '../../../core/review/models/review.models';

type Tab = 'details' | 'photos' | 'linked';

/** Couleur du statut d'un relevé. Distincte de STAGE_COLOR : un relevé n'est pas une étape d'adresse. */
const SURVEY_STATUS_COLOR: Record<SurveyStatus, string> = {
  Draft: '#6b7280', Submitted: '#d97706', Validated: '#16a34a', Rejected: '#dc2626',
};

const STAGE_COLOR: Record<AddressWorkflowStage, string> = {
  registered: '#6b7280', surveyed: '#d97706', verified: '#16a34a', approved: '#0d9488', published: '#7c3aed',
};

const CAN_EDIT_ROLES: UserRole[] = ['Admin', 'Gestionnaire'];

@Component({
  selector: 'das-address-detail-drawer',
  standalone: true,
  imports: [AsyncPipe, FormsModule, TranslocoModule, DecimalPipe, DasDatePipe],
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

  /**
   * Photo ouverte en grand. Les `readUrl` sont signées et expirent : on affiche celle que le
   * chargement de la fiche vient de rapporter, on n'en garde aucune trace.
   */
  protected readonly lightbox = signal<ReviewPhoto | null>(null);

  openPhoto(p: ReviewPhoto): void { this.lightbox.set(p); }
  closePhoto(): void { this.lightbox.set(null); }

  surveyStatusColor(s: SurveyStatus): string { return SURVEY_STATUS_COLOR[s]; }
  surveyStatusKey(s: SurveyStatus): string { return `adresse.surveyStatus.${s.toLowerCase()}`; }

  /** Total de photos réellement rapportées, pour la pastille de l'onglet. */
  photoTotal(surveys: AdresseSurvey[]): number {
    return surveys.reduce((n, s) => n + s.photos.length, 0);
  }

  /**
   * `photoCount` vient du relevé, `photos.length` de l'appel dédié. Un écart n'est pas anodin :
   * il signale des URLs signées que le back n'a pas pu produire, ou un 403 partiel — pas une
   * absence de photo.
   */
  photosMissing(s: AdresseSurvey): number { return Math.max(0, s.photoCount - s.photos.length); }
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
