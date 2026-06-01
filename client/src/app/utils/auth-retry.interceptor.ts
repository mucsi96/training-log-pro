import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { catchError, switchMap, tap, throwError } from 'rxjs';

const isApiRequest = (url: string): boolean => /\/api(\/|$)/.test(url);

// Refresh once on 401 (iOS PWA wakes with an expired access token) before surfacing the error.
export const authRetryInterceptor: HttpInterceptorFn = (req, next) => {
  const oidcSecurityService = inject(OidcSecurityService);

  return next(req).pipe(
    catchError((error: unknown) => {
      const is401 = error instanceof HttpErrorResponse && error.status === 401;

      if (!is401 || !isApiRequest(req.url)) {
        return throwError(() => error);
      }

      console.warn(
        '[auth] API request returned 401 - refreshing token via refresh token and retrying',
        JSON.stringify({ url: req.url })
      );

      return oidcSecurityService.forceRefreshSession().pipe(
        tap(() =>
          console.info(
            '[auth] Token refreshed after 401 - retrying original request',
            JSON.stringify({ url: req.url })
          )
        ),
        switchMap(() => next(req))
      );
    })
  );
};
