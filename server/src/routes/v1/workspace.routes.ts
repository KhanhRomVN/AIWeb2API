import { Router } from 'express';
import { workspaceService } from '../../services/workspace.service';
import { scannerService } from '../../services/scanner.service';

const router = Router();

router.get('/list', async (req, res) => {
  try {
    const workspaces = await workspaceService.listWorkspaces();
    res.json(workspaces);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/link', async (req, res) => {
  try {
    const { folderPath } = req.body;
    const workspace = await workspaceService.findOrCreateWorkspace(folderPath);
    res.json(workspace);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/unlink/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await workspaceService.unlinkWorkspace(id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/context/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const context = await workspaceService.getContextFiles(id);
    res.json(context);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/context/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { type, content } = req.body;
    await workspaceService.updateContextFile(id, type, content);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/summary/:workspaceId/:conversationId', async (req, res) => {
  try {
    const { workspaceId, conversationId } = req.params;
    const summary = await workspaceService.getConversationSummary(
      workspaceId,
      conversationId,
    );
    res.json(summary);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/summary/:workspaceId/:conversationId', async (req, res) => {
  try {
    const { workspaceId, conversationId } = req.params;
    const { content } = req.body;
    await workspaceService.updateConversationSummary(
      workspaceId,
      conversationId,
      content,
    );
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/sessions/:workspaceId/:conversationId', async (req, res) => {
  try {
    const { workspaceId, conversationId } = req.params;
    const data = req.body;
    await workspaceService.createSessionFile(workspaceId, conversationId, data);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/sessions/:workspaceId', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const sessions = await workspaceService.getSessions(workspaceId);
    res.json(sessions);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/scan', async (req, res) => {
  try {
    const { folderPath } = req.body;
    const tree = await (scannerService as any).generateTreeView(folderPath);
    res.json(tree);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
