import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError } from 'rxjs';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const snackBar = inject(MatSnackBar);
  return next(req).pipe(
    catchError((error) => {
      if (error.status !== 401) {
        snackBar.open('An error occurred. ' + error.message, 'Close', {
          duration: 3000,
          verticalPosition: 'top',
          panelClass: ['error'],
        });
      }

      return Promise.reject(error);
    })
  );
};
