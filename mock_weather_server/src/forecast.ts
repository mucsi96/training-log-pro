import { Request, Response } from 'express';

let precipitationMm = 0;

function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

// Mimics Open-Meteo GET /weather/v1/forecast with daily=precipitation_sum.
// Returns a wide window of days (so any planning date is covered), all carrying
// the currently configured precipitation value.
export function getForecast(_req: Request, res: Response) {
  const time: string[] = [];
  const precipitation_sum: number[] = [];
  for (let offset = -2; offset <= 16; offset++) {
    time.push(isoDate(offset));
    precipitation_sum.push(precipitationMm);
  }
  res.json({ daily: { time, precipitation_sum } });
}

export function setForecast(req: Request, res: Response) {
  precipitationMm = req.body?.precipitationMm ?? 0;
  res.json({ status: 'ok' });
}

export function reset(_req: Request, res: Response) {
  precipitationMm = 0;
  res.json({ status: 'ok' });
}
