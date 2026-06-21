import { Provider, SendMessageOptions, Message as ChatMessage } from '../../types';
import { createLogger } from '../../utils/logger';
import { cdpLoginService } from '../../services/login/cdp-login.service';
import fetch from 'node-fetch';
import * as crypto from 'crypto';
import { StringDecoder } from 'string_decoder';

const logger = createLogger('ZenMuxProvider');


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
interface ZenMuxCredential {
  ctoken?: string;
  sessionId?: string;
  cookies?: string;
}

function parseCookies(cookieStr: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieStr) return cookies;
  for (const part of cookieStr.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!cookies[key]) cookies[key] = val;
  }
  return cookies;
}

function getCleanPrompt(prompt: string): string {
  // Priority 1: extract content inside <zen-user-content>
  const userContentMatch = prompt.match(/<zen-user-content>([\s\S]*?)<\/zen-user-content>/);
  if (userContentMatch?.[1]) return userContentMatch[1].trim();

  // Priority 2: strip all known Zen XML wrapper tags
  let cleaned = prompt;
  const zenTagPatterns = [
    /<persistent-rules>[\s\S]*?<\/persistent-rules>/g,
    /<permission-mode>[\s\S]*?<\/permission-mode>/g,
    /<zen-context>[\s\S]*?<\/zen-context>/g,
    /<zen-rules>[\s\S]*?<\/zen-rules>/g,
    /<zen-info>[\s\S]*?<\/zen-info>/g,
    /<system>[\s\S]*?<\/system>/g,
    /<thinking>[\s\S]*?<\/thinking>/g,
    /<zen-[^>]*>[\s\S]*?<\/zen-[^>]*>/g,
  ];
  for (const pattern of zenTagPatterns) cleaned = cleaned.replace(pattern, '');
  cleaned = cleaned.trim();
  return (cleaned || prompt.trim()).substring(0, 500);
}

const COMMON_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'x-api-version': '2026-04-20',
};

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
class ZenMuxProvider implements Provider {
  name = 'zenmux';
  defaultModel = 'kimi-k2.7-code';

  // ---- Interface: handleMessage ------------------------------------------
  async handleMessage(options: SendMessageOptions): Promise<void> {
    return this.sendMessage({
      credential: options.credential,
      model: options.model,
      messages: options.messages as ChatMessage[],
      conversationId: options.conversationId,
      parent_message_id: options.parent_message_id,
      search: options.search,
      temperature: options.temperature,
      thinking: options.thinking,
      ref_file_ids: options.ref_file_ids,
      onContent: options.onContent,
      onMetadata: options.onMetadata,
      onThinking: options.onThinking,
      onDone: options.onDone,
      onError: options.onError,
      onSessionCreated: options.onSessionCreated,
    });
  }

  // ---- Interface: isModelSupported --------------------------------------
  isModelSupported(model: string): boolean {
    const m = model.toLowerCase();
    return m.includes(':') || m.includes('kimi') || m.includes('moonshot') || m.includes('glm');
  }

  // ---- Interface: login ------------------------------------------------
  async login(options: { method?: string }): Promise<{ email: string; cookies: string; headers?: any }> {
    logger.info(`[ZenMux] Login with method: ${options.method || 'basic'}`);

    const result = await cdpLoginService.login({
      providerId: 'zenmux',
      loginUrl: 'https://zenmux.ai/',
      keepBrowserOpen: true,
      validate: async (data: { cookies: string; email?: string }) => {
        if (!data.cookies) return { isValid: false };

        const parsed = parseCookies(data.cookies);
        const ctoken = parsed['ctoken'];
        const sessionId = parsed['sessionId'];

        if (!ctoken || !sessionId) {
          logger.info(`[ZenMux] Missing ctoken or sessionId. ctoken:${!!ctoken} sessionId:${!!sessionId}`);
          return { isValid: false };
        }

        logger.info(`[ZenMux] Validating — ctoken: ${ctoken.substring(0, 15)}...`);
        try {
          const res = await fetch(`https://zenmux.ai/api/user/info?ctoken=${ctoken}`, {
            headers: { Cookie: data.cookies, ...COMMON_HEADERS },
            timeout: 5000,
          } as any);

          logger.info(`[ZenMux] User info status: ${res.status}`);
          if (res.ok) {
            const json = JSON.parse(await res.text());
            if (json.success && json.data?.email) {
              logger.info(`[ZenMux] Validation success: ${json.data.email}`);
              return { isValid: true, email: json.data.email, cookies: data.cookies };
            }
            logger.warn('[ZenMux] Validation: success=false or email missing');
          } else {
            logger.error(`[ZenMux] Non-OK response: ${await res.text().catch(() => '')}`);
          }
        } catch (e: any) {
          logger.error('[ZenMux] Validation error:', e.message);
        }
        return { isValid: false };
      },
    });

    if (!result.success) throw new Error(result.error || 'Login failed');
    return { email: result.email || '', cookies: result.cookies || '', headers: COMMON_HEADERS };
  }

