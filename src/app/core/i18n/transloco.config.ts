import { isDevMode } from '@angular/core';
import { provideTransloco } from '@jsverse/transloco';
import { TranslocoHttpLoader } from './transloco-loader';

export function provideTranslocoConfig() {
  return provideTransloco({
    config: {
      availableLangs: ['fr', 'en'],
      defaultLang: 'fr',
      fallbackLang: 'fr',
      reRenderOnLangChange: true,
      prodMode: !isDevMode(),
      missingHandler: { useFallbackTranslation: true, logMissingKey: isDevMode() },
    },
    loader: TranslocoHttpLoader,
  });
}
