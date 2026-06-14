import express from 'express';
import multer from 'multer';
import { uploadFileController } from '../../controllers/upload.controller';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/accounts/:accountId/uploads', upload.single('file'), uploadFileController);

export default router;