import { HttpResponse, http } from 'msw';
import { weightMeasurements } from './weightMeasurements';

export const weightMocks = [
  http.get('/api/weight', ({ request }) => {
    const url = new URL(request.url);
    const period = parseInt(url.searchParams.get('period') ?? '0');

    if (!period) {
      return HttpResponse.json({ measurements: weightMeasurements });
    }

    const today = weightMeasurements.slice(-1)[0].date;
    const cutDate = today.getTime() - period * 1000 * 60 * 60 * 24;
    const measurements = weightMeasurements.filter(
      ({ date }) => date.getTime() >= cutDate
    );
    const beforeRange = weightMeasurements.filter(
      ({ date }) => date.getTime() < cutDate
    );
    const baseline = beforeRange[beforeRange.length - 1];

    return HttpResponse.json({ measurements, ...(baseline && { baseline }) });
  }),
];
