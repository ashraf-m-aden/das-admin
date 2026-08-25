import { Routes } from '@angular/router';
import { provideState } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { discoveriesFeature } from '../../core/discoveries/store/discoveries.reducer';
import { DiscoveriesEffects } from '../../core/discoveries/store/discoveries.effects';

export const discoveriesRoutes: Routes = [
  {
    path: '',
    // État et effets fournis au niveau de la route (même pattern que `closes` et `adresse`) :
    // le feature n'entre dans le store qu'à la visite de l'écran.
    providers: [
      provideState(discoveriesFeature),
      provideEffects(DiscoveriesEffects),
    ],
    loadComponent: () => import('./discoveries.component').then((m) => m.DiscoveriesComponent),
  },
];
