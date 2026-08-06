import { Injectable } from '@angular/core';
import { AppRuntimeConfig } from './app-config.model';

/**
 * La config runtime est chargée AVANT le bootstrap Angular (voir main.ts),
 * via un fetch() brut — pas d'APP_INITIALIZER. Raison : provideEffects()
 * de NgRx instancie les effects via ENVIRONMENT_INITIALIZER, qui s'exécute
 * de façon synchrone à la création de l'injecteur, donc AVANT qu'un
 * APP_INITIALIZER asynchrone ait fini de se résoudre. AuthEffects injecte
 * AuthApiPort dès sa construction -> la config doit déjà être là.
 */
@Injectable({ providedIn: 'root' })
export class AppConfigService {
  private static config: AppRuntimeConfig | null = null;

  /** Appelé une seule fois, dans main.ts, avant bootstrapApplication(). */
  static preload(config: AppRuntimeConfig): void {
    AppConfigService.config = config;
  }

  get<K extends keyof AppRuntimeConfig>(key: K): AppRuntimeConfig[K] {
    if (!AppConfigService.config) {
      throw new Error(`AppConfigService: config.json pas encore chargé (clé demandée : "${key}")`);
    }
    return AppConfigService.config[key];
  }

  get isLoaded(): boolean {
    return AppConfigService.config !== null;
  }
}