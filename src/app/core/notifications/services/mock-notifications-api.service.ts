import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { NotificationsApiPort } from './notifications-api.port';
import { Notification } from '../models/notifications.models';
import { UUID } from '../../models/das.models';

@Injectable({ providedIn: 'root' })
export class MockNotificationsApiService extends NotificationsApiPort {
  private static readonly SIMULATED_LATENCY_MS = 400;

  private notifications: Notification[] = [
    {
      id: 'notif-0001',
      type: 'task_completed',
      messageKey: 'notifications.task_completed',
      messageParams: { agent: 'Idriss Agent', code: 'BLK-Q3-014' },
      relatedEntityType: 'task',
      relatedEntityId: 'task-0002',
      readAt: null,
      createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    },
    {
      id: 'notif-0002',
      type: 'block_submitted',
      messageKey: 'notifications.block_submitted',
      messageParams: { code: 'BLK-RD-002' },
      relatedEntityType: 'block',
      relatedEntityId: 'block-0003',
      readAt: null,
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'notif-0003',
      type: 'property_needs_redo',
      messageKey: 'notifications.property_needs_redo',
      messageParams: { code: 'DJ-BOU-ARR2-Q3-B014-B-012' },
      relatedEntityType: 'property',
      relatedEntityId: 'review-property-0002',
      readAt: null,
      createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'notif-0004',
      type: 'redo_resolved',
      messageKey: 'notifications.redo_resolved',
      messageParams: { code: 'DJ-BOU-ARR2-Q7-B012-A-045', agent: 'Idriss Agent' },
      relatedEntityType: 'redo_request',
      relatedEntityId: 'redo-0001',
      readAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'notif-0005',
      type: 'property_approved',
      messageKey: 'notifications.property_approved',
      messageParams: { code: 'DJ-BOU-ARR2-Q7-B012-A-046' },
      relatedEntityType: 'property',
      relatedEntityId: 'property-0099',
      readAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];

  override list(): Observable<Notification[]> {
    const sorted = [...this.notifications].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return of(sorted).pipe(delay(MockNotificationsApiService.SIMULATED_LATENCY_MS));
  }

  override markAsRead(id: UUID): Observable<Notification> {
    const existing = this.notifications.find((n) => n.id === id);
    if (!existing) {
      return throwError(() => ({ code: 'not_found', message: 'common.error' }));
    }
    const updated: Notification = { ...existing, readAt: existing.readAt ?? new Date().toISOString() };
    this.notifications = this.notifications.map((n) => (n.id === id ? updated : n));
    return of(updated).pipe(delay(200));
  }

  override markAllAsRead(): Observable<Notification[]> {
    const now = new Date().toISOString();
    this.notifications = this.notifications.map((n) => ({ ...n, readAt: n.readAt ?? now }));
    return of(this.notifications).pipe(delay(300));
  }
}
