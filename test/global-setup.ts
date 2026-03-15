import { cleanupDb, populateOAuthClients } from './utils';

async function globalSetup() {
  await cleanupDb();
  await populateOAuthClients();
}

export default globalSetup;
