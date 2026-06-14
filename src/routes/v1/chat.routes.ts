import express from 'express';
import { sendMessageController } from '../../controllers/send-message.controller';

const router = express.Router();

router.post('/accounts/messages', sendMessageController);
router.post('/accounts/:accountId/messages', sendMessageController);

export default router;
