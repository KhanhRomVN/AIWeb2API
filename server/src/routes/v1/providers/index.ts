import { Router } from 'express';
import { createLogger } from '../../../utils/logger';
import { providers as bundledProviders } from '../../../provider/provider-config';

const logger = createLogger('ProvidersRoute');
const router = Router();

router.get('/', async (req, res) => {
  try {
    res.setHeader('X-Provider-Version', 'local');
    res.json(bundledProviders);

    logger.debug(
      `Served ${bundledProviders.length} providers (version: local)`,
    );
  } catch (error: any) {
    logger.error('Failed to get providers:', error);
    res.status(500).json({
      error: 'Failed to retrieve providers',
      message: error.message,
    });
  }
});

export default router;
