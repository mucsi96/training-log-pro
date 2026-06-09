import { Request, Response } from 'express';

type Forecast = {
  precipitationMm: number;
  temperatureC: number;
};

function defaultForecast(): Forecast {
  // Dry and mild by default.
  return { precipitationMm: 0, temperatureC: 18 };
}

let forecast: Forecast = defaultForecast();

// Mimics Open-Meteo GET /weather/v1/forecast. Returns 24 identical hourly points
// derived from the configured single-value forecast.
export function getForecast(_req: Request, res: Response) {
  const time: string[] = [];
  const precipitation: number[] = [];
  const temperature: number[] = [];
  for (let hour = 0; hour < 24; hour++) {
    time.push(`2026-06-09T${String(hour).padStart(2, '0')}:00`);
    precipitation.push(forecast.precipitationMm);
    temperature.push(forecast.temperatureC);
  }
  res.json({
    hourly: {
      time,
      precipitation,
      temperature_2m: temperature,
    },
  });
}

export function setForecast(req: Request, res: Response) {
  forecast = {
    precipitationMm: req.body?.precipitationMm ?? 0,
    temperatureC: req.body?.temperatureC ?? 18,
  };
  res.json({ status: 'ok' });
}

export function reset(_req: Request, res: Response) {
  forecast = defaultForecast();
  res.json({ status: 'ok' });
}
