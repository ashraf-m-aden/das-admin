import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdresseMapComponent } from './adresse-map-component';

describe('AdresseMapComponent', () => {
  let component: AdresseMapComponent;
  let fixture: ComponentFixture<AdresseMapComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdresseMapComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AdresseMapComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
