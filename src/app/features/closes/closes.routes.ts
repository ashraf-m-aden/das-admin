import { Routes } from '@angular/router';

export const closesRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./closes.component').then((m) => m.ClosesComponent),
  },
];
