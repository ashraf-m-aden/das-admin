import { Routes } from '@angular/router';

export const blocksRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./blocks-list/blocks-list.component').then((m) => m.BlocksListComponent),
  },
  {
    path: 'map',
    loadComponent: () => import('./blocks-map/blocks-map.component').then((m) => m.BlocksMapComponent),
  },
  {
    path: ':id',
    loadComponent: () => import('./block-detail/block-detail.component').then((m) => m.BlockDetailComponent),
  },
];
