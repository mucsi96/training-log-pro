import { Injectable, signal } from '@angular/core';

export type NotificationType = 'success' | 'error';

export type Notification = {
  type: NotificationType;
  message: string;
};

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly _notifications = signal<Notification[]>([]);
  readonly notifications = this._notifications.asReadonly();

  showNotification(message: string, type: NotificationType = 'success') {
    this._notifications.update((n) => [...n, { type, message }]);
  }

  removeNotification(notificationToRemove: Notification) {
    this._notifications.update((n) =>
      n.filter((notification) => notification !== notificationToRemove)
    );
  }
}