  // ---- Core: sendMessage -----------------------------------------------
  async sendMessage(params: {
    credential: string;
    model: string;
    messages: ChatMessage[];
    conversationId?: string;
    parent_message_id?: string;
    search?: boolean;
    temperature?: number;
    thinking?: boolean;
    ref_file_ids?: string[];
    onContent: (content: string) => void;
    onMetadata?: (meta: any) => void;
    onThinking?: (content: string) => void;
    onDone: () => void;
    onError: (error: Error) => void;
    onSessionCreated?: (sessionId: string) => void;
  }): Promise<void> {
    try {
      // --- Resolve credentials ---
      let cred: ZenMuxCredential;
      try { cred = JSON.parse(params.credential); } catch { cred = { cookies: params.credential }; }
      const cookieStr = cred.cookies || params.credential;
      const cookies = parseCookies(cookieStr);
      const ctoken = cookies['ctoken'];
      if (!ctoken) throw new Error('ctoken is missing in credentials/cookies');

      // Parse model details dynamically
      const modelId = params.model || 'moonshotai/kimi-k2.7-code-free:moonshotai';
      let slug = 'moonshotai/kimi-k2.7-code-free';
      let providerSlug = 'moonshotai';
      if (modelId.includes(':')) {
        const parts = modelId.split(':');
        slug = parts[0];
        providerSlug = parts[1];
      } else {
        slug = modelId;
      }

      const getEndpointProviderName = (pSlug: string): string => {
        const lower = pSlug.toLowerCase();
        if (lower === 'bigmodel') return 'BigModel';
        if (lower === 'z-ai' || lower === 'zai') return 'BigModel';
        if (lower === 'moonshotai' || lower === 'moonshot-ai') return 'MoonshotAI';
        return pSlug.charAt(0).toUpperCase() + pSlug.slice(1);
      };
      const endpointProviderName = getEndpointProviderName(providerSlug);

      const getMaxTokens = (s: string): number => {
        if (s.includes('kimi')) return 262144;
        if (s.includes('glm-5.2')) return 128000;
        if (s.includes('glm-4.7')) return 128000;
        if (s.includes('glm-4.6')) return 128000;
        return 128000;
      };
      const maxTokens = getMaxTokens(slug);

      logger.info(`[ZenMux] model=${params.model} → slug=${slug} provider=${endpointProviderName} maxTokens=${maxTokens}`);

      // --- Determine if new or existing chat room ---
      let chatId: string | undefined;
      if (
        params.conversationId &&
        !params.conversationId.startsWith('zenmux_') &&
        !params.conversationId.startsWith('moonshotai_') &&
        !params.conversationId.startsWith('glm52_') &&
        !params.conversationId.startsWith('msg_')
      ) {
        chatId = params.conversationId;
      }

      // --- Prepare round IDs ---
      const chatRequestId = crypto.randomUUID().replace(/-/g, '');
      const subChatId = crypto.randomBytes(16).toString('hex');

      // --- Extract clean question text ---
      const lastUserMessage = [...params.messages].reverse().find((m) => m.role === 'user');
      const questionText = getCleanPrompt(lastUserMessage?.content || '');
      const chatRoomName = questionText.substring(0, 100) || 'New Chat';

      const commonExtraBase = {
        subChatId,
        modelInfo: { slug },
        endpointProviderName,
        chatRequestId,
      };

      let returnedChatId = chatId || '';
      let returnedChatRoundId: string;

      const requestHeaders = {
        'Content-Type': 'application/json',
        Cookie: cookieStr,
        ...COMMON_HEADERS,
      };

      if (chatId) {
        // --- Append round to existing chat ---
        const addRoundBody = {
          chatId,
          question: questionText,
          answer: ' ',
          chatRequestId,
          extra: JSON.stringify({ ...commonExtraBase, status: 'sending' }),
        };

        logger.info(`[ZenMux] Appending round to existing chat: ${chatId}`);
        const addResponse = await fetch(
          `https://zenmux.ai/api/frontend/chat/addRound?ctoken=${encodeURIComponent(ctoken)}`,
          { method: 'POST', headers: requestHeaders, body: JSON.stringify(addRoundBody), timeout: 10000 } as any,
        );

        if (!addResponse.ok) {
          const errText = await addResponse.text();
          throw new Error(`Failed to append round on ZenMux: ${addResponse.status} ${errText}`);
        }
        const addResult = await addResponse.json() as any;
        returnedChatRoundId = addResult.id;
        if (!returnedChatRoundId)
          throw new Error(`ZenMux addRound returned invalid data: ${JSON.stringify(addResult)}`);
      } else {
        // --- Create new chat room ---
        const addBody: any = {
          name: chatRoomName,
          extra: JSON.stringify({
            subChats: [{
              subChatId,
              chatModel: { modelInfo: { slug } },
              selectedProtocolId: 'anthropic',
              billing: { mode: 'payg' },
              imageConfig: { aspectRatio: '1:1', imageSize: '1K', quality: '' },
            }],
          }),
          chatRequestId: [chatRequestId],
          question: questionText,
          answer: '',
          roundExtra: [JSON.stringify({ ...commonExtraBase, status: 'sending' })],
        };

        logger.info(`[ZenMux] Creating new chat room for model ${params.model}`);
        const addResponse = await fetch(
          `https://zenmux.ai/api/frontend/chat/add?ctoken=${encodeURIComponent(ctoken)}`,
          { method: 'POST', headers: requestHeaders, body: JSON.stringify(addBody), timeout: 10000 } as any,
        );

        if (!addResponse.ok) {
          const errText = await addResponse.text();
          throw new Error(`Failed to create chat room on ZenMux: ${addResponse.status} ${errText}`);
        }
        const addResult = await addResponse.json() as any;
        returnedChatId = addResult.chatId;
        returnedChatRoundId = addResult.chatRoundId;
        if (!returnedChatId || !returnedChatRoundId)
          throw new Error(`ZenMux add room returned invalid data: ${JSON.stringify(addResult)}`);
      }

      logger.info(`[ZenMux] Chat ready. chatId=${returnedChatId} roundId=${returnedChatRoundId}`);
      params.onSessionCreated?.(returnedChatId);

      // --- Format messages for Anthropic-compatible API ---
      const formattedMessages = params.messages.map((msg) => ({
        role: msg.role === 'system' ? 'user' : msg.role,
        content: [{ type: 'text', text: msg.content }],
      }));

      if (formattedMessages.length > 0) {
        const lastMsg = formattedMessages[formattedMessages.length - 1];
        if (lastMsg.role === 'user' && lastMsg.content.length > 0) {
          (lastMsg.content[0] as any).cache_control = { type: 'ephemeral' };
        }
      }

      // --- Stream request ---
      const streamHeaders: Record<string, string> = {
        'x-zenmux-apikey-source': 'payg',
        'chat-request-id': chatRequestId,
        'anthropic-version': '2023-06-01',
        'x-zenmux-accept-processing': 'true, true',
        'Content-Type': 'application/json',
        Cookie: cookieStr,
        ...COMMON_HEADERS,
      };

      const streamBody: any = {
        model: params.model.includes(':') ? params.model : `${slug}:${providerSlug}`,
        max_tokens: maxTokens,
        messages: formattedMessages,
        stream: true,
      };

      if (params.thinking) {
        streamBody.thinking = { type: 'enabled', budget_tokens: 10240 };
      }

      const startTime = Date.now();
      let firstTokenTime = 0;
      let firstTokenLatency = 0;
      let firstTextTime = 0;
      let totalTokenTime = 0;
      let fullAnswer = '';
      let fullThinking = '';
      let inputTokens = 0;
      let outputTokens = 0;

      const response = await fetch('https://zenmux.ai/api/anthropic/v1/messages', {
        method: 'POST',
        headers: streamHeaders,
        body: JSON.stringify(streamBody),
        timeout: 60000,
      } as any);

      if (!response.ok) {
        const errText = await response.text();
        if (response.status === 429 || errText.includes('rate_limit') || errText.includes('usage limit')) {
          try {
            const db = require('../../database').getDb();
            const accountRow = db.prepare('SELECT id FROM accounts WHERE credential LIKE ?')
              .get(`%${ctoken}%`);
            if (accountRow) {
              const cooldownTime = Date.now() + 30 * 60 * 1000; // 30 minutes cooldown
              db.prepare('UPDATE accounts SET usage = ?, reset_period = ? WHERE id = ?')
                .run('Rate Limited', String(cooldownTime), accountRow.id);
              logger.info(`[ZenMux] Account ${accountRow.id} marked as Rate Limited until ${new Date(cooldownTime).toISOString()}`);
            }
          } catch (dbErr: any) {
            logger.error(`[ZenMux] Failed to mark account as rate limited in DB: ${dbErr.message}`);
          }
        }
        throw new Error(`ZenMux API Error ${response.status}: ${errText}`);
      }
      if (!response.body) throw new Error('No response body');

      // --- SSE stream parsing ---
      const processData = (data: any) => {
        if (data.type === 'content_block_delta' && data.delta) {
          if (data.delta.type === 'text_delta' && data.delta.text) {
            params.onContent(data.delta.text);
            fullAnswer += data.delta.text;
            if (firstTextTime === 0) firstTextTime = Date.now();
            if (firstTokenTime === 0) {
              firstTokenTime = Date.now();
              firstTokenLatency = firstTokenTime - startTime;
            }
          } else if (data.delta.type === 'thinking_delta' && data.delta.thinking) {
            params.onThinking?.(data.delta.thinking);
            fullThinking += data.delta.thinking;
            if (firstTokenTime === 0) {
              firstTokenTime = Date.now();
              firstTokenLatency = firstTokenTime - startTime;
            }
          }
        } else if (data.type === 'message_delta' && data.usage) {
          if (typeof data.usage.input_tokens === 'number') inputTokens = data.usage.input_tokens;
          if (typeof data.usage.output_tokens === 'number') outputTokens = data.usage.output_tokens;
        } else if (data.type === 'message_start' && data.message?.usage) {
          if (typeof data.message.usage.input_tokens === 'number') inputTokens = data.message.usage.input_tokens;
          if (typeof data.message.usage.output_tokens === 'number') outputTokens = data.message.usage.output_tokens;
        }
      };

      const decoder = new StringDecoder('utf8');
      let buffer = '';
      let isDone = false;

      for await (const chunk of response.body) {
        if (isDone) break;
        buffer += decoder.write(chunk as Buffer);
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;
          const dataStr = trimmed.slice(5).trim();
          if (dataStr === '[DONE]') { isDone = true; break; }
          try { processData(JSON.parse(dataStr)); } catch { /* ignore */ }
        }
      }

      // Flush remaining buffer
      const remaining = decoder.end();
      if (remaining) buffer += remaining;
      if (buffer.trim()) {
        const line = buffer.trim();
        if (line.startsWith('data:')) {
          const dataStr = line.slice(5).trim();
          if (dataStr !== '[DONE]') {
            try { processData(JSON.parse(dataStr)); } catch { /* ignore */ }
          }
        }
      }

      totalTokenTime = Date.now() - startTime;
      if (firstTokenLatency === 0) firstTokenLatency = totalTokenTime;
      const reasoningTime =
        firstTextTime > 0 && firstTokenTime > 0 ? (firstTextTime - firstTokenTime) / 1000 : 0;

      // --- Update round on ZenMux ---
      try {
        const extraObj: any = {
          subChatId,
          chatRequestId,
          status: 'success',
          modelInfo: { slug },
          usage: { prompt_tokens: inputTokens, completion_tokens: outputTokens },
          firstTokenLatency,
          totalTokenTime,
          requestId: chatRequestId,
          chatRequestTime: new Date(startTime).toISOString(),
          zenmuxRequestId: chatRequestId,
          endpointProviderName,
        };
        if (fullThinking) {
          extraObj.reasoning = fullThinking;
          extraObj.reasoningTime = reasoningTime;
        }

        const updateRoundBody = {
          chatId: returnedChatId,
          chatRoundId: returnedChatRoundId,
          question: questionText,
          answer: fullAnswer,
          extra: JSON.stringify(extraObj),
          chatRequestId,
          status: 'success',
          finishReason: 'success',
        };

        logger.info(`[ZenMux] Syncing round — chatId=${returnedChatId} roundId=${returnedChatRoundId}`);
        const updateResponse = await fetch(
          `https://zenmux.ai/api/frontend/chat/updateRound?ctoken=${ctoken}`,
          { method: 'POST', headers: requestHeaders, body: JSON.stringify(updateRoundBody), timeout: 10000 } as any,
        );

        if (!updateResponse.ok) {
          logger.error(`[ZenMux] updateRound failed: ${updateResponse.status} ${await updateResponse.text()}`);
        } else {
          logger.info('[ZenMux] Round sync successful.');
        }
      } catch (updateErr: any) {
        logger.error(`[ZenMux] updateRound error: ${updateErr.message}`);
      }

      params.onDone();
    } catch (error: any) {
      logger.error('[ZenMux] sendMessage error', error);
      params.onError(error);
    }
  }

  // ---- Interface: getModels --------------------------------------------
  async getModels(credential: string, accountId?: string): Promise<Array<{ id: string; name: string; is_thinking?: boolean; max_context_length?: number | null; is_image_upload?: boolean; is_video_upload?: boolean; is_search?: boolean }>> {
    try {
      let cred: any;
      try {
        cred = JSON.parse(credential);
      } catch {
        cred = { cookies: credential };
      }

      const cookieStr = cred.cookies || credential;
      const cookies = parseCookies(cookieStr);
      const ctoken = cookies['ctoken'];
      if (!ctoken) {
        throw new Error('ctoken is missing in credentials/cookies');
      }

      logger.info(`[ZenMux] Fetching available models from ZenMux...`);
      const response = await fetch(`https://zenmux.ai/api/frontend/model/available/list?ctoken=${encodeURIComponent(ctoken)}`, {
        headers: {
          'Cookie': cookieStr,
          'x-api-version': '2026-04-20',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        },
        timeout: 10000
      } as any);

      if (!response.ok) {
        throw new Error(`Failed to fetch models from ZenMux: ${response.status} ${response.statusText}`);
      }

      const json = await response.json() as any;
      if (!json.success || !json.data) {
        throw new Error(`ZenMux API returned unsuccessful response: ${JSON.stringify(json)}`);
      }

      let models: any[] = [];
      if (Array.isArray(json.data)) {
        models = json.data;
      } else if (json.data && Array.isArray(json.data.models)) {
        models = json.data.models;
      } else {
        throw new Error(`ZenMux API returned invalid models structure: ${JSON.stringify(json)}`);
      }

      // Filter all free models
      const filtered = models.filter((m: any) => {
        return m.isFree === true || (Array.isArray(m.plans) && m.plans.includes('free'));
      });

      logger.info(`[ZenMux] Found ${filtered.length} free models on ZenMux`);

      if (filtered.length === 0) {
        return [
          { id: 'moonshotai/kimi-k2.7-code-free:moonshotai', name: 'Kimi K2.7 Code (Free)', is_thinking: true, is_search: false, is_image_upload: true, max_context_length: 262144 },
          { id: 'z-ai/glm-5.2-free:bigmodel', name: 'GLM 5.2 (Free)', is_thinking: true, is_search: true, is_image_upload: true, max_context_length: 128000 },
        ];
      }

      return filtered.map((m: any) => {
        const pSlug = m.provider_slug || m.providerSlug || 'zenmux';
        const endpoint = m.endpoint || `${m.slug}:${pSlug}`;
        
        const isThinking = m.flags?.includes('reasoning_to_reasoning_content') || m.supports_reasoning === 1 || m.supports_reasoning === 2;
        const isSearch = m.flags?.includes('web_search') || m.supported_parameters?.includes('web_search') || m.slug?.includes('glm-5.2');
        const isImage = m.input_modalities?.includes('image') || m.slug?.includes('vision') || m.slug?.includes('4.6v') || m.slug?.includes('glm-5.2');

        return {
          id: endpoint,
          name: m.name || m.slug,
          is_thinking: isThinking,
          is_search: isSearch,
          is_image_upload: isImage,
          max_context_length: m.max_completion_tokens || m.maxTokens || 128000,
        };
      });
    } catch (error: any) {
      logger.error('[ZenMux] Error in getModels:', error);
      return [
        { id: 'moonshotai/kimi-k2.7-code-free:moonshotai', name: 'Kimi K2.7 Code (Free)', is_thinking: true, is_search: false, is_image_upload: true, max_context_length: 262144 },
        { id: 'z-ai/glm-5.2-free:bigmodel', name: 'GLM 5.2 (Free)', is_thinking: true, is_search: true, is_image_upload: true, max_context_length: 128000 },
      ];
    }
  }

  // ---- Interface: getUsage ----------------------------------------------
  async getUsage(credential: string): Promise<{ usage: string; resetPeriod: string }> {
    try {
      let cred: any;
      try {
        cred = JSON.parse(credential);
      } catch {
        cred = { cookies: credential };
      }
      const cookieStr = cred.cookies || credential;
      const cookies = parseCookies(cookieStr);
      const ctoken = cookies['ctoken'];
      if (!ctoken) {
        throw new Error('ctoken is missing in credentials/cookies');
      }

      // Check database to see if we recently marked it as Rate Limited
      const db = require('../../database').getDb();
      const accountRow = db.prepare('SELECT id, usage, reset_period FROM accounts WHERE credential LIKE ?')
        .get(`%${ctoken}%`);

      if (accountRow && accountRow.usage && accountRow.usage.startsWith('Rate Limited')) {
        const resetTime = parseInt(accountRow.reset_period || '0', 10);
        if (Date.now() < resetTime) {
          const remainingMinutes = Math.ceil((resetTime - Date.now()) / 60000);
          logger.info(`[ZenMux] Account ${accountRow.id} is in cooldown (Rate Limited) for ${remainingMinutes} more minutes`);
          return {
            usage: `Rate Limited (${remainingMinutes}m)`,
            resetPeriod: `${remainingMinutes}m`,
          };
        } else {
          logger.info(`[ZenMux] Cooldown expired for account ${accountRow.id}, resetting status`);
          db.prepare('UPDATE accounts SET usage = NULL, reset_period = NULL WHERE id = ?')
            .run(accountRow.id);
        }
      }

      logger.info(`[ZenMux] Fetching subscription usage...`);

      // 1. Fetch subscription details (for period_quota and plan name)
      const subRes = await fetch(`https://zenmux.ai/api/subscription/get_current?ctoken=${encodeURIComponent(ctoken)}`, {
        headers: {
          'Cookie': cookieStr,
          ...COMMON_HEADERS,
        },
        timeout: 5000,
      } as any);

      if (!subRes.ok) {
        throw new Error(`Failed to fetch subscription: ${subRes.status} ${subRes.statusText}`);
      }

      const subJson = await subRes.json() as any;
      if (!subJson.success || !subJson.data) {
        throw new Error(`Subscription API returned unsuccessful: ${JSON.stringify(subJson)}`);
      }

      const planName = subJson.data.name || 'Free Plan';
      const periodQuota = subJson.data.period_quota ?? 5;
      const resetDesc = subJson.data.desc || '5 Flows/5h';

      // Parse reset period from description (e.g. "5h") or default to "5h"
      let resetPeriod = '5h';
      const descParts = resetDesc.split('/');
      if (descParts.length > 1) {
        resetPeriod = descParts[1].trim();
      }

      // 2. Fetch current usage (flows used)
      const usageRes = await fetch(`https://zenmux.ai/api/subscription/get_current_usage?ctoken=${encodeURIComponent(ctoken)}`, {
        headers: {
          'Cookie': cookieStr,
          ...COMMON_HEADERS,
        },
        timeout: 5000,
      } as any);

      if (!usageRes.ok) {
        throw new Error(`Failed to fetch usage: ${usageRes.status} ${usageRes.statusText}`);
      }

      const usageJson = await usageRes.json() as any;
      if (!usageJson.success) {
        throw new Error(`Usage API returned unsuccessful: ${JSON.stringify(usageJson)}`);
      }

      let used = 0;
      if (usageJson.data) {
        // Safe check for potential used/count properties
        used = usageJson.data.used ?? usageJson.data.count ?? usageJson.data.flowCount ?? usageJson.data.totalFlows ?? 0;
      }

      const usageStr = `${used}/${periodQuota} Flows`;

      return {
        usage: usageStr,
        resetPeriod: resetPeriod,
      };
    } catch (error: any) {
      logger.error('[ZenMux] Error in getUsage:', error.message);
      return {
        usage: 'Unknown',
        resetPeriod: 'unknown',
      };
    }
  }
}

export default new ZenMuxProvider();
