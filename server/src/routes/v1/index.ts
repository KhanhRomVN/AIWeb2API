import { Router } from 'express';
import { providerRegistry } from '../../provider/registry';

const router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    elara: 'khanhromvn/elara',
    timestamp: new Date().toISOString(),
  });
});

// Import route modules
import chatRouter from './chat';
import accountRouter from './account.routes';
import providerRouter from './provider';
import messagesRouter from './messages';
import debugRouter from './debug';
import configRouter from './config';
import modelRouter from './model';
import statsRouter from './stats';

import modelSequencesRouter from './model-sequences';
import workspaceRouter from './workspace.routes';
import gitRouter from './git.routes';
import commandRouter from './command.routes';
import proxyRouter from './proxy.routes';
import claudecodeRouter from './claudecode';

// Register routes
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
router.use('/claudecode', claudecodeRouter);

providerRegistry.registerAllRoutes(router);
export default router;
