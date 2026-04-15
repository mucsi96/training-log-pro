import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { StravaService } from '../strava/strava.service';
import { RideService, RideStats } from './ride.service';

function setup({ pendingSync = false } = {}) {
  const mockSnackBar: jasmine.SpyObj<MatSnackBar> =
    jasmine.createSpyObj(['open']);
  const mockStravaService: jasmine.SpyObj<StravaService> =
    jasmine.createSpyObj(['sync']);

  if (pendingSync) {
    mockStravaService.sync.and.returnValue(new Promise<void>(() => {}));
  } else {
    mockStravaService.sync.and.returnValue(Promise.resolve());
  }

  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      RideService,
      { provide: MatSnackBar, useValue: mockSnackBar },
      { provide: StravaService, useValue: mockStravaService },
    ],
  });
  const service = TestBed.inject(RideService);
  const httpTestingController = TestBed.inject(HttpTestingController);
  return {
    service,
    httpTestingController,
    mockSnackBar,
  };
}
const mockResponse: RideStats = {
  calories: 646,
  elevationGain: 408,
  distance: 11747.7,
  time: 3074,
};
const mockResponse2: RideStats = {
  calories: 2 * 646,
  elevationGain: 2 * 408,
  distance: 2 * 11747.7,
  time: 2 * 3074,
};

describe('RideService', () => {
  describe('getRideStats', () => {
    it('should sync activities first', () => {
      const { service, httpTestingController } = setup({ pendingSync: true });
      service.getRideStats(30);
      httpTestingController.expectNone('/api/ride/stats?period=30');
      httpTestingController.verify();
    });

    it('should return ride stats for given period', async () => {
      const { service, httpTestingController } = setup();
      const promise = service.getRideStats(30);
      await Promise.resolve();
      httpTestingController
        .expectOne('/api/ride/stats?period=30')
        .flush(mockResponse);
      const result = await promise;
      expect(result).toEqual(mockResponse);
      httpTestingController.verify();
    });

    it('should show notification if fetching ride stats was not succesful', async () => {
      const { service, httpTestingController, mockSnackBar } =
        setup();
      const promise = service.getRideStats(30);
      await Promise.resolve();
      httpTestingController
        .expectOne('/api/ride/stats?period=30')
        .error(new ProgressEvent(''));
      await expectAsync(promise).toBeRejected();
      httpTestingController.verify();
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Unable to fetch ride stats',
        'Close',
        jasmine.objectContaining({ panelClass: ['error'] })
      );
    });

    it('caches ride stats', async () => {
      const { service, httpTestingController } = setup();
      const promise1 = service.getRideStats(30);
      await Promise.resolve();
      httpTestingController
        .expectOne('/api/ride/stats?period=30')
        .flush(mockResponse);
      const result1 = await promise1;
      expect(result1).toEqual(mockResponse);

      const result2 = await service.getRideStats(30);
      expect(result2).toEqual(mockResponse);
      httpTestingController.verify();
    });

    it('caches ride stats for multiple periods', async () => {
      const { service, httpTestingController } = setup();
      const promise1 = service.getRideStats(10);
      await Promise.resolve();
      httpTestingController
        .expectOne('/api/ride/stats?period=10')
        .flush(mockResponse);
      const result1 = await promise1;
      expect(result1).toEqual(mockResponse);

      const promise2 = service.getRideStats(30);
      await Promise.resolve();
      httpTestingController
        .expectOne('/api/ride/stats?period=30')
        .flush(mockResponse2);
      const result2 = await promise2;
      expect(result2).toEqual(mockResponse2);

      const result3 = await service.getRideStats(10);
      expect(result3).toEqual(mockResponse);

      const result4 = await service.getRideStats(30);
      expect(result4).toEqual(mockResponse2);

      httpTestingController.verify();
    });
  });
});
