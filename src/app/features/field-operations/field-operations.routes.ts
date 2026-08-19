import { Routes } from '@angular/router';

export const fieldOpsRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./field-operations.component').then((m) => m.FieldOperationsComponent),
  },
  {
    path: ':id',
    loadComponent: () => import('./campaign-detail/campaign-detail.component').then((m) => m.CampaignDetailComponent),
  },
];
