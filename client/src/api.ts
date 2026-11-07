import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNotifications } from '@mucsi96/react-ui';
import { z } from 'zod';
import { emptySchema } from './schemas';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: Infinity, refetchOnWindowFocus: false },
    mutations: { retry: false },
  },
});
const authorizationSchema = z.object({ _links: z.object({ oauth2Login: z.object({ href: z.url() }) }) });
class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown
  ) {
    super(`Request failed (${status})`);
  }
}

export async function fetchJson<T>(path: string, schema: z.ZodType<T>, init: RequestInit = {}): Promise<T> {
  const url = new URL(path, window.location.origin);
  if (url.origin !== window.location.origin) throw new Error('API requests must be same-origin');
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  headers.set('X-Timezone', Intl.DateTimeFormat().resolvedOptions().timeZone);
  if (typeof init.body === 'string') headers.set('Content-Type', 'application/json');
  if (!['GET', 'HEAD', 'OPTIONS'].includes((init.method ?? 'GET').toUpperCase())) {
    const cookieName = location.protocol === 'https:' ? '__Host-XSRF-TOKEN' : 'XSRF-TOKEN';
    const token = document.cookie
      .split(';')
      .map((value) => value.trim())
      .find((value) => value.startsWith(`${cookieName}=`))
      ?.slice(cookieName.length + 1);
    if (!token) throw new Error('Missing CSRF token');
    headers.set('X-XSRF-TOKEN', decodeURIComponent(token));
  }
  const response = await fetch(url, { ...init, headers, credentials: 'same-origin' });
  const text = await response.text();
  const body: unknown = text && response.headers.get('content-type')?.includes('json') ? JSON.parse(text) : undefined;
  if (!response.ok) {
    if (response.status === 401 && !authorizationSchema.safeParse(body).success) {
      location.assign(`/oauth2/start?rd=${encodeURIComponent(location.pathname + location.search + location.hash)}`);
      return new Promise(() => {});
    }
    throw new ApiError(response.status, body);
  }
  return schema.parse(body);
}

// Sync once per document, in provider order. Cached query promises also deduplicate
// concurrent dashboard requests; an explicit retry starts a failed sync again.
async function syncProvider(provider: 'withings' | 'strava'): Promise<void> {
  if (provider === 'strava') await syncProvider('withings');
  await queryClient.fetchQuery({
    queryKey: ['sync', provider],
    gcTime: Infinity,
    queryFn: async () => {
      const guard = `${provider}-authorize-redirected`;
      try {
        await fetchJson(provider === 'strava' ? '/api/strava/activities/sync' : '/api/withings/sync', emptySchema, {
          method: 'POST',
        });
        sessionStorage.removeItem(guard);
        return true;
      } catch (error) {
        const authorization =
          error instanceof ApiError && error.status === 401 ? authorizationSchema.safeParse(error.body) : undefined;
        if (authorization?.success) {
          if (sessionStorage.getItem(guard))
            throw new Error(
              `Unable to authorize ${provider === 'strava' ? 'Strava' : 'Withings'}. Please try again later.`,
              { cause: error }
            );
          sessionStorage.setItem(guard, '1');
          location.assign(authorization.data._links.oauth2Login.href);
          await new Promise(() => {});
        }
        throw error;
      }
    },
  });
}

export function useApi<T>(path: string, schema: z.ZodType<T>, provider?: 'strava' | 'withings') {
  return useQuery({
    queryKey: [path],
    queryFn: async ({ signal }) => {
      if (provider) await syncProvider(provider);
      return fetchJson(path, schema, { signal });
    },
  });
}

export function useAction<V, T>(
  action: (value: V) => Promise<T>,
  paths: string[],
  message?: string,
  errorMessage?: string
) {
  const client = useQueryClient();
  const notifications = useNotifications();
  return useMutation({
    mutationFn: action,
    onSuccess: async () => {
      await client.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === 'string' && paths.some((path) => (query.queryKey[0] as string).startsWith(path)),
      });
      if (message) notifications.success(message);
    },
    onError: (error) => notifications.error(errorMessage ?? error.message),
  });
}

export const send = <T>(path: string, schema: z.ZodType<T>, method: string, body?: unknown) =>
  fetchJson(path, schema, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
export const periodPath = (path: string, period: number) => (period ? `${path}?period=${period}` : path);
