import { Routes } from '@angular/router';
import { provideState } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { closeGenerationFeature } from '../../core/closes/store/close-generation.reducer';
import { CloseGenerationEffects } from '../../core/closes/store/close-generation.effects';

export const closesGenerationRoutes: Routes = [
  {
    path: '',
    // État et effets fournis au niveau de la route, comme `closes` et `adresse` : le feature
    // n'entre dans le store que quand l'écran est visité.
    providers: [
      provideState(closeGenerationFeature),
      provideEffects(CloseGenerationEffects),
    ],
    loadComponent: () => import('./closes-generation.component').then((m) => m.ClosesGenerationComponent),
  },
];
