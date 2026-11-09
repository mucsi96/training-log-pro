import { http, HttpResponse } from 'msw';
import { setupWorker } from 'msw/browser';
import { rideMocks } from './ride';
import { weightMocks } from './weight';

export const mocks = [
  http.get('/db/last-backup-time', () =>
    HttpResponse.json(new Date(Date.now() - 5 * 60 * 1000))
  ),
  http.post('/api/withings/sync', () => new HttpResponse()),
  http.post('/api/strava/activities/sync', () => new HttpResponse()),
  ...rideMocks,
  ...weightMocks,
];

const worker = setupWorker(...mocks);
worker.start({
  onUnhandledRequest: 'bypass',
});
