import { Routes } from '@angular/router';

export const dataQualityRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./data-quality.component').then((m) => m.DataQualityComponent),
  },
];
