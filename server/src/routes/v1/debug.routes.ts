import { Router } from 'express';
import { getDebugProviders } from '../../controllers/debug.controller';

const router = Router();

router.get('/providers', getDebugProviders);

export default router;
