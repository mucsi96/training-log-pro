import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { WithingsService } from '../withings/withings.service';
import { StravaService } from './strava.service';

function setup() {
  const mockSnackBar: jasmine.SpyObj<MatSnackBar> =
    jasmine.createSpyObj(['open']);
  const mockWithingsService: jasmine.SpyObj<WithingsService> =
    jasmine.createSpyObj(['sync']);

  mockWithingsService.sync.and.returnValue(Promise.resolve());

  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      StravaService,
      { provide: MatSnackBar, useValue: mockSnackBar },
      { provide: WithingsService, useValue: mockWithingsService },
    ],
  });
  const service = TestBed.inject(StravaService);
  const httpTestingController = TestBed.inject(HttpTestingController);
  return { service, httpTestingController, mockSnackBar };
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
      const { service, httpTestingController, mockSnackBar } =
        setup();
      const promise = service.sync();
      await Promise.resolve();
      httpTestingController
        .expectOne('/api/strava/activities/sync')
        .error(new ProgressEvent(''));
      await promise;
      httpTestingController.verify();
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Unable to sync with Strava',
        'Close',
        jasmine.objectContaining({ panelClass: ['error'] })
      );
    });

    it('should redirect on 401 with oauth2Login link', async () => {
      const { service, httpTestingController, mockSnackBar } =
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
      await Promise.resolve();
      const syncRequest = httpTestingController.expectOne(
        '/api/strava/activities/sync'
      );
      syncRequest.flush(
        { _links: { oauth2Login: { href: '/api/strava/authorize?token=test-token' } } },
        { status: 401, statusText: 'Unauthorized' }
      );

      await promise;
      httpTestingController.verify();
      expect(mockSnackBar.open).not.toHaveBeenCalled();
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
