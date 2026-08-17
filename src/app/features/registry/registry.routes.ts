import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { provideState } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { registryFeature } from '../../core/registry/store/registry.reducer';
import { RegistryEffects } from '../../core/registry/store/registry.effects';
import { RegistryApiPort } from '../../core/registry/services/registry-api.port';
import { RegistryApiService } from '../../core/registry/services/registry-api.service';
import { MockRegistryApiService } from '../../core/registry/services/mock-registry-api.service';
import { AppConfigService } from '../../core/config/app-config.service';

export const registryRoutes: Routes = [
  {
    path: '',
    providers: [
      provideState(registryFeature),
      provideEffects(RegistryEffects),
      {
        provide: RegistryApiPort,
        useFactory: () => (inject(AppConfigService).get('useMockApi') ? inject(MockRegistryApiService) : inject(RegistryApiService)),
      },
    ],
    loadComponent: () => import('./registry-list/registry-list.component').then((m) => m.RegistryListComponent),
  },
    { path: 'registry/map', loadComponent: () => import('./registry-map/registry-map-component').then(m => m.RegistryMapComponent) }

];
