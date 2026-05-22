import { Router } from 'express';
import { gitService } from '../../services/git.service';

const router = Router();

router.post('/status', async (req, res) => {
  try {
    const { repoPath } = req.body;
    const status = await gitService.getStatus(repoPath);
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/diff-stats', async (req, res) => {
  try {
    const { repoPath } = req.body;
    const stats = await gitService.getDiffNumStat(repoPath);
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/add', async (req, res) => {
  try {
    const { repoPath, files } = req.body;
    await gitService.add(repoPath, files);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/commit', async (req, res) => {
  try {
    const { repoPath, message } = req.body;
    await gitService.commit(repoPath, message);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/diff', async (req, res) => {
  try {
    const { repoPath, staged } = req.body;
    const diff = await gitService.getDiff(repoPath, staged);
    res.json(diff);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/push', async (req, res) => {
  try {
    const { repoPath } = req.body;
    await gitService.push(repoPath);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
