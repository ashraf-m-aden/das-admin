import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { PeriodService, PeriodPreset } from '../../period/period.service';

@Component({
  selector: 'das-date-range-button',
  standalone: true,
  imports: [FormsModule, TranslocoModule],
  templateUrl: './date-range-button.component.html',
  styleUrl: './date-range-button.component.scss',
})
export class DateRangeButtonComponent {
  private period = inject(PeriodService);

  protected readonly open = signal(false);
  protected customFrom = '';
  protected customTo = '';

  protected readonly presets: Exclude<PeriodPreset, 'custom'>[] = ['last7', 'last30', 'thisMonth', 'last6m'];

  protected readonly label = computed(() => {
    const p = this.period.period();
    const fmt = (d: Date) => d.toLocaleDateString();
    return `${fmt(p.from)} – ${fmt(p.to)}`;
  });
  protected readonly activePreset = computed(() => this.period.period().preset);

  toggle(): void { this.open.update((o) => !o); }
  choose(preset: Exclude<PeriodPreset, 'custom'>): void { this.period.setPreset(preset); this.open.set(false); }
  applyCustom(): void {
    if (!this.customFrom || !this.customTo) return;
    this.period.setCustom(new Date(this.customFrom), new Date(this.customTo));
    this.open.set(false);
  }
  presetLabelKey(p: PeriodPreset): string { return `period.${p}`; }
}
