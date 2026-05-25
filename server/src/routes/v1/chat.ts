import express from 'express';
import multer from 'multer';
import {
  sendMessageController,
  completionController,
} from '../../controllers/chat.controller';
import { uploadFileController } from '../../controllers/upload.controller';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/accounts/messages', sendMessageController);
router.post('/accounts/:accountId/messages', sendMessageController);
router.post(
  '/accounts/:accountId/uploads',
  upload.single('file'),
  uploadFileController,
);

router.post('/completions', completionController);

export default router;
