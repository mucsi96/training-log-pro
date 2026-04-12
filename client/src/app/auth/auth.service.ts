import { LocationStrategy } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import {
  BehaviorSubject,
  catchError,
  map,
  of,
  shareReplay,
  switchMap,
  tap,
} from 'rxjs';
import { RouterTokens } from '../app.routes';

type UserInfo = { sub: string; name: string; groups: string[] };

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly locationStrategy = inject(LocationStrategy);

  redirectUri =
    location.origin +
    this.locationStrategy.prepareExternalUrl(
      RouterTokens.SIGNIN_REDIRECT_CALLBACK
    );
  signinsAndSignouts = new BehaviorSubject<RouterTokens[] | undefined>(
    undefined
  );
  $userInfo = this.signinsAndSignouts.asObservable().pipe(
    switchMap((nextRoute) =>
      this.http.get<UserInfo>('/api/auth/user-info').pipe(
        catchError(() => {
          return of({} as UserInfo);
        }),
        tap(() => nextRoute && this.router.navigate(nextRoute))
      )
    ),
    shareReplay(1)
  );

  getUserInfo() {
    return this.$userInfo;
  }

  async signin() {
    this.http
      .post<{
        authorizationUrl: string;
      }>('/api/auth/authorize', { redirectUri: this.redirectUri })
      .subscribe(({ authorizationUrl }) => {
        location.href = authorizationUrl;
      });
  }

  async handleSigninRedirectCallback() {
    this.http
      .post<void>('/api/auth/get-token', {
        callbackUrl: location.href.toString(),
        redirectUri: this.redirectUri,
      })
      .subscribe(() => this.signinsAndSignouts.next([RouterTokens.WEEK]));
  }

  isSignedIn() {
    return this.getUserInfo().pipe(map((userInfo) => !!userInfo.sub));
  }

  getUserName() {
    return this.getUserInfo().pipe(map((userInfo) => userInfo.name));
  }

  getRoles() {
    return this.getUserInfo().pipe(
      map((userInfo) => (userInfo.groups ?? []) as string[])
    );
  }

  hasRole(role: string) {
    return this.getRoles().pipe(map((roles) => roles.includes(role)));
  }

  signout() {
    this.http
      .post('/api/auth/logout', {})
      .subscribe(() => this.signinsAndSignouts.next([RouterTokens.SIGNIN]));
  }
}
