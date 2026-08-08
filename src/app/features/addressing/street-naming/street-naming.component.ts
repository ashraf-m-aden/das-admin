import { Component, OnInit, inject, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { AddressingFacade } from '../../../core/addressing/store/addressing.facade';
import { DasDatePipe } from '../../../core/i18n/das-locale.pipes';
import { StreetToName, StreetType } from '../../../core/addressing/models/addressing.models';

type NameForm = FormGroup<{ name: FormControl<string> }>;
type RejectForm = FormGroup<{ reason: FormControl<string> }>;

/** Enum fixe côté backend (Streets.Type) — pas une table pilotable. */
const STREET_TYPES: StreetType[] = ['Rue', 'Avenue', 'Boulevard', 'Piste', 'Impasse', 'Route'];

@Component({
  selector: 'das-street-naming',
  standalone: true,
  imports: [AsyncPipe, ReactiveFormsModule, TranslocoModule, DasDatePipe],
  templateUrl: './street-naming.component.html',
  styleUrl: './street-naming.component.scss',
})
export class StreetNamingComponent implements OnInit {
  private fb = inject(FormBuilder);
  private facade = inject(AddressingFacade);

  protected readonly streets$ = this.facade.streets$;
  protected readonly isLoading$ = this.facade.isStreetsLoading$;
  protected readonly errorMessageKey$ = this.facade.streetActionErrorMessageKey$;
  protected readonly streetTypes = STREET_TYPES;

  protected readonly filterForm = this.fb.nonNullable.group({ search: [''], onlyUnnamed: [true] });

  protected readonly nameForms = new Map<string, NameForm>();
  protected readonly rejectForms = new Map<string, RejectForm>();
  protected readonly openRejectId = signal<string | null>(null);

  ngOnInit(): void {
    this.facade.loadStreetsToName();
    this.filterForm.valueChanges.subscribe((v) =>
      this.facade.setStreetFilters({ search: v.search ?? '', onlyUnnamed: v.onlyUnnamed ?? true }),
    );
    this.facade.streets$.subscribe((streets) => {
      this.nameForms.clear();
      this.rejectForms.clear();
      for (const s of streets) {
        this.nameForms.set(s.id, this.fb.nonNullable.group({ name: ['', [Validators.required]] }));
        this.rejectForms.set(s.id, this.fb.nonNullable.group({ reason: ['', [Validators.required]] }));
      }
    });
  }

  nameFormFor(id: string): NameForm { return this.nameForms.get(id)!; }
  rejectFormFor(id: string): RejectForm { return this.rejectForms.get(id)!; }
  isSaving$(id: string) { return this.facade.isSavingStreet$(id); }

  submitDirectName(street: StreetToName): void {
    const form = this.nameFormFor(street.id);
    if (form.invalid) { form.markAllAsTouched(); return; }
    this.facade.setStreetName(street.id, form.getRawValue().name);
  }

  approve(street: StreetToName): void {
    if (!street.pendingSuggestion) return;
    this.facade.approveStreetSuggestion(street.id, street.pendingSuggestion.id);
  }

  openReject(id: string): void { this.openRejectId.set(id); }
  closeReject(): void { this.openRejectId.set(null); }

  confirmReject(street: StreetToName): void {
    if (!street.pendingSuggestion) return;
    const form = this.rejectFormFor(street.id);
    if (form.invalid) { form.markAllAsTouched(); return; }
    this.facade.rejectStreetSuggestion(street.id, street.pendingSuggestion.id, form.getRawValue().reason);
    this.openRejectId.set(null);
  }
}
