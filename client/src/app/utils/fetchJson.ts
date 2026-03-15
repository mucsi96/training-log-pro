import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export function fetchJson<T>(http: HttpClient, url: string): Promise<T> {
  return firstValueFrom(http.get<T>(url));
}
