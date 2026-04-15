import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { WithingsService } from '../withings/withings.service';
import { WeightMeasurement, WeightService } from './weight.service';

function setup({ pendingSync = false } = {}) {
  const mockSnackBar: jasmine.SpyObj<MatSnackBar> =
    jasmine.createSpyObj(['open']);
  const mockWithingsService: jasmine.SpyObj<WithingsService> =
    jasmine.createSpyObj(['sync']);

  if (pendingSync) {
    mockWithingsService.sync.and.returnValue(new Promise<void>(() => {}));
  } else {
    mockWithingsService.sync.and.returnValue(Promise.resolve());
  }

  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      WeightService,
      {
        provide: MatSnackBar,
        useValue: mockSnackBar,
      },
      {
        provide: WithingsService,
        useValue: mockWithingsService,
      },
    ],
  });
  const service = TestBed.inject(WeightService);
  const httpTestingController = TestBed.inject(HttpTestingController);
  return {
    service,
    httpTestingController,
    mockSnackBar,
  };
}

const mockResponse: WeightMeasurement[] = [
  { date: new Date('2020-05-05T00:00:00.000Z'), weight: 108.9 },
  { date: new Date('2020-05-07T00:00:00.000Z'), weight: 108.3 },
  {
    date: new Date('2020-05-10T00:00:00.000Z'),
    weight: 107.8,
    fatRatio: 31.04,
    fatMassWeight: 21.34,
  },
];

const mockResponse2: WeightMeasurement[] = [
  { date: new Date('2020-03-05T00:00:00.000Z'), weight: 109.9 },
  { date: new Date('2020-03-07T00:00:00.000Z'), weight: 109.1 },
  { date: new Date('2020-05-05T00:00:00.000Z'), weight: 108.9 },
  { date: new Date('2020-05-07T00:00:00.000Z'), weight: 108.3 },
  {
    date: new Date('2020-05-10T00:00:00.000Z'),
    weight: 107.8,
    fatRatio: 31.04,
    fatMassWeight: 21.34,
  },
];

describe('WeightService', () => {
  describe('getWeight', () => {
    it('should return weight', async () => {
      const { service, httpTestingController } = setup();
      const promise = service.getWeight(7);
      await Promise.resolve();
      httpTestingController
        .expectOne('/api/weight?period=7')
        .flush(mockResponse);
      const result = await promise;
      expect(result).toEqual(mockResponse);
      httpTestingController.verify();
    });

    it('should sync measurements first', () => {
      const { service, httpTestingController } = setup({ pendingSync: true });
      service.getWeight(7);
      httpTestingController.expectNone('/api/weight?period=7');
      httpTestingController.verify();
    });

    it('should show notification if fetching weight measurements was not succesful', async () => {
      const { service, httpTestingController, mockSnackBar } =
        setup();
      const promise = service.getWeight(7);
      await Promise.resolve();
      httpTestingController
        .expectOne('/api/weight?period=7')
        .error(new ProgressEvent(''));
      await expectAsync(promise).toBeRejected();
      httpTestingController.verify();
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Unable to fetch weight',
        'Close',
        jasmine.objectContaining({ panelClass: ['error'] })
      );
    });

    it('caches weight measurements', async () => {
      const { service, httpTestingController } = setup();
      const promise1 = service.getWeight(7);
      await Promise.resolve();
      httpTestingController
        .expectOne('/api/weight?period=7')
        .flush(mockResponse);
      const result1 = await promise1;
      expect(result1).toEqual(mockResponse);

      const result2 = await service.getWeight(7);
      expect(result2).toEqual(mockResponse);
      httpTestingController.verify();
    });

    it('caches weight measurements for multiple periods', async () => {
      const { service, httpTestingController } = setup();
      const promise1 = service.getWeight(10);
      await Promise.resolve();
      httpTestingController
        .expectOne('/api/weight?period=10')
        .flush(mockResponse);
      const result1 = await promise1;
      expect(result1).toEqual(mockResponse);

      const promise2 = service.getWeight(30);
      await Promise.resolve();
      httpTestingController
        .expectOne('/api/weight?period=30')
        .flush(mockResponse2);
      const result2 = await promise2;
      expect(result2).toEqual(mockResponse2);

      const result3 = await service.getWeight(10);
      expect(result3).toEqual(mockResponse);

      const result4 = await service.getWeight(30);
      expect(result4).toEqual(mockResponse2);

      httpTestingController.verify();
    });
  });

  describe('getTodayWeight', () => {
    it('should return todays weight', async () => {
      const { service, httpTestingController } = setup();
      const promise = service.getTodayWeight();
      await Promise.resolve();
      httpTestingController
        .expectOne('/api/weight?period=1')
        .flush([mockResponse.at(-1)]);
      const result = await promise;
      expect(result).toEqual(mockResponse.at(-1));
      httpTestingController.verify();
    });

    it('should return last todays weight', async () => {
      const { service, httpTestingController } = setup();
      const promise = service.getTodayWeight();
      await Promise.resolve();
      httpTestingController
        .expectOne('/api/weight?period=1')
        .flush(mockResponse);
      const result = await promise;
      expect(result).toEqual(mockResponse.at(-1));
      httpTestingController.verify();
    });

    it('should return undefined if there was no weight measurements today', async () => {
      const { service, httpTestingController } = setup();
      const promise = service.getTodayWeight();
      await Promise.resolve();
      httpTestingController.expectOne('/api/weight?period=1').flush([]);
      const result = await promise;
      expect(result).toBeUndefined();
      httpTestingController.verify();
    });

    it('should sync measurements first', () => {
      const { service, httpTestingController } = setup({ pendingSync: true });
      service.getTodayWeight();
      httpTestingController.expectNone('/api/weight?period=1');
      httpTestingController.verify();
    });

    it('should show notification if fetching today weight was not succesful', async () => {
      const { service, httpTestingController, mockSnackBar } =
        setup();
      const promise = service.getTodayWeight();
      await Promise.resolve();
      httpTestingController
        .expectOne('/api/weight?period=1')
        .error(new ProgressEvent(''));
      await expectAsync(promise).toBeRejected();
      httpTestingController.verify();
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Unable to fetch weight',
        'Close',
        jasmine.objectContaining({ panelClass: ['error'] })
      );
    });

    it('caches weight measurements', async () => {
      const { service, httpTestingController } = setup();
      const promise1 = service.getTodayWeight();
      await Promise.resolve();
      httpTestingController
        .expectOne('/api/weight?period=1')
        .flush(mockResponse);
      const result1 = await promise1;
      expect(result1).toEqual(mockResponse.at(-1));

      const result2 = await service.getTodayWeight();
      expect(result2).toEqual(mockResponse.at(-1));
      httpTestingController.verify();
    });
  });

  it('caches across getWeight and getTodayWeight functions', async () => {
    const { service, httpTestingController } = setup();
    const promise1 = service.getWeight(1);
    await Promise.resolve();
    const request = httpTestingController.expectOne('/api/weight?period=1');
    expect(request.request.method).toBe('GET');
    request.flush(mockResponse);
    await promise1;

    await service.getTodayWeight();
    httpTestingController.verify();
  });
});
