import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { WithingsService } from './withings.service';
import { NotificationService } from '../common-components/notification.service';

function setup() {
  const mockNotificationService: jasmine.SpyObj<NotificationService> =
    jasmine.createSpyObj(['showNotification']);
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      WithingsService,
      { provide: NotificationService, useValue: mockNotificationService },
    ],
  });
  const service = TestBed.inject(WithingsService);
  const httpTestingController = TestBed.inject(HttpTestingController);
  return { service, httpTestingController, mockNotificationService };
}

describe('WithingsService', () => {
  describe('sync', () => {
    it('should sync with Withings', async () => {
      const { service, httpTestingController } = setup();
      const promise = service.sync();
      const request = httpTestingController.expectOne('/api/withings/sync');
      expect(request.request.method).toBe('POST');
      request.flush({});
      await promise;
      httpTestingController.verify();
    });

    it('should show notification if fetching last backup was not succesful', async () => {
      const { service, httpTestingController, mockNotificationService } =
        setup();
      const promise = service.sync();
      httpTestingController
        .expectOne('/api/withings/sync')
        .error(new ProgressEvent(''));
      await promise;
      httpTestingController.verify();
      expect(mockNotificationService.showNotification).toHaveBeenCalledWith(
        'Unable to sync with Withings',
        'error'
      );
    });

    it('should redirect on 401 with oauth2Login link', async () => {
      const { service, httpTestingController, mockNotificationService } =
        setup();

      const originalHref = window.location.href;
      spyOnProperty(window, 'location', 'get').and.returnValue({
        ...window.location,
        set href(value: string) {},
        get href() {
          return originalHref;
        },
      } as Location);

      const promise = service.sync();
      const syncRequest = httpTestingController.expectOne('/api/withings/sync');
      syncRequest.flush(
        { _links: { oauth2Login: { href: '/api/withings/authorize?token=test-token' } } },
        { status: 401, statusText: 'Unauthorized' }
      );

      await promise;
      httpTestingController.verify();
      expect(mockNotificationService.showNotification).not.toHaveBeenCalled();
    });

    it('caches last backup time', async () => {
      const { service, httpTestingController } = setup();
      const promise1 = service.sync();
      const promise2 = service.sync();
      const request = httpTestingController.expectOne('/api/withings/sync');
      expect(request.request.method).toBe('POST');
      request.flush({});
      await promise1;
      await promise2;
      httpTestingController.verify();
    });
  });
});
