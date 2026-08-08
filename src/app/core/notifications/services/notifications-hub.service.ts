import { Injectable, inject } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { AppConfigService } from '../../config/app-config.service';
import { AuthStorageService } from '../../auth/services/auth-storage.service';
import { Notification } from '../models/notifications.models';

@Injectable({ providedIn: 'root' })
export class NotificationsHubService {
  private config = inject(AppConfigService);
  private authStorage = inject(AuthStorageService);

  private connection?: signalR.HubConnection;

  connect(onNotificationReceived: (notification: Notification) => void): void {
    if (this.connection) return;

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(`${this.config.get('apiBaseUrl')}/notificationsHub`, {
        accessTokenFactory: () => this.authStorage.load()?.accessToken ?? '',
      })
      .withAutomaticReconnect()
      .build();

    this.connection.on('NotificationReceived', (notification: Notification) => {
      onNotificationReceived(notification);
    });

    this.connection.start().catch((err: unknown) => {
      console.error('[notifications-hub] échec de connexion :', err);
    });
  }

  disconnect(): void {
    this.connection?.stop();
    this.connection = undefined;
  }
}
