import { Injectable, signal } from '@angular/core';

export type PeriodPreset = 'last7' | 'last30' | 'thisMonth' | 'last6m' | 'custom';
export interface Period { preset: PeriodPreset; from: Date; to: Date; }

@Injectable({ providedIn: 'root' })
export class PeriodService {
  readonly period = signal<Period>(this.compute('last30'));

  setPreset(preset: Exclude<PeriodPreset, 'custom'>): void { this.period.set(this.compute(preset)); }
  setCustom(from: Date, to: Date): void { this.period.set({ preset: 'custom', from, to }); }

  private compute(preset: Exclude<PeriodPreset, 'custom'>): Period {
    const to = new Date();
    const from = new Date();
    if (preset === 'last7') from.setDate(to.getDate() - 7);
    else if (preset === 'last30') from.setDate(to.getDate() - 30);
    else if (preset === 'thisMonth') { from.setDate(1); from.setHours(0, 0, 0, 0); }
    else if (preset === 'last6m') from.setMonth(to.getMonth() - 6);
    return { preset, from, to };
  }
}
