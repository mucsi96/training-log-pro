const { Client } = require('pg');

// Clear credentials before starting the scheduler: a refresh of credentials
// left by the browser suite could otherwise race the first test's setup.
const client = new Client({
  host: 'localhost', port: 5480, database: 'test',
  user: 'postgres', password: 'postgres',
});

(async () => {
  await client.connect();
  try {
    await client.query('DELETE FROM training_log.oauth2_authorized_client');
  } finally {
    await client.end();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
