import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { DataQualityApiPort } from '../../core/dataquality/services/dataquality-api.port';
import { MockDataQualityApiService } from '../../core/dataquality/services/mock-dataquality-api.service';

export const dataQualityRoutes: Routes = [
  {
    path: '',
    providers: [
      { provide: DataQualityApiPort, useFactory: () => inject(MockDataQualityApiService) },
    ],
    loadComponent: () => import('./data-quality.component').then((m) => m.DataQualityComponent),
  },
];
