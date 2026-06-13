import { Router } from 'express';
import { getConfigValues, updateConfigValues } from '../../controllers/config.controller';

const router = Router();

router.get('/values', getConfigValues);
router.put('/values', updateConfigValues);

export default router;
