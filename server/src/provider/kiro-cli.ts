import { Provider, SendMessageOptions } from './types';
import { Router } from 'express';
import fetch from 'node-fetch';
import { createLogger } from '../utils/logger';
import { proxyService } from '../services/proxy.service';
import { ProxyHandler } from '../services/proxy.service';
import { proxyEvents } from '../services/proxy-events';
import { getDb } from '../services/db';
import * as path from 'path';
import * as os from 'os';
import { spawn, execSync } from 'child_process';
import { kiroAccountService } from '../services/kiro-account.service';

const logger = createLogger('KiroCLIProvider');

export const KIRO_CONFIG = {
  tokenUrl: 'https://prod.us-east-1.auth.desktop.kiro.dev/refreshToken',
  qUrl: 'https://q.us-east-1.amazonaws.com/',
};

// =============================================================================
// PROXY HANDLER
// =============================================================================

export const proxyHandler: ProxyHandler = {
  onResponseBody: (ctx: any, body: string) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;
    // Only log if it's related to Kiro or AWS to reduce noise
    if (host && (host.includes('kiro.dev') || host.includes('amazonaws.com'))) {
      logger.debug(`[Proxy] Response from ${host}${url}`);
    }

    if (
      host &&
      host.includes('auth.desktop.kiro.dev') &&
      (url.includes('/refreshToken') || url.includes('/oauth/token'))
    ) {
      logger.info(`[Proxy] Detected Kiro auth token request (${url})!`);
      try {
        const json = JSON.parse(body);
        if (json.accessToken) {
          logger.info(`[Proxy] Successfully captured access token.`);
          // Map API response to Kiro auth_kv storage format
          const sessionData = {
            access_token: json.accessToken,
            refresh_token: json.refreshToken || '',
            expires_at: new Date(
              Date.now() + (json.expiresIn || 3600) * 1000,
            ).toISOString(),
            provider: json.provider || 'google', // Default to google as seen in analysis
            profile_arn: json.profileArn || '',
            email: json.email || '', // Store email for stable identification
          };
          proxyEvents.emit('kiro-cli-tokens', {
            cookies: JSON.stringify(sessionData),
            email: json.email || '',
          });
        } else {
          logger.warn(
            `[Proxy] refreshToken responded but no accessToken found in body: ${body.substring(0, 500)}`,
          );
        }
      } catch (e: any) {
        logger.error(
          `[Proxy] Failed to parse Kiro auth response: ${e.message}`,
        );
      }
    }

    if (
      host &&
      host.includes('amazonaws.com') &&
      url.includes('ListAvailableModels')
    ) {
      try {
        const json = JSON.parse(body);
        if (json.models) {
          logger.info(
            `[Proxy] Captured ${json.models.length} models from AWS.`,
          );
          proxyEvents.emit('kiro-cli-models', json.models);
        }
      } catch (e) {}
    }
  },
};

// =============================================================================
// PROVIDER CLASS
// =============================================================================

export class KiroCLIProvider implements Provider {
  name = 'kiro-cli';
  proxyHandler = proxyHandler;
  defaultModel = 'auto';

