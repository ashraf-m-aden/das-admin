import { Component, inject, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { SettingsFacade } from '../../../core/settings/store/settings.facade';
import { MapImportTargetType } from '../../../core/settings/models/settings.models';

/**
 * Zones de démonstration — cohérentes avec les id utilisés dans les mocks
 * Dashboard/Blocks. À remplacer par un vrai sélecteur d'ADMINISTRATIVE_UNITS
 * une fois ce référentiel géré par un écran dédié.
 */
const DEMO_ZONES = [
  { id: 'zone-q7', name: 'Boulaos — Arr. 2 — Q7' },
  { id: 'zone-q3', name: 'Balbala — Q3' },
  { id: 'zone-rasdika', name: 'Ras Dika' },
  { id: 'zone-einguela', name: 'Einguela' },
];

@Component({
  selector: 'das-map-import',
  standalone: true,
  imports: [AsyncPipe, ReactiveFormsModule, TranslocoModule],
  templateUrl: './map-import.component.html',
  styleUrl: './map-import.component.scss',
})
export class MapImportComponent {
  private fb = inject(FormBuilder);
  private facade = inject(SettingsFacade);

  protected readonly isImporting$ = this.facade.isImporting$;
  protected readonly importResult$ = this.facade.importResult$;
  protected readonly errorMessageKey$ = this.facade.importErrorMessageKey$;
  protected readonly zones = DEMO_ZONES;

  protected readonly selectedFile = signal<File | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    targetType: ['blocks' as MapImportTargetType, [Validators.required]],
    adminUnitId: [''],
  });

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile.set(input.files?.[0] ?? null);
  }

  submit(): void {
    const file = this.selectedFile();
    if (!file || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { targetType, adminUnitId } = this.form.getRawValue();
    this.facade.importMapData({
      targetType,
      adminUnitId: targetType === 'blocks' ? adminUnitId || null : null,
      file,
    });
  }

  reset(): void {
    this.facade.resetImport();
    this.selectedFile.set(null);
    this.form.reset({ targetType: 'blocks', adminUnitId: '' });
  }
}
