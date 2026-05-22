import { Router } from 'express';
import { proxyService } from '../../services/proxy.service';
import { getCertificateManager } from '../../utils/cert-manager';

const router = Router();

router.get('/config', (req, res) => {
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

router.get('/server-info', (req, res) => {
  res.json({ success: true, info: proxyService.getServerInfo() });
});

router.get('/certificate-info', (req, res) => {
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

router.get('/export-certificate', (req, res) => {
  try {
    const certManager = getCertificateManager();
    const cert = certManager.exportCertificate();
    res.json({ success: true, certificate: cert });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/regenerate-certificates', async (req, res) => {
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
