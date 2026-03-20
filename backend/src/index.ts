import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

import app from './app.js';
import { logger } from './lib/logger.js';
import { checkConnection } from './lib/db.js';

const port = Number(process.env.PORT) || 8000;

async function start() {
  const dbOk = await checkConnection();
  if (!dbOk) {
    logger.error('Cannot connect to PostgreSQL. Check DATABASE_URL in .env');
    process.exit(1);
  }
  logger.info('Database connection verified');

  app.listen(port, () => {
    logger.info({ port }, 'RisetBot API server listening');
  });
}

start().catch((err) => {
  logger.error({ err }, 'Failed to start server');
  process.exit(1);
});
