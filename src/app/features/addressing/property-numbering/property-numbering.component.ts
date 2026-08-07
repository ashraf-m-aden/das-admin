import { Component, OnInit, inject, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { AddressingFacade } from '../../../core/addressing/store/addressing.facade';
import { PropertyToNumber } from '../../../core/addressing/models/addressing.models';

type HouseNumberForm = FormGroup<{
  houseNumber: FormControl<string>;
}>;

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

  protected readonly forms = new Map<string, HouseNumberForm>();

  /** id de la propriété dont le panneau "détails" (hiérarchie admin complète) est ouvert. */
  protected readonly expandedId = signal<string | null>(null);

  ngOnInit(): void {
    this.facade.loadPropertiesToNumber({ blockId: null });
    this.facade.properties$.subscribe((properties) => this.ensureForms(properties));
  }

  private buildForm(property: PropertyToNumber): HouseNumberForm {
    return this.fb.nonNullable.group({
      houseNumber: [property.houseNumber, [Validators.required]],
    });
  }

  private ensureForms(properties: PropertyToNumber[]): void {
    for (const property of properties) {
      if (!this.forms.has(property.id)) {
        this.forms.set(property.id, this.buildForm(property));
      }
    }
  }

  formFor(id: string): HouseNumberForm {
    return this.forms.get(id)!;
  }

  isSaving$(id: string) {
    return this.facade.isSavingProperty$(id);
  }

  save(property: PropertyToNumber): void {
    const form = this.formFor(property.id);
    if (form.invalid) {
      form.markAllAsTouched();
      return;
    }
    this.facade.assignHouseNumber(property.id, { houseNumber: form.getRawValue().houseNumber });
  }

  toggleDetails(id: string): void {
    this.expandedId.set(this.expandedId() === id ? null : id);
  }
}
