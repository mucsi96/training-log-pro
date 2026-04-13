import { TestBed } from '@angular/core/testing';

import { NotificationService } from './notification.service';

function setup() {
  TestBed.configureTestingModule({
    providers: [NotificationService],
  });

  const service = TestBed.inject(NotificationService);
  return { service };
}

describe('NotificationService', () => {
  it('stores notifications', () => {
    const { service } = setup();
    service.showNotification('test notification');
    const notifications = service.notifications();
    expect(notifications).toHaveSize(1);
    expect(notifications[0]).toEqual({
      type: 'success',
      message: 'test notification',
    });
  });

  it('stores multiple notifications', () => {
    const { service } = setup();
    service.showNotification('test notification 1');
    service.showNotification('test notification 2', 'error');
    service.showNotification('test notification 3', 'success');
    service.showNotification('test notification 4', 'error');
    const notifications = service.notifications();
    expect(notifications).toHaveSize(4);
    expect(notifications[0]).toEqual({
      type: 'success',
      message: 'test notification 1',
    });
    expect(notifications[1]).toEqual({
      type: 'error',
      message: 'test notification 2',
    });
    expect(notifications[2]).toEqual({
      type: 'success',
      message: 'test notification 3',
    });
    expect(notifications[3]).toEqual({
      type: 'error',
      message: 'test notification 4',
    });
  });
});
