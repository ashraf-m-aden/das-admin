import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { PostcodesApiPort } from '../../core/postcodes/services/postcodes-api.port';
import { MockPostcodesApiService } from '../../core/postcodes/services/mock-postcodes-api.service';
import { AppConfigService } from '../../core/config/app-config.service';

export const postcodesRoutes: Routes = [
  {
    path: '',
    providers: [
      { provide: PostcodesApiPort, useFactory: () => inject(MockPostcodesApiService) /* TODO: real service via AppConfigService.get('useMockApi') */ },
    ],
    loadComponent: () => import('./postcodes.component').then((m) => m.PostcodesComponent),
  },
];
