import { Component, OnInit, inject, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { AddressingFacade } from '../../../core/addressing/store/addressing.facade';
import { PropertyToNumber } from '../../../core/addressing/models/addressing.models';

type NumeroForm = FormGroup<{ numero: FormControl<string> }>;

@Component({
  selector: 'das-property-numbering',
  standalone: true,
  imports: [AsyncPipe, ReactiveFormsModule, TranslocoModule],
  templateUrl: './property-numbering.component.html',
  styleUrl: './property-numbering.component.scss',
})
export class PropertyNumberingComponent implements OnInit {
  private fb = inject(FormBuilder);
  private facade = inject(AddressingFacade);

  protected readonly properties$ = this.facade.properties$;
  protected readonly isLoading$ = this.facade.isPropertiesLoading$;
  protected readonly errorMessageKey$ = this.facade.propertySaveErrorMessageKey$;

  protected readonly forms = new Map<string, NumeroForm>();

  /** id de la parcelle dont le panneau détails (hiérarchie) est ouvert. */
  protected readonly expandedId = signal<string | null>(null);
  /** id de la parcelle en cours d'ajustement du numéro. */
  protected readonly editingId = signal<string | null>(null);

  ngOnInit(): void {
    this.facade.loadPropertiesToNumber({ blockId: null });
  }

  private formFor(id: string, current: string): NumeroForm {
    if (!this.forms.has(id)) {
      this.forms.set(id, this.fb.nonNullable.group({ numero: [current, [Validators.required]] }));
    }
    return this.forms.get(id)!;
  }

  form(id: string, current: string): NumeroForm {
    return this.formFor(id, current);
  }

  isSaving$(id: string) {
    return this.facade.isSavingProperty$(id);
  }

  startEdit(property: PropertyToNumber): void {
    this.formFor(property.id, property.numero).setValue({ numero: property.numero });
    this.editingId.set(property.id);
  }

  cancelEdit(): void {
    this.editingId.set(null);
  }

  save(property: PropertyToNumber): void {
    const form = this.formFor(property.id, property.numero);
    if (form.invalid) {
      form.markAllAsTouched();
      return;
    }
    this.facade.assignHouseNumber(property.id, { numero: form.getRawValue().numero.trim() });
    this.editingId.set(null);
  }

  toggleDetails(id: string): void {
    this.expandedId.set(this.expandedId() === id ? null : id);
  }
}
