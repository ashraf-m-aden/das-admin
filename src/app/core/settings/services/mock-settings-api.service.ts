import { Injectable } from '@angular/core';
import { Observable, from, of, throwError } from 'rxjs';
import { delay, map } from 'rxjs/operators';
import { SettingsApiPort } from './settings-api.port';
import { RoadType } from '../../models/das.models';
import { CreateRoadTypePayload, ImportMapDataPayload, ImportMapDataResult } from '../models/settings.models';

@Injectable({ providedIn: 'root' })
export class MockSettingsApiService extends SettingsApiPort {
  private static readonly SIMULATED_LATENCY_MS = 400;

  private roadTypes: RoadType[] = [
    { id: 'road-type-street', code: 'street', labelFr: 'Rue', isPoint: false },
    { id: 'road-type-avenue', code: 'avenue', labelFr: 'Avenue', isPoint: false },
    { id: 'road-type-boulevard', code: 'boulevard', labelFr: 'Boulevard', isPoint: false },
    { id: 'road-type-alley', code: 'alley', labelFr: 'Ruelle', isPoint: false },
    { id: 'road-type-road', code: 'road', labelFr: 'Route', isPoint: false },
    { id: 'road-type-intersection', code: 'intersection', labelFr: 'Carrefour', isPoint: true },
    { id: 'road-type-roundabout', code: 'roundabout', labelFr: 'Rond-point', isPoint: true },
  ];

  override listRoadTypes(): Observable<RoadType[]> {
    return of(this.roadTypes).pipe(delay(MockSettingsApiService.SIMULATED_LATENCY_MS));
  }

  override createRoadType(payload: CreateRoadTypePayload): Observable<RoadType> {
    if (this.roadTypes.some((rt) => rt.code === payload.code)) {
      return throwError(() => ({ code: 'code_taken', message: 'settings.roadTypeCodeTaken' })).pipe(
        delay(MockSettingsApiService.SIMULATED_LATENCY_MS),
      );
    }

    const created: RoadType = { id: crypto.randomUUID(), ...payload };
    this.roadTypes = [...this.roadTypes, created];
    return of(created).pipe(delay(MockSettingsApiService.SIMULATED_LATENCY_MS));
  }

  /**
   * Lit le fichier GeoJSON côté client et compte les features — ne persiste
   * RIEN dans le store Blocks mock (pas de couplage entre domaines). Sert
   * uniquement à valider le flux d'upload/feedback ; le vrai import (écriture
   * en base) est un travail 100% backend.
   */
  override importMapData(payload: ImportMapDataPayload): Observable<ImportMapDataResult> {
    if (payload.targetType === 'blocks' && !payload.adminUnitId) {
      return throwError(() => ({ code: 'missing_zone', message: 'settings.missingZone' }));
    }

    return from(payload.file.text()).pipe(
      delay(MockSettingsApiService.SIMULATED_LATENCY_MS),
      map((raw) => {
        let parsed: { features?: unknown[] };
        try {
          parsed = JSON.parse(raw);
        } catch {
          return { importedCount: 0, skippedCount: 0, errors: ['Fichier JSON invalide.'] };
        }

        const features = Array.isArray(parsed.features) ? parsed.features : [];
        if (features.length === 0) {
          return { importedCount: 0, skippedCount: 0, errors: ['Aucune feature trouvée dans le fichier.'] };
        }

        // Simulation simple : 90% importées, le reste "ignorées" (géométrie invalide, etc.)
        const importedCount = Math.ceil(features.length * 0.9);
        const skippedCount = features.length - importedCount;

        return { importedCount, skippedCount, errors: [] };
      }),
    );
  }
}
