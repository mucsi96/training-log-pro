import express from 'express';
import { getForecast, reset, setForecast } from './forecast';

const app = express();

app.use(express.json());

app.use((req, res, next) => {
  if (req.path !== '/health') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

// Open-Meteo forecast API
app.get('/weather/v1/forecast', getForecast);

// Test-only endpoints
app.post('/weather/test/forecast', setForecast);
app.post('/weather/test/reset', reset);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const port = process.env.PORT || 3083;
app.listen(port, () => {
  console.log(`Mock Weather server listening on port ${port}`);
});
