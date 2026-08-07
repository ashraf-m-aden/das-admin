import { Injectable, inject } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { AppConfigService } from '../../config/app-config.service';
import { AuthStorageService } from '../../auth/services/auth-storage.service';
import { Notification } from '../models/notifications.models';

/**
 * Connexion temps réel au Hub SignalR /notificationsHub (voir spec backend,
 * section 6bis). Utilisée UNIQUEMENT en mode réel — en mock il n'y a pas de
 * serveur SignalR à côté, donc rien à connecter (voir NotificationsEffects).
 */
@Injectable({ providedIn: 'root' })
export class NotificationsHubService {
  private config = inject(AppConfigService);
  private authStorage = inject(AuthStorageService);

  private connection?: signalR.HubConnection;

  connect(onNotificationReceived: (notification: Notification) => void): void {
    if (this.connection) return; // déjà connecté, ne pas dupliquer

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(`${this.config.get('apiBaseUrl')}/notificationsHub`, {
        // Le navigateur ne permet pas de header Authorization sur WebSocket —
        // le token part donc en query string (?access_token=...), géré côté
        // backend via JwtBearerEvents.OnMessageReceived (voir spec).
        accessTokenFactory: () => this.authStorage.load()?.accessToken ?? '',
      })
      .withAutomaticReconnect()
      .build();

    // Nom d'événement et casse du payload : voir spec backend section 6bis.6
    this.connection.on('NotificationReceived', (notification: Notification) => {
      onNotificationReceived(notification);
    });

    this.connection.start().catch((err) => {
      console.error('[notifications-hub] échec de connexion :', err);
    });
  }

  disconnect(): void {
    this.connection?.stop();
    this.connection = undefined;
  }
}
