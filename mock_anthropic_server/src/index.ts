import express from 'express';
import { createMessage, reset, setExtraction, setPlan } from './messages';

const app = express();

app.use(express.json({ limit: '25mb' }));

app.use((req, res, next) => {
  if (req.path !== '/health') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

// Anthropic Messages API
app.post('/anthropic/v1/messages', createMessage);

// Test-only endpoints
app.post('/anthropic/test/extraction', setExtraction);
app.post('/anthropic/test/plan', setPlan);
app.post('/anthropic/test/reset', reset);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const port = process.env.PORT || 3082;
app.listen(port, () => {
  console.log(`Mock Anthropic server listening on port ${port}`);
});
