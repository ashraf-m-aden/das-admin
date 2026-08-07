import { Component, OnInit, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { SettingsFacade } from '../../../core/settings/store/settings.facade';
import { RoadTypeCode } from '../../../core/models/das.models';

const ROAD_TYPE_CODES: RoadTypeCode[] = [
  'street',
  'avenue',
  'boulevard',
  'alley',
  'road',
  'intersection',
  'roundabout',
];

@Component({
  selector: 'das-road-types',
  standalone: true,
  imports: [AsyncPipe, ReactiveFormsModule, TranslocoModule],
  templateUrl: './road-types.component.html',
  styleUrl: './road-types.component.scss',
})
export class RoadTypesComponent implements OnInit {
  private fb = inject(FormBuilder);
  private facade = inject(SettingsFacade);

  protected readonly items$ = this.facade.roadTypes$;
  protected readonly isLoading$ = this.facade.isRoadTypesLoading$;
  protected readonly isSaving$ = this.facade.isCreatingRoadType$;
  protected readonly errorMessageKey$ = this.facade.createRoadTypeErrorMessageKey$;
  protected readonly codes = ROAD_TYPE_CODES;

  protected readonly form = this.fb.nonNullable.group({
    code: ['street' as RoadTypeCode, [Validators.required]],
    labelFr: ['', [Validators.required]],
    isPoint: [false],
  });

  ngOnInit(): void {
    this.facade.loadRoadTypes();
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.facade.createRoadType(this.form.getRawValue());
    this.form.reset({ code: 'street', labelFr: '', isPoint: false });
  }
}
