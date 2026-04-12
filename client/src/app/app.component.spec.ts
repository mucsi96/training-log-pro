import { Component, Directive, Input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { AppComponent } from './app.component';
import { NotificationService } from './common-components/notification.service';
import { provideHttpClient } from '@angular/common/http';
import {
  IsActiveMatchOptions,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { AuthService } from './auth/auth.service';

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
  const mockAuthService: jasmine.SpyObj<AuthService> = jasmine.createSpyObj([
    'isSignedIn',
    'getUserName',
    'signin',
    'signout',
  ]);
  mockAuthService.getUserName.and.returnValue(of('Igor'));
  mockAuthService.isSignedIn.and.returnValue(of(true));

  await TestBed.configureTestingModule({
    providers: [
      provideNoopAnimations(),
      provideHttpClient(),
      NotificationService,
      { provide: AuthService, useValue: mockAuthService },
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
    expect(element.querySelector('header h1')?.textContent).toBe('W6');
  });

});
