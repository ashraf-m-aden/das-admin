import { Injectable, effect, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';

export type Theme = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private doc = inject(DOCUMENT);
  private static readonly KEY = 'das-theme';

  readonly theme = signal<Theme>(this.read());

  constructor() {
    effect(() => this.apply(this.theme()));
  }

  set(theme: Theme): void { this.theme.set(theme); }
  toggle(): void { this.theme.set(this.theme() === 'dark' ? 'light' : 'dark'); }

  private read(): Theme {
    try { return this.doc.defaultView?.localStorage?.getItem(ThemeService.KEY) === 'dark' ? 'dark' : 'light'; }
    catch { return 'light'; }
  }
  private apply(theme: Theme): void {
    this.doc.documentElement.setAttribute('data-theme', theme);
    try { this.doc.defaultView?.localStorage?.setItem(ThemeService.KEY, theme); } catch { /* SSR / private mode */ }
  }
}
