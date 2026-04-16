import { Component, Directive, Input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { AppComponent } from './app.component';
import { provideHttpClient } from '@angular/common/http';
import {
  IsActiveMatchOptions,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { ENVIRONMENT_CONFIG } from './environment/environment.config';

@Directive({
  standalone: true,
  selector: '[routerLink]',
})
class MockRouterLink {
  @Input()
  routerLink?: string;
}

@Directive({
  standalone: true,
  selector: '[routerLinkActive]',
})
class MockRouterLinkActive {
  @Input()
  routerLinkActive?: boolean;

  @Input()
  routerLinkActiveOptions?: IsActiveMatchOptions;
}

@Component({
  standalone: true,
  selector: 'router-outlet',
  template: '',
})
class MockRouterOutlet {}

async function setup() {
  await TestBed.configureTestingModule({
    providers: [
      provideNoopAnimations(),
      provideHttpClient(),
      {
        provide: ENVIRONMENT_CONFIG,
        useValue: { mockOAuth2ServerUri: 'http://localhost:8090', tenantId: '', clientId: '', apiClientId: '' },
      },
    ],
  }).compileComponents();

  TestBed.overrideComponent(AppComponent, {
    remove: {
      imports: [RouterOutlet, RouterLink, RouterLinkActive],
    },
    add: {
      imports: [MockRouterOutlet, MockRouterLink, MockRouterLinkActive],
    },
  });

  const fixture = TestBed.createComponent(AppComponent);
  fixture.detectChanges();

  return {
    fixture,
    element: fixture.nativeElement as HTMLElement,
  };
}

describe('AppComponent', () => {
  it('should render header', async () => {
    const { element } = await setup();
    expect(element.querySelector('mat-toolbar nav a')?.textContent?.trim()).toBe('Training Log Pro');
  });
});
