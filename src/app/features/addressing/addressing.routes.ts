import { Routes } from '@angular/router';

export const addressingRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./addressing-shell/addressing-shell.component').then((m) => m.AddressingShellComponent),
    children: [
      {
        path: 'block-naming',
        loadComponent: () => import('./block-naming/block-naming.component').then((m) => m.BlockNamingComponent),
      },
      {
        path: 'street-naming',
        loadComponent: () => import('./street-naming/street-naming.component').then((m) => m.StreetNamingComponent),
      },
      {
        path: 'property-numbering',
        loadComponent: () =>
          import('./property-numbering/property-numbering.component').then((m) => m.PropertyNumberingComponent),
      },
      { path: '', pathMatch: 'full', redirectTo: 'block-naming' },
    ],
  },
];
