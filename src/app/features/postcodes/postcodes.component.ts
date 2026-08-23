import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoModule } from '@jsverse/transloco';
import { PostcodesFacade } from '../../core/postcodes/store/postcodes.facade';
import { PageHeaderComponent } from '../../core/layout/page-header/page-header.component';
import { AuthFacade } from '../../core/auth/store/auth.facade';
import { UUID, UserRole } from '../../core/models/das.models';
import { CityPostcodeRow, QuartierPostcodeRow } from '../../core/postcodes/models/postcodes.models';

const CAN_EDIT_ROLES: UserRole[] = ['Admin', 'Gestionnaire'];

@Component({
  selector: 'das-postcodes',
  standalone: true,
  imports: [DecimalPipe, FormsModule, TranslocoModule, PageHeaderComponent],
  templateUrl: './postcodes.component.html',
  styleUrl: './postcodes.component.scss',
})
export class PostcodesComponent implements OnInit {
  protected facade = inject(PostcodesFacade);
  private authFacade = inject(AuthFacade);

  private readonly roles = toSignal(this.authFacade.roles$, { initialValue: [] as UserRole[] });
  protected readonly canEdit = computed(() => this.roles().some((r) => CAN_EDIT_ROLES.includes(r)));

  protected readonly filterCityId = signal<UUID | null>(null);
  protected readonly onlyMissing = signal(false);

  protected readonly filteredQuartiers = computed(() =>
    this.facade.quartiers().filter((q) => (!this.filterCityId() || q.cityId === this.filterCityId()) && (!this.onlyMissing() || q.postcode === null)),
  );

  protected readonly editingQuartierId = signal<UUID | null>(null);
  protected readonly editAreaNumber = signal<number | null>(null);

  protected readonly editingCityId = signal<UUID | null>(null);
  protected readonly editCityCode = signal<number | null>(null);
  protected readonly confirmingCityId = signal<UUID | null>(null);

  ngOnInit(): void { this.facade.load(); }

  setCityFilter(id: string): void { this.filterCityId.set(id || null); }
  toggleOnlyMissing(): void { this.onlyMissing.update((v) => !v); }

  startEditArea(row: QuartierPostcodeRow): void {
    this.editingQuartierId.set(row.id);
    this.editAreaNumber.set(row.areaNumber);
  }
  cancelEditArea(): void { this.editingQuartierId.set(null); }
  saveEditArea(row: QuartierPostcodeRow): void {
    const value = this.editAreaNumber();
    if (value === null || value < 1 || value > 999) return;
    this.facade.updateAreaNumber(row, value);
    this.editingQuartierId.set(null);
  }

  startEditCity(row: CityPostcodeRow): void {
    this.editingCityId.set(row.id);
    this.editCityCode.set(row.code);
    this.confirmingCityId.set(null);
  }
  cancelEditCity(): void { this.editingCityId.set(null); this.confirmingCityId.set(null); }
  requestSaveCity(row: CityPostcodeRow): void {
    const value = this.editCityCode();
    if (value === null || value < 1 || value > 99) return;
    // Changer le code d'une ville recalcule le code postal de tous ses quartiers : on ne l'applique
    // qu'après une confirmation explicite plutôt que de laisser découvrir l'effet après coup.
    this.confirmingCityId.set(row.id);
  }
  confirmSaveCity(row: CityPostcodeRow): void {
    const value = this.editCityCode();
    if (value === null) return;
    this.facade.updateCityCode(row, value);
    this.editingCityId.set(null);
    this.confirmingCityId.set(null);
  }

  quartierCountForCity(cityId: UUID): number {
    return this.facade.quartiers().filter((q) => q.cityId === cityId).length;
  }
}
