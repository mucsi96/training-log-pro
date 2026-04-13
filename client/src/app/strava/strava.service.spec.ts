import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NotificationService } from '../common-components/notification.service';
import { WithingsService } from '../withings/withings.service';
import { ENVIRONMENT_CONFIG } from '../environment/environment.config';
import { StravaService } from './strava.service';

function setup() {
  const mockNotificationService: jasmine.SpyObj<NotificationService> =
    jasmine.createSpyObj(['showNotification']);
  const mockWithingsService: jasmine.SpyObj<WithingsService> =
    jasmine.createSpyObj(['sync']);

  mockWithingsService.sync.and.returnValue(Promise.resolve());

  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      StravaService,
      { provide: NotificationService, useValue: mockNotificationService },
      { provide: WithingsService, useValue: mockWithingsService },
      { provide: ENVIRONMENT_CONFIG, useValue: { mockAuth: true } },
    ],
  });
  const service = TestBed.inject(StravaService);
  const httpTestingController = TestBed.inject(HttpTestingController);
  return { service, httpTestingController, mockNotificationService };
}

describe('StravaService', () => {
  describe('sync', () => {
    it('should sync with Strava', async () => {
      const { service, httpTestingController } = setup();
      const promise = service.sync();
      await Promise.resolve();
      const request = httpTestingController.expectOne(
        '/api/strava/activities/sync'
      );
      expect(request.request.method).toBe('POST');
      request.flush({});
      await promise;
      httpTestingController.verify();
    });

    it('should show notification if fetching last backup was not succesful', async () => {
      const { service, httpTestingController, mockNotificationService } =
        setup();
      const promise = service.sync();
      await Promise.resolve();
      httpTestingController
        .expectOne('/api/strava/activities/sync')
        .error(new ProgressEvent(''));
      await promise;
      httpTestingController.verify();
      expect(mockNotificationService.showNotification).toHaveBeenCalledWith(
        'Unable to sync with Strava',
        'error'
      );
    });

    it('caches last backup time', async () => {
      const { service, httpTestingController } = setup();
      const promise1 = service.sync();
      const promise2 = service.sync();
      await Promise.resolve();
      const request = httpTestingController.expectOne(
        '/api/strava/activities/sync'
      );
      expect(request.request.method).toBe('POST');
      request.flush({});
      await promise1;
      await promise2;
      httpTestingController.verify();
    });
  });
});
