import { Router } from 'express';
import { getAllModels } from '../../controllers/models.controller';

const router = Router();

router.get('/', getAllModels);

export default router;
