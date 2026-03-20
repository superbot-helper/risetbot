import { Router, type IRouter } from 'express';
import { checkConnection } from '../lib/db.js';

const router: IRouter = Router();

router.get('/healthz', async (_req, res) => {
  const dbOk = await checkConnection();
  res.json({ status: dbOk ? 'ok' : 'degraded', database: dbOk });
});

export default router;
