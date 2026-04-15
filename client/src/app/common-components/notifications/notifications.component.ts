import { AfterViewInit, Component, ElementRef, inject } from '@angular/core';
import { NotificationService } from '../notification.service';
import { NotificationComponent } from '../notification/notification.component';
import { Notification } from '../notification.service';

@Component({
  standalone: true,
  imports: [NotificationComponent],
  selector: '[app-notifications]',
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.css'],
})
export class NotificationsComponent implements AfterViewInit {
  readonly notificationService = inject(NotificationService);
  readonly notifications = this.notificationService.notifications;
  #height = 0;

  private readonly elementRef = inject(ElementRef);

  ngAfterViewInit(): void {
    const element = this.elementRef.nativeElement;
    const observer = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        const initialOffset = this.#height - entry.contentRect.height;
        this.#height = entry.contentRect.height;
        if (initialOffset < 0) {
          element.animate(
            [
              { transform: `translateY(${initialOffset}px)` },
              { transform: 'translateY(0)' },
            ],
            {
              duration: 150,
              easing: 'ease-out',
            }
          );
        }
      });
    });

    observer.observe(element);
  }

  removeNotification(notification: Notification) {
    this.notificationService.removeNotification(notification);
  }
}
