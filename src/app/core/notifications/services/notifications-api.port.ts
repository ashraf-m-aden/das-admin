import { Observable } from 'rxjs';
import { UUID } from '../../models/das.models';
import { Notification } from '../models/notifications.models';

export abstract class NotificationsApiPort {
  abstract list(): Observable<Notification[]>;
  abstract markAsRead(id: UUID): Observable<Notification>;
  abstract markAllAsRead(): Observable<Notification[]>;
}
