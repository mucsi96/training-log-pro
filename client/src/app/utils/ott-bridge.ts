import { HttpClient } from '@angular/common/http';
import { fetchJson } from './fetchJson';

export async function requestOttAndRedirect(
  http: HttpClient,
  authorizeUrl: string
): Promise<void> {
  const { token } = await fetchJson<{ token: string }>(
    http,
    '/api/token-bridge/generate',
    { method: 'post' }
  );
  const separator = authorizeUrl.includes('?') ? '&' : '?';
  window.location.href = `${authorizeUrl}${separator}token=${token}`;
}
