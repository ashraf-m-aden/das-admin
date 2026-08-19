import { Component, OnInit, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { AddressingFacade } from '../../../core/addressing/store/addressing.facade';
import { StreetToName, StreetType } from '../../../core/addressing/models/addressing.models';

type NameForm = FormGroup<{ name: FormControl<string> }>;

/** Enum fixe côté backend (Streets.Type) — pas une table pilotable. */
const STREET_TYPES: StreetType[] = ['Rue', 'Avenue', 'Boulevard', 'Piste', 'Impasse', 'Route'];

/**
 * Nommage direct par un admin — les rues avec une suggestion terrain en attente n'apparaissent
 * pas ici, elles se traitent dans la file de validation unifiée (`/verification`).
 */
@Component({
  selector: 'das-street-naming',
  standalone: true,
  imports: [AsyncPipe, ReactiveFormsModule, TranslocoModule],
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

  ngOnInit(): void {
    this.facade.loadStreetsToName();
    this.filterForm.valueChanges.subscribe((v) =>
      this.facade.setStreetFilters({ search: v.search ?? '', onlyUnnamed: v.onlyUnnamed ?? true }),
    );
    this.facade.streets$.subscribe((streets) => {
      this.nameForms.clear();
      for (const s of streets) {
        this.nameForms.set(s.id, this.fb.nonNullable.group({ name: ['', [Validators.required]] }));
      }
    });
  }

  nameFormFor(id: string): NameForm { return this.nameForms.get(id)!; }
  isSaving$(id: string) { return this.facade.isSavingStreet$(id); }

  submitDirectName(street: StreetToName): void {
    const form = this.nameFormFor(street.id);
    if (form.invalid) { form.markAllAsTouched(); return; }
    this.facade.setStreetName(street.id, {
      code: street.code, name: form.getRawValue().name, type: street.type, boundaryWkt: street.boundaryWkt,
    });
  }
}
