import { Component, inject, signal } from '@angular/core';
import { TranslocoService, TranslocoModule } from '@jsverse/transloco';

const LANG_STORAGE_KEY = 'das-lang';

@Component({
  selector: 'das-language-switcher',
  standalone: true,
  imports: [TranslocoModule],
  templateUrl: './language-switcher.component.html',
  styleUrl: './language-switcher.component.scss',
})
export class LanguageSwitcherComponent {
  private transloco = inject(TranslocoService);

  protected readonly langs = [
    { code: 'fr', label: 'FR' },
    { code: 'en', label: 'EN' },
  ];

  protected activeLang = toSignalFromTransloco(this.transloco);

  setLang(code: string): void {
    this.transloco.setActiveLang(code);
    localStorage.setItem(LANG_STORAGE_KEY, code);
  }
}

function toSignalFromTransloco(transloco: TranslocoService) {
  const stored = localStorage.getItem(LANG_STORAGE_KEY);
  const browserLang = navigator.language.startsWith('en') ? 'en' : 'fr';
  const initialLang = stored ?? browserLang;

  if (transloco.getActiveLang() !== initialLang) {
    transloco.setActiveLang(initialLang);
  }

  const lang = signal(transloco.getActiveLang());
  transloco.langChanges$.subscribe((l) => lang.set(l));
  return lang.asReadonly();
}
