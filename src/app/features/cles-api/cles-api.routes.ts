import { Routes } from '@angular/router';

export const clesApiRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./cles-api.component').then((m) => m.ClesApiComponent),
  },
];
