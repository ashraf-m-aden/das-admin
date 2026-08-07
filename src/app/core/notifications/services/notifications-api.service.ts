import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { NotificationsApiPort } from './notifications-api.port';
import { AppConfigService } from '../../config/app-config.service';
import { Notification } from '../models/notifications.models';
import { UUID } from '../../models/das.models';

/**
 * Implémentation réelle. Endpoints attendus côté API .NET :
 *   GET   /notifications              -> Notification[] (pour l'utilisateur authentifié)
 *   PATCH /notifications/{id}/read    -> Notification
 *   PATCH /notifications/read-all     -> Notification[]
 *
 * Les notifications elles-mêmes sont créées côté backend, déclenchées par
 * les événements métier (tâche terminée, bloc soumis, revue traitée...) —
 * jamais par un appel direct du frontend.
 */
@Injectable({ providedIn: 'root' })
export class NotificationsApiService extends NotificationsApiPort {
  private http = inject(HttpClient);
  private config = inject(AppConfigService);

  private get baseUrl(): string {
    return `${this.config.get('apiBaseUrl')}/notifications`;
  }

  override list(): Observable<Notification[]> {
    return this.http.get<Notification[]>(this.baseUrl);
  }

  override markAsRead(id: UUID): Observable<Notification> {
    return this.http.patch<Notification>(`${this.baseUrl}/${id}/read`, {});
  }

  override markAllAsRead(): Observable<Notification[]> {
    return this.http.patch<Notification[]>(`${this.baseUrl}/read-all`, {});
  }
}
