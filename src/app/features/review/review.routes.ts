import { Routes } from '@angular/router';

export const reviewRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./review-queue/review-queue.component').then((m) => m.ReviewQueueComponent),
  },
];
