import { Routes } from '@angular/router';

export const postcodesRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./postcodes.component').then((m) => m.PostcodesComponent),
  },
];
