import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { provideState } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { adresseFeature } from '../../core/adresse/store/adresse.reducer';
import { AdresseEffects } from '../../core/adresse/store/adresse.effects';
import { AdresseApiPort } from '../../core/adresse/services/adresse-api.port';
import { AdresseApiService } from '../../core/adresse/services/adresse-api.service';
import { MockAdresseApiService } from '../../core/adresse/services/mock-adresse-api.service';
import { AppConfigService } from '../../core/config/app-config.service';

export const adresseRoutes: Routes = [
  {
    path: '',
    providers: [
      provideState(adresseFeature),
      provideEffects(AdresseEffects),
      {
        provide: AdresseApiPort,
        useFactory: () => (inject(AppConfigService).get('useMockApi') ? inject(MockAdresseApiService) : inject(AdresseApiService)),
      },
    ],
    loadComponent: () => import('./adresse-list/adresse-list.component').then((m) => m.AdresseListComponent),
  },
    { path: 'adresse/map', loadComponent: () => import('./adresse-map/adresse-map-component').then(m => m.AdresseMapComponent) }

];
