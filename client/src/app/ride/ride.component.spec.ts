import { TestBed } from '@angular/core/testing';

import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { RideComponent } from './ride.component';
import { RideService } from './ride.service';

async function setup({ period }: { period?: number } = {}) {
  const mockActivatedRoute = { data: of({ period }) };
  const mockRideService: jasmine.SpyObj<RideService> = jasmine.createSpyObj([
    'getRideStats',
  ]);
  mockRideService.getRideStats.and.callFake((period = 7) =>
    Promise.resolve({
      calories: period * 646,
      elevationGain: period * 408,
      distance: period * 11747.7,
      time: period * 3074,
    })
  );
  await TestBed.configureTestingModule({
    providers: [
      { provide: ActivatedRoute, useValue: mockActivatedRoute },
      { provide: RideService, useValue: mockRideService },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(RideComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();

  return {
    fixture,
    element: fixture.nativeElement as HTMLElement,
  };
}

describe('RideComponent', () => {
  it('renders today ride stats', async () => {
    const { element } = await setup();
    const valueElements = element.querySelectorAll('h2 + *');
    expect(valueElements[0].textContent?.trim()).toEqual('646');
    expect(valueElements[1].textContent?.trim()).toEqual('408 m');
    expect(valueElements[2].textContent?.trim()).toEqual('12 km');
    expect(valueElements[3].textContent?.trim()).toEqual('51 min');
  });

  it('renders period ride stats', async () => {
    const { element } = await setup();
    const valueElements = element.querySelectorAll('h2 + * + *');
    expect(valueElements[0].textContent?.trim()).toEqual('4 522');
    expect(valueElements[1].textContent?.trim()).toEqual('2 856 m');
    expect(valueElements[2].textContent?.trim()).toEqual('82 km');
    expect(valueElements[3].textContent?.trim()).toEqual('5 h 59 min');
  });

  it('fetches weight meausrements with month period', async () => {
    const { element } = await setup({
      period: 30,
    });
    const valueElements = element.querySelectorAll('h2 + * + *');
    expect(valueElements[0].textContent?.trim()).toEqual('19 380');
    expect(valueElements[1].textContent?.trim()).toEqual('12 240 m');
    expect(valueElements[2].textContent?.trim()).toEqual('352 km');
    expect(valueElements[3].textContent?.trim()).toEqual('25 h 37 min');
  });
});
