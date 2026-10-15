/**
 * ------------------------------------------------------------------
 * Proxy Routes
 * ------------------------------------------------------------------
 * Routes cho API quản lý proxy server và certificate.
 *
 * Main routes:
 * - GET    /v1/proxy/config                : Lấy cấu hình proxy
 * - POST   /v1/proxy/config                : Cập nhật cấu hình proxy
 * - GET    /v1/proxy/server-info           : Lấy thông tin server
 * - GET    /v1/proxy/certificate-info      : Lấy thông tin certificate
 * - GET    /v1/proxy/export-certificate    : Export certificate
 * - POST   /v1/proxy/regenerate-certificates : Regenerate certificates
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import { Router } from 'express';

// ── Services ──
import { proxyService } from '../../services/proxy.service';

// ── Utils ──
import { getCertificateManager } from '../../utils/cert-manager';

// ─── Router ─────────────────────────────────────────────────────────────

const router = Router();

router.get('/config', (_req, res) => {
  res.json({ success: true, config: proxyService.getConfig() });
});

router.post('/config', (req, res) => {
  try {
    proxyService.updateConfig(req.body);
    res.json({ success: true, config: proxyService.getConfig() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/server-info', (_req, res) => {
  res.json({ success: true, info: proxyService.getServerInfo() });
});

router.get('/certificate-info', (_req, res) => {
  try {
    const certManager = getCertificateManager();
    res.json({
      success: true,
      info: {
        certPath: certManager.getCertificatePath(),
        keyPath: certManager.getKeyPath(),
        certDir: certManager.getCertificateDir(),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/export-certificate', (_req, res) => {
  try {
    const certManager = getCertificateManager();
    const cert = certManager.exportCertificate();
    res.json({ success: true, certificate: cert });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/regenerate-certificates', async (_req, res) => {
  try {
    const certManager = getCertificateManager();
    certManager.deleteCertificates();
    const certs = await certManager.ensureCertificates();
    res.json({ success: true, certificates: certs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;