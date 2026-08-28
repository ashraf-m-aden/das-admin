import { Routes } from '@angular/router';
export const verificationRoutes: Routes = [
  { path: '', loadComponent: () => import('./verification-queue/verification-queue.component').then((m) => m.VerificationQueueComponent) },
  /**
   * `/verification/:surveyId` — la MÊME file, ouverte sur un relevé précis.
   *
   * Un écran de détail séparé aurait été un doublon : on tranche un relevé avec les mêmes
   * éléments (photos, écart, motifs) et les mêmes actions, et l'isoler priverait de la file
   * juste après la décision. C'est donc une entrée dans la file, pas une page à part.
   *
   * Le composant est le même : Angular le réutilise si l'on navigue d'un relevé à l'autre,
   * d'où la lecture du paramètre en flux plutôt qu'en instantané.
   */
  { path: ':surveyId', loadComponent: () => import('./verification-queue/verification-queue.component').then((m) => m.VerificationQueueComponent) },
];
