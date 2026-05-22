import { Router } from 'express';
import {
  importAccounts,
  addAccount,
  getAccounts,
  deleteAccount,
  proxyIcon,
  login,
  switchAccount,
} from '../../controllers/account.controller';

const router = Router();

router.post('/import', importAccounts);
router.post('/', addAccount);
router.get('/', getAccounts);
router.delete('/:id', deleteAccount);
router.get('/proxy-icon', proxyIcon);
router.post('/login/:provider', login);
router.post('/:id/switch', switchAccount);

export default router;
