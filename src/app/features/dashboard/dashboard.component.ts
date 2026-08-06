import { Component, OnInit, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { TranslocoModule } from '@jsverse/transloco';
import { DashboardFacade } from '../../core/dashboard/store/dashboard.facade';
import { DasNumberPipe, DasDatePipe } from '../../core/i18n/das-locale.pipes';

@Component({
  selector: 'das-dashboard',
  standalone: true,
  imports: [AsyncPipe, TranslocoModule, DasNumberPipe, DasDatePipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private facade = inject(DashboardFacade);

  protected readonly summary$ = this.facade.summary$;
  protected readonly zoneProgress$ = this.facade.zoneProgress$;
  protected readonly urgentAlerts$ = this.facade.urgentAlerts$;
  protected readonly isLoading$ = this.facade.isLoading$;

  ngOnInit(): void {
    this.facade.loadSummary();
  }

  progressPercent(approved: number, total: number): number {
    return total === 0 ? 0 : Math.round((approved / total) * 100);
  }
}