  async login() {
    logger.info('Starting Kiro CLI login with default system browser...');
    await proxyService.start();
    const { port } = proxyService.getServerInfo();

    const proxyUrl = `http://127.0.0.1:${port}`;
    logger.info(`[KiroCLI] Proxy started on ${proxyUrl}`);
    const certsDir = path.join(os.homedir(), '.elara', 'certs');
    const caCertPath = path.join(certsDir, 'certs', 'ca.pem');

    const terminals = [
      'gnome-terminal',
      'konsole',
      'xfce4-terminal',
      'kitty',
      'alacritty',
      'xterm',
      'x-terminal-emulator',
    ];
    let terminal = '';
    for (const t of terminals) {
      try {
        execSync(`which ${t}`, { stdio: 'ignore' });
        terminal = t;
        break;
      } catch (e) {}
    }

    logger.info(`[KiroCLI] Using terminal: ${terminal || 'direct bash'}`);

    const env = {
      ...process.env,
      NODE_TLS_REJECT_UNAUTHORIZED: '0',
      SSL_CERT_FILE: caCertPath,
      AWS_CA_BUNDLE: caCertPath,
      http_proxy: proxyUrl,
      https_proxy: proxyUrl,
    };

    const envStr = `export http_proxy=${proxyUrl} https_proxy=${proxyUrl} SSL_CERT_FILE=${caCertPath} AWS_CA_BUNDLE=${caCertPath} NODE_TLS_REJECT_UNAUTHORIZED=0;`;
    const commandStr = `${envStr} kiro-cli logout || true; kiro-cli login`;

    let terminalSpawn: any;
    if (terminal === 'gnome-terminal') {
      terminalSpawn = spawn(
        terminal,
        [
          '--',
          'bash',
          '-c',
          `${commandStr}; echo ''; echo 'Press enter to close...'; read`,
        ],
        { detached: true, env, stdio: 'ignore' },
      );
    } else if (terminal) {
      terminalSpawn = spawn(terminal, ['-e', `bash -c "${commandStr}; read"`], {
        detached: true,
        env,
        stdio: 'ignore',
      });
    } else {
      terminalSpawn = spawn('bash', ['-c', commandStr], {
        env,
        detached: true,
        stdio: 'ignore',
      });
    }

    return new Promise((resolve, reject) => {
      let resolved = false;

      const handleTokens = (data: any) => {
        if (!resolved) {
          resolved = true;
          logger.info(`[KiroCLI] Captured tokens via proxy emit.`);
          resolve(data);
        }
      };

      proxyEvents.once('kiro-cli-tokens', handleTokens);

      terminalSpawn.on('error', (err: Error) => {
        logger.error(`[KiroCLI] Terminal spawn error:`, err);
        if (!resolved) {
          resolved = true;
          proxyEvents.off('kiro-cli-tokens', handleTokens);
          reject(err);
        }
      });

      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          proxyEvents.off('kiro-cli-tokens', handleTokens);
          logger.warn(`[KiroCLI] Login timed out after 5 minutes.`);
          reject(new Error('Timed out waiting for Kiro CLI auth in browser'));
        }
      }, 300000); // 5 mins timeout
    });
  }

  async refreshToken(refreshTokenStr: string) {
    const response = await fetch(KIRO_CONFIG.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: '*/*',
      },
      body: JSON.stringify({
        refreshToken: refreshTokenStr, // Updated payload structure
      }),
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(
        `Failed to refresh Kiro token. Status: ${response.status}. Body: ${errText}`,
      );
    }
    return await response.json();
  }

  async handleMessage(options: SendMessageOptions): Promise<void> {
    const {
      credential,
      messages,
      model,
      stream,
      onContent,
      onDone,
      onError,
      accountId,
    } = options;

    let tokens: any;
    try {
      const parsed = JSON.parse(credential);
      // Support both old format (accessToken) and new format (access_token)
      tokens = {
        accessToken: parsed.access_token || parsed.accessToken,
        refreshToken: parsed.refresh_token || parsed.refreshToken,
      };
    } catch (e) {
      tokens = { accessToken: credential };
    }

    const url = 'https://q.us-east-1.amazonaws.com/';

    const sendRequest = async (token: string) => {
      const body = {
        conversationState: {
          conversationId:
            options.conversationId || require('crypto').randomUUID(),
          history: messages.slice(0, -1).map((m) => {
            if (m.role === 'assistant') {
              return { assistantResponseMessage: { content: m.content } };
            }
            return {
              userInputMessage: {
                content: m.content,
                userInputMessageContext: {
                  envState: {
                    operatingSystem: 'linux',
                    currentWorkingDirectory: process.cwd(),
                  },
                },
                origin: 'KIRO_CLI',
              },
            };
          }),
          currentMessage: {
            userInputMessage: {
              content: messages[messages.length - 1].content,
              userInputMessageContext: {
                envState: {
                  operatingSystem: 'linux',
                  currentWorkingDirectory: process.cwd(),
                },
                tools: [],
              },
              origin: 'KIRO_CLI',
              modelId: model === 'kiro-cli' ? 'auto' : model || 'auto',
            },
          },
          chatTriggerType: 'MANUAL',
          agentContinuationId: require('crypto').randomUUID(),
          agentTaskType: 'vibe',
        },
      };

      return await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-amz-json-1.0',
          'X-Amz-Target':
            'AmazonCodeWhispererStreamingService.GenerateAssistantResponse',
          Authorization: `Bearer ${token}`,
          'User-Agent':
            'aws-sdk-rust/1.3.12 ua/2.1 api/codewhispererstreaming/0.1.13922 os/linux lang/rust/1.92.0 md/appVersion-1.26.2 app/AmazonQ-For-CLI',
          'X-Amz-User-Agent':
            'aws-sdk-rust/1.3.12 ua/2.1 api/codewhispererstreaming/0.1.13922 os/linux lang/rust/1.92.0 m/F app/AmazonQ-For-CLI',
          'X-Amzn-Codewhisperer-Optout': 'false',
          'X-Amz-Invocation-Id': require('crypto').randomUUID(),
          'Accept-Encoding': 'gzip',
        },
        body: JSON.stringify(body),
      });
    };

    try {
      let response = await sendRequest(tokens.accessToken);

      const errorType = response.headers.get('x-amzn-errortype');
      const isExpired =
        response.status === 401 ||
        response.status === 403 ||
        errorType?.includes('ExpiredTokenException') ||
        errorType?.includes('AccessDeniedException');

      if (isExpired && tokens.refreshToken) {
        logger.info(
          `[KiroCLI] Token expired (status: ${response.status}, type: ${errorType}). Refreshing...`,
        );
        const newTokens = await this.refreshToken(tokens.refreshToken);
        tokens.accessToken = newTokens.accessToken;
        tokens.refreshToken = newTokens.refreshToken || tokens.refreshToken;

        if (accountId) {
          try {
            const db = getDb();
            db.prepare(
              'UPDATE accounts SET credential = ?, last_refreshed_at = ? WHERE id = ?',
            ).run(JSON.stringify(tokens), Date.now(), accountId);
          } catch (e) {
            logger.error(
              '[KiroCLI] Failed to update refreshed tokens in DB:',
              e,
            );
          }
        }
        response = await sendRequest(tokens.accessToken);
      }

      if (!response.ok) {
        let errBody = '';
        try {
          errBody = await response.text();
        } catch (e) {}
        throw new Error(`Kiro CLI Error ${response.status}: ${errBody}`);
      }

      if (stream !== false) {
        if (!response.body) throw new Error('No response body');
        for await (const chunk of response.body as any) {
          this.parseEventStream(chunk, onContent, options.onSessionCreated);
        }
        onDone();
      } else {
        const fullBody = await response.buffer();
        this.parseEventStream(fullBody, onContent, options.onSessionCreated);
        onDone();
      }
    } catch (err: any) {
      onError(err);
    }
  }

  private parseEventStream(
    buffer: Buffer,
    onContent: (content: string) => void,
    onSessionCreated?: (sessionId: string) => void,
  ) {
    let offset = 0;
    while (offset < buffer.length) {
      if (offset + 12 > buffer.length) break;
      const totalLength = buffer.readUInt32BE(offset);
      const headersLength = buffer.readUInt32BE(offset + 4);
      if (offset + totalLength > buffer.length) break;
      const payloadOffset = offset + 12 + headersLength;
      const payloadLength = totalLength - headersLength - 16;
      if (payloadLength > 0) {
        try {
          const json = JSON.parse(
            buffer
              .slice(payloadOffset, payloadOffset + payloadLength)
              .toString(),
          );
          if (json.conversationId && onSessionCreated) {
            onSessionCreated(json.conversationId);
          }
          if (json.content) onContent(json.content);
        } catch (e) {}
      }
      offset += totalLength;
    }
  }

  async getModels(credential: string): Promise<any[]> {
    let tokens: any;
    try {
      const parsed = JSON.parse(credential);
      tokens = {
        accessToken: parsed.access_token || parsed.accessToken,
      };
    } catch (e) {
      tokens = { accessToken: credential };
    }
    if (!tokens.accessToken) return [];

    const response = await fetch(`${KIRO_CONFIG.qUrl}?origin=KIRO_CLI`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.0',
        'X-Amz-Target': 'AmazonCodeWhispererService.ListAvailableModels',
        Authorization: `Bearer ${tokens.accessToken}`,
      },
      body: JSON.stringify({ origin: 'KIRO_CLI' }),
    });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.models || []).map((m: any) => ({
      id: m.modelId,
      name: m.modelName || m.modelId,
      description: m.description,
    }));
  }

  async getUsage(
    credential: string,
  ): Promise<{ usage: string; resetPeriod: 'day' | 'month' | string }> {
    let tokens: any;
    try {
      const parsed = JSON.parse(credential);
      tokens = {
        accessToken: parsed.access_token || parsed.accessToken,
      };
    } catch (e) {
      tokens = { accessToken: credential };
    }
    if (!tokens.accessToken) return { usage: '0', resetPeriod: 'month' };

    try {
      const response = await fetch(
        `${KIRO_CONFIG.qUrl}?origin=KIRO_CLI&isEmailRequired=false`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-amz-json-1.0',
            'X-Amz-Target': 'AmazonCodeWhispererService.GetUsageLimits',
            Authorization: `Bearer ${tokens.accessToken}`,
            'User-Agent':
              'aws-sdk-rust/1.3.12 ua/2.1 api/codewhispererruntime/0.1.13922 os/linux lang/rust/1.92.0 md/appVersion-1.26.2 app/AmazonQ-For-CLI',
          },
          body: JSON.stringify({ origin: 'KIRO_CLI', isEmailRequired: false }),
        },
      );

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      // Find CREDIT usage info
      const creditUsage = data.usageBreakdownList?.find(
        (u: any) => u.resourceType === 'CREDIT',
      );
      if (creditUsage) {
        const currentUsage = creditUsage.currentUsageWithPrecision || 0;
        const limit = creditUsage.usageLimitWithPrecision || 1; // Avoid division by zero
        const percentage = ((currentUsage / limit) * 100).toFixed(1);
        return {
          usage: percentage,
          resetPeriod: 'month', // Amazon Q usually resets monthly
        };
      }
    } catch (e: any) {
      logger.error('[KiroCLI] Failed to fetch usage limits:', e.message);
    }

    return { usage: '0', resetPeriod: 'month' };
  }

  isModelSupported(model: string): boolean {
    const m = model.toLowerCase();
    return (
      m.includes('kiro') ||
      m.includes('claude') ||
      m.includes('deepseek') ||
      m.includes('qwen') ||
      m.includes('minimax')
    );
  }

  async switchAccount(accountId: string): Promise<void> {
    const db = getDb();
    const account = db
      .prepare('SELECT email, credential FROM accounts WHERE id = ?')
      .get(accountId) as { email: string; credential: string } | undefined;

    if (!account) {
      throw new Error('Account not found');
    }

    logger.info(`Switching Kiro CLI to account ${accountId}...`);

    try {
      // credential field in DB now stores the full JSON required by Kiro's auth_kv
      // We also ensure email is present in the JSON for identification
      let sessionData: any;
      try {
        sessionData = JSON.parse(account.credential);
      } catch (e) {
        sessionData = { access_token: account.credential };
      }

      const accountEmail = (account as any).email;
      if (accountEmail && !sessionData.email) {
        sessionData.email = accountEmail;
      }

      await kiroAccountService.syncToLocal(JSON.stringify(sessionData));
      logger.info(`Successfully switched Kiro CLI account.`);
    } catch (e: any) {
      logger.error(`Failed to switch Kiro CLI account: ${e.message}`);
      throw e;
    }
  }
}

export default new KiroCLIProvider();
