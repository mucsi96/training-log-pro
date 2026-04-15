import express from 'express';
import { authorize } from './authorize';
import { getAccessToken } from './getAccessToken';
import { measure } from './measure';

const app = express();

app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  if (req.path !== '/health') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

// https://developer.withings.com/api-reference/
app.get('/withings/oauth2_user/authorize2', authorize);
app.post('/withings/v2/oauth2', getAccessToken);
app.post('/withings/measure', measure);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Mock Withings server listening on port ${port}`);
});
