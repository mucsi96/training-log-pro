import { TestBed } from '@angular/core/testing';

import { Directive, Input } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { EChartsOption } from 'echarts';
import { NgxEchartsDirective, NgxEchartsModule } from 'ngx-echarts';
import { of } from 'rxjs';
import { WeightComponent } from './weight.component';
import { WeightMeasurement, WeightService } from './weight.service';

@Directive({
  standalone: true,
  selector: '[echarts]',
})
class MockECharts {
  @Input()
  options?: EChartsOption;

  @Input()
  initOpts?: NgxEchartsDirective['initOpts'];
}

const periodMeasurements: WeightMeasurement[] = [
  {
    date: new Date('2020-05-05T00:00:00.000Z'),
    weight: 109.044,
    fatMassWeight: 20.286,
    fatRatio: 28.732,
  },
  { date: new Date('2020-05-07T00:00:00.000Z'), weight: 108.3 },
  {
    date: new Date('2020-05-10T00:00:00.000Z'),
    weight: 108.9,
    fatMassWeight: 21.3,
    fatRatio: 31,
  },
];

async function setup({ period }: { period?: number } = {}) {
  const mockActivatedRoute = { data: of({ period }) };
  const mockWeightService: jasmine.SpyObj<WeightService> =
    jasmine.createSpyObj(['getWeight', 'getTodayWeight']);
  mockWeightService.getWeight.and.returnValue(
    Promise.resolve(periodMeasurements)
  );
  mockWeightService.getTodayWeight.and.returnValue(
    Promise.resolve({
      date: new Date(),
      weight: 108.9,
      fatMassWeight: 21.3,
      fatRatio: 31,
    })
  );
  await TestBed.configureTestingModule({
    providers: [
      { provide: WeightService, useValue: mockWeightService },
      { provide: ActivatedRoute, useValue: mockActivatedRoute },
    ],
  }).compileComponents();

  TestBed.overrideComponent(WeightComponent, {
    remove: {
      imports: [NgxEchartsModule],
    },
    add: {
      imports: [MockECharts],
    },
  });

  const fixture = TestBed.createComponent(WeightComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();

  return {
    fixture,
    element: fixture.nativeElement as HTMLElement,
    mockWeightService,
  };
}

describe('WeightComponent', () => {
  it('renders weight', async () => {
    const { element } = await setup();
    const valueElements = element.querySelectorAll('h2 + *');
    expect(valueElements[0].textContent?.trim()).toEqual('108.9 kg');
    expect(valueElements[1].textContent?.trim()).toEqual('21.3 kg');
    expect(valueElements[2].textContent?.trim()).toEqual('31 %');
  });

  it('renders weight diff', async () => {
    const { element } = await setup();
    const valueElements = element.querySelectorAll('h2 + * + *');
    expect(valueElements[0].textContent?.trim()).toEqual('↓ 0.1 %');
    expect(valueElements[1].textContent?.trim()).toEqual('↑ 5 %');
    expect(valueElements[2].textContent?.trim()).toEqual('↑ 7.9 %');
  });

  it('fetches weight meausrements with week period', async () => {
    const { mockWeightService } = await setup({
      period: 7,
    });
    expect(mockWeightService.getWeight).toHaveBeenCalledWith(7);
  });

  it('renders weight chart', async () => {
    const { fixture } = await setup();
    expect(
      fixture.debugElement
        .query(By.directive(MockECharts))
        .injector.get(MockECharts).options?.dataset
    ).toEqual({
      source: [
        ['date', 'weight'],
        [periodMeasurements[0].date, periodMeasurements[0].weight],
        [periodMeasurements[1].date, periodMeasurements[1].weight],
        [periodMeasurements[2].date, periodMeasurements[2].weight],
      ],
    });
  });
});
