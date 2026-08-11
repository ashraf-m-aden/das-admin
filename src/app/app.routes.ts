import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './core/auth/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./core/layout/shell/shell.component').then((m) => m.ShellComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'registry',
        loadChildren: () => import('./features/registry/registry.routes').then((m) => m.registryRoutes),
      },
      {
        path: 'blocks',
        loadChildren: () => import('./features/blocks/blocks.routes').then((m) => m.blocksRoutes),
      },
      {
        path: 'addressing',
        canActivate: [roleGuard(['Admin', 'Superviseur', 'Gestionnaire'])],
        loadChildren: () => import('./features/addressing/addressing.routes').then((m) => m.addressingRoutes),
      },
      {
        path: 'field-operations',
        canActivate: [roleGuard(['Admin', 'Superviseur', 'Gestionnaire'])],
        loadChildren: () => import('./features/field-operations/field-operations.routes').then((m) => m.fieldOpsRoutes),
      },
      {
        path: 'review',
        canActivate: [roleGuard(['Admin', 'Superviseur', 'Gestionnaire'])],
        loadChildren: () => import('./features/review/review.routes').then((m) => m.reviewRoutes),
      },
      {
        path: 'postcodes',
        canActivate: [roleGuard(['Admin', 'Gestionnaire'])],
        loadChildren: () => import('./features/postcodes/postcodes.routes').then((m) => m.postcodesRoutes),
      },
      {
        path: 'data-quality',
        canActivate: [roleGuard(['Admin', 'Superviseur'])],
        loadChildren: () => import('./features/data-quality/data-quality.routes').then((m) => m.dataQualityRoutes),
      },
      {
        path: 'reports',
        canActivate: [roleGuard(['Admin', 'Gestionnaire'])],
        loadChildren: () => import('./features/reports/reports.routes').then((m) => m.reportsRoutes),
      },
      {
        path: 'staff',
        canActivate: [roleGuard(['Admin'])],
        loadChildren: () => import('./features/staff/staff.routes').then((m) => m.staffRoutes),
      },
      {
        path: 'clients',
        canActivate: [roleGuard(['Admin'])],
        loadChildren: () => import('./features/clients/clients.routes').then((m) => m.clientsRoutes),
      },
      {
        path: 'notifications',
        loadChildren: () => import('./features/notifications/notifications.routes').then((m) => m.notificationsRoutes),
      },
      {
        path: 'integrations',
        canActivate: [roleGuard(['Admin'])],
        loadChildren: () => import('./features/integrations/integrations.routes').then((m) => m.integrationsRoutes),
      },
      { path: 'profile', loadChildren: () => import('./features/profile/profile.routes').then((m) => m.profileRoutes) },
      {
        path: 'settings',
        canActivate: [roleGuard(['Admin'])],
        loadChildren: () => import('./features/settings/settings.routes').then((m) => m.settingsRoutes),
      },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
