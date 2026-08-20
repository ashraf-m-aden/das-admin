import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { UnitsApiPort } from './units-api.port';
import { AppConfigService } from '../../config/app-config.service';
import { UUID } from '../../models/das.models';
import { AddressUnit, UnitType } from '../models/units.models';

interface RawUnitResponse {
  id: string;
  adresseId: string;
  floor: number | string;
  number: string;
  type: UnitType;
}

@Injectable({ providedIn: 'root' })
export class UnitsApiService extends UnitsApiPort {
  private http = inject(HttpClient);
  private config = inject(AppConfigService);
  private get baseUrl() { return `${this.config.get('apiBaseUrl')}/units`; }

  override listByAdresse(adresseId: UUID): Observable<AddressUnit[]> {
    return this.http.get<RawUnitResponse[]>(this.baseUrl, { params: { adresseId } }).pipe(
      map((units) => units.map((u) => ({ id: u.id, floor: Number(u.floor), number: u.number, type: u.type }))),
    );
  }
}
