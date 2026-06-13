import { Router } from 'express';
import { providerRegistry } from '../../provider/registry';

const router = Router();

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    elara: 'khanhromvn/elara',
    timestamp: new Date().toISOString(),
  });
});

// Route modules
import chatRouter from './chat.routes';
import accountRouter from './account.routes';
import providerRouter from './provider.routes';
import messagesRouter from './messages.routes';
import debugRouter from './debug.routes';
import configRouter from './config.routes';
import modelRouter from './model.routes';
import modelSequencesRouter from './model-sequences.routes';
import statsRouter from './stats.routes';
import workspaceRouter from './workspace.routes';
import gitRouter from './git.routes';
import commandRouter from './command.routes';
import proxyRouter from './proxy.routes';

// Mount routes
router.use('/chat', chatRouter);
router.use('/accounts', accountRouter);
router.use('/providers', providerRouter);
router.use('/messages', messagesRouter);
router.use('/debug', debugRouter);
router.use('/config', configRouter);
router.use('/models', modelRouter);
router.use('/model-sequences', modelSequencesRouter);
router.use('/stats', statsRouter);
router.use('/workspaces', workspaceRouter);
router.use('/git', gitRouter);
router.use('/commands', commandRouter);
router.use('/proxy', proxyRouter);

providerRegistry.registerAllRoutes(router);

export default router;
