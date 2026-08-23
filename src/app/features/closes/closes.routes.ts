import { Routes } from '@angular/router';
import { provideState } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { closesFeature } from '../../core/closes/store/closes.reducer';
import { ClosesEffects } from '../../core/closes/store/closes.effects';

export const closesRoutes: Routes = [
  {
    path: '',
    // État et effets fournis au niveau de la route (même pattern que `adresse`) : le feature
    // n'entre dans le store que quand l'écran est visité.
    providers: [
      provideState(closesFeature),
      provideEffects(ClosesEffects),
    ],
    loadComponent: () => import('./closes.component').then((m) => m.ClosesComponent),
  },
];
