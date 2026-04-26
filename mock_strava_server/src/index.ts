import express from 'express';
import { authorize } from './authorize';
import { getAccessToken } from './getAccessToken';
import { getActivities, getActivity } from './activities';
import { loginPage, login } from './login';
import { fitnessPage, fitnessData } from './fitness';

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use((req, res, next) => {
  if (req.path !== '/health') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

// OAuth2 endpoints
app.get('/strava/oauth/authorize', authorize);
app.post('/strava/oauth/token', getAccessToken);

// API endpoints
app.get('/strava/api/v3/athlete/activities', getActivities);
app.get('/strava/api/v3/activities/:id', getActivity);

// Login and fitness page (Selenium-driven flow)
app.get('/strava/athlete/fitness', fitnessPage);
app.get('/strava/login', loginPage);
app.post('/strava/session', login);
app.get('/strava/fitness/:id', fitnessData);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const port = process.env.PORT || 3081;
app.listen(port, () => {
  console.log(`Mock Strava server listening on port ${port}`);
});
