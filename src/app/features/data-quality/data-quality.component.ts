import { Component, OnInit, inject } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { DataQualityFacade } from '../../core/dataquality/store/dataquality.facade';
import { PageHeaderComponent } from '../../core/layout/page-header/page-header.component';
import { DasDatePipe } from '../../core/i18n/das-locale.pipes';

@Component({
  selector: 'das-data-quality',
  standalone: true,
  imports: [TranslocoModule, PageHeaderComponent, DasDatePipe],
  templateUrl: './data-quality.component.html',
  styleUrl: './data-quality.component.scss',
})
export class DataQualityComponent implements OnInit {
  protected facade = inject(DataQualityFacade);

  ngOnInit(): void { this.facade.load(); }

  notSurveyableReasonKey(reason: string): string {
    return `verification.notSurveyableReason.${reason.toLowerCase()}`;
  }
}
