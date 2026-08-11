import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { FieldOpsApiPort } from '../../core/fieldops/services/fieldops-api.port';
import { MockFieldOpsApiService } from '../../core/fieldops/services/mock-fieldops-api.service';

export const fieldOpsRoutes: Routes = [
  {
    path: '',
    providers: [
      { provide: FieldOpsApiPort, useFactory: () => inject(MockFieldOpsApiService) },
    ],
    loadComponent: () => import('./field-operations.component').then((m) => m.FieldOperationsComponent),
  },
];
