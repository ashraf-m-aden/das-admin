import { Routes } from '@angular/router';

export const integrationsRoutes: Routes = [
  { path: '', loadComponent: () => import('./integrations.component').then((m) => m.IntegrationsComponent) },
];
