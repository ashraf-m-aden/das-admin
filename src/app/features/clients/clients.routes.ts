import { Routes } from '@angular/router';

export const clientsRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./clients-list/clients-list.component').then((m) => m.ClientsListComponent),
  },
  {
    path: 'new',
    loadComponent: () => import('./client-form/client-form.component').then((m) => m.ClientFormComponent),
  },
  {
    path: ':id/edit',
    loadComponent: () => import('./client-form/client-form.component').then((m) => m.ClientFormComponent),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./client-detail/client-detail-shell.component').then((m) => m.ClientDetailShellComponent),
    children: [
      {
        path: 'zone-access',
        loadComponent: () => import('./client-detail/zone-access/zone-access.component').then((m) => m.ZoneAccessComponent),
      },
      {
        path: 'api-tokens',
        loadComponent: () => import('./client-detail/api-tokens/api-tokens.component').then((m) => m.ApiTokensComponent),
      },
      { path: '', pathMatch: 'full', redirectTo: 'zone-access' },
    ],
  },
];
