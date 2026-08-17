import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RegistryMapComponent } from './registry-map-component';

describe('RegistryMapComponent', () => {
  let component: RegistryMapComponent;
  let fixture: ComponentFixture<RegistryMapComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegistryMapComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RegistryMapComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
