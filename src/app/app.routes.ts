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
        path: 'blocks',
        loadChildren: () => import('./features/blocks/blocks.routes').then((m) => m.blocksRoutes),
      },
      {
        path: 'addressing',
        canActivate: [roleGuard(['Admin', 'Superviseur', 'Gestionnaire'])],
        loadChildren: () => import('./features/addressing/addressing.routes').then((m) => m.addressingRoutes),
      },
      {
        path: 'review',
        canActivate: [roleGuard(['Admin', 'Superviseur', 'Gestionnaire'])],
        loadChildren: () => import('./features/review/review.routes').then((m) => m.reviewRoutes),
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
        loadChildren: () =>
          import('./features/notifications/notifications.routes').then((m) => m.notificationsRoutes),
      },
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
