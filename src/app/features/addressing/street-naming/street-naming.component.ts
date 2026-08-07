import { Component, OnInit, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { AddressingFacade } from '../../../core/addressing/store/addressing.facade';
import { SettingsFacade } from '../../../core/settings/store/settings.facade';
import { StreetToName } from '../../../core/addressing/models/addressing.models';

type StreetNameForm = FormGroup<{
  nameFr: FormControl<string>;
  nameAr: FormControl<string>;
  roadTypeId: FormControl<string>;
}>;

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
  private settingsFacade = inject(SettingsFacade);

  protected readonly streets$ = this.facade.streets$;
  protected readonly isLoading$ = this.facade.isStreetsLoading$;
  protected readonly errorMessageKey$ = this.facade.streetSaveErrorMessageKey$;

  /** Alimente le <select> de type de voie — même référentiel que l'écran Paramètres. */
  protected readonly roadTypes$ = this.settingsFacade.roadTypes$;

  protected readonly filterForm = this.fb.nonNullable.group({
    search: [''],
    onlyUnnamed: [true],
  });

  protected readonly forms = new Map<string, StreetNameForm>();

  ngOnInit(): void {
    this.facade.loadStreetsToName();
    this.settingsFacade.loadRoadTypes();

    this.filterForm.valueChanges.subscribe((value) => {
      this.facade.setStreetFilters({ search: value.search ?? '', onlyUnnamed: value.onlyUnnamed ?? true });
    });

    this.facade.streets$.subscribe((streets) => this.rebuildForms(streets));
  }

  private buildForm(street: StreetToName): StreetNameForm {
    return this.fb.nonNullable.group({
      nameFr: [street.nameFr ?? street.suggestedName ?? '', [Validators.required]],
      nameAr: [street.nameAr ?? ''],
      roadTypeId: [street.roadTypeId ?? ''],
    });
  }

  private rebuildForms(streets: StreetToName[]): void {
    this.forms.clear();
    for (const street of streets) {
      this.forms.set(street.id, this.buildForm(street));
    }
  }

  formFor(id: string): StreetNameForm {
    return this.forms.get(id)!;
  }

  isSaving$(id: string) {
    return this.facade.isSavingStreet$(id);
  }

  confirm(street: StreetToName): void {
    const form = this.formFor(street.id);
    if (form.invalid) {
      form.markAllAsTouched();
      return;
    }
    const { nameFr, nameAr, roadTypeId } = form.getRawValue();
    this.facade.assignStreetName(street.id, {
      nameFr,
      nameAr: nameAr || null,
      roadTypeId: roadTypeId || null,
    });
  }
}
