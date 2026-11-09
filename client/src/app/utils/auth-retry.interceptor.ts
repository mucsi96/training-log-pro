import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, NEVER, throwError } from 'rxjs';
import { AuthService } from '../auth.service';

export const authRetryInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const url = new URL(req.url, window.location.origin);
  return next(req).pipe(catchError((error: unknown) => {
    if (error instanceof HttpErrorResponse && error.status === 401 &&
        url.origin === window.location.origin && url.pathname.startsWith('/api/') &&
        !error.error?._links?.oauth2Login?.href) {
      auth.login();
      return NEVER;
    }
    return throwError(() => error);
  }));
};
