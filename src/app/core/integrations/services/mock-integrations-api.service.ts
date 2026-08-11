import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { IntegrationsApiPort } from './integrations-api.port';
import { Integration, IntegrationsData } from '../models/integrations.models';

@Injectable({ providedIn: 'root' })
export class MockIntegrationsApiService extends IntegrationsApiPort {
  private items: Integration[] = [
    { id: 'martin', name: 'Martin Tile Server', category: 'gis', descriptionKey: 'integrations.item.martin', icon: 'ti-map-2', status: 'connected', lastSync: new Date(Date.now() - 3600e3).toISOString() },
    { id: 'qgis', name: 'QGIS Import', category: 'gis', descriptionKey: 'integrations.item.qgis', icon: 'ti-vector', status: 'connected', lastSync: new Date(Date.now() - 86400e3).toISOString() },
    { id: 'laposte', name: 'La Poste de Djibouti', category: 'postal', descriptionKey: 'integrations.item.laposte', icon: 'ti-mail', status: 'connected', lastSync: new Date(Date.now() - 7200e3).toISOString() },
    { id: 'interior', name: 'Ministère de l\'Intérieur', category: 'gov', descriptionKey: 'integrations.item.interior', icon: 'ti-building-bank', status: 'connected', lastSync: new Date(Date.now() - 5 * 86400e3).toISOString() },
    { id: 'metabase', name: 'Analytics / BI', category: 'analytics', descriptionKey: 'integrations.item.analytics', icon: 'ti-chart-dots', status: 'disconnected', lastSync: null },
    { id: 's3', name: 'Object Storage (S3)', category: 'storage', descriptionKey: 'integrations.item.storage', icon: 'ti-database', status: 'error', lastSync: new Date(Date.now() - 2 * 86400e3).toISOString() },
  ];

  private data(): IntegrationsData {
    return { items: this.items, connectedCount: this.items.filter((i) => i.status === 'connected').length };
  }

  override load(): Observable<IntegrationsData> {
    return of(this.data()).pipe(delay(340));
  }

  override toggle(id: string, connect: boolean): Observable<Integration> {
    const it = this.items.find((i) => i.id === id);
    if (!it) return throwError(() => ({ code: 'not_found', message: 'common.error' }));
    const updated: Integration = { ...it, status: connect ? 'connected' : 'disconnected', lastSync: connect ? new Date().toISOString() : it.lastSync };
    this.items = this.items.map((i) => (i.id === id ? updated : i));
    return of(updated).pipe(delay(250));
  }
}
