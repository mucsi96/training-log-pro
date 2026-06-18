import express from 'express';
import { createMessage } from './messages';

const app = express();

app.use(express.json({ limit: '5mb' }));

app.use((req, res, next) => {
  if (req.path !== '/health') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

// Anthropic Messages API endpoint
app.post('/anthropic/v1/messages', createMessage);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const port = process.env.PORT || 3082;
app.listen(port, () => {
  console.log(`Mock Anthropic server listening on port ${port}`);
});
