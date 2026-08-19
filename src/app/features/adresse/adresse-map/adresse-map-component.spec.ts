import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideMockStore } from '@ngrx/store/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { AppConfigService } from '../../../core/config/app-config.service';
import { adresseFeatureKey } from '../../../core/adresse/store/adresse.reducer';
import { initialAdresseState } from '../../../core/adresse/store/adresse.state';

import { AdresseMapComponent } from './adresse-map-component';

describe('AdresseMapComponent', () => {
  let component: AdresseMapComponent;
  let fixture: ComponentFixture<AdresseMapComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdresseMapComponent, TranslocoTestingModule.forRoot({ langs: { fr: {} }, translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' } })],
      providers: [
        provideMockStore({ initialState: { [adresseFeatureKey]: initialAdresseState } }),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AppConfigService, useValue: { get: () => false, isLoaded: true } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdresseMapComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
