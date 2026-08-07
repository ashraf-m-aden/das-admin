import { Routes } from '@angular/router';

export const settingsRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./settings-shell/settings-shell.component').then((m) => m.SettingsShellComponent),
    children: [
      {
        path: 'road-types',
        loadComponent: () => import('./road-types/road-types.component').then((m) => m.RoadTypesComponent),
      },
      {
        path: 'map-import',
        loadComponent: () => import('./map-import/map-import.component').then((m) => m.MapImportComponent),
      },
      { path: '', pathMatch: 'full', redirectTo: 'road-types' },
    ],
  },
];
