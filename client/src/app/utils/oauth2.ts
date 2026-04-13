import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export function handleOAuth2Redirect(
  http: HttpClient,
  authorizeUrl: string,
  authTokenUrl: string,
  mockAuth: boolean
): void {
  if (mockAuth) {
    window.location.href = authorizeUrl;
    return;
  }

  firstValueFrom(
    http.post<{ token: string }>(authTokenUrl, null)
  ).then(({ token }) => {
    const url = new URL(authorizeUrl);
    url.searchParams.set('auth_token', token);
    window.location.href = url.toString();
  });
}
