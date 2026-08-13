import { Routes } from '@angular/router';
export const verificationRoutes: Routes = [
  { path: '', loadComponent: () => import('./verification-queue/verification-queue.component').then((m) => m.VerificationQueueComponent) },
];
