#!/usr/bin/env node

/**
 * Qwen API Test - Hardcoded Credential
 * 
 * Usage: node test-qwen-hardcoded.js
 */

const fetch = require('node-fetch');
const crypto = require('crypto');

const BASE_URL = 'https://chat.qwen.ai';

// Hardcoded credential from user's account
const CREDENTIAL = {
  token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjQ5NWI2NDhmLTJiOTUtNDMzYS04OWQ0LWFhNTBlYTM3NGQxOSIsImxhc3RfcGFzc3dvcmRfY2hhbmdlIjoxNzY4MjMwMDk3LCJleHAiOjE3ODQwMzY3NTR9.StmNUfhG06ACabRuN9LuX6FeTk156pLO_y052C4ePRE",
  bxUa: "231!rRp3/+mUAS3+jjlEk+3zgQBjUqSPtpYb0ZZfZ549unPpOzrJbM/uLxa5H36050f27Ap/27IuvYztPKfaHd21khYVQenq7ZAmqGLwT09svuZw3tg57DW467iemhV6I4Bjp1a1UFUec53X2NIkdPYEppc4dee9Akz0nUXZGr1mTAbKXsFI7uAu7UdKLKD+1VD+uw8r+kh++6WF1cCxXYi7HJBh+++j+ygU3+jOvBBIn34tFkk3H17emSbKy5zc3OjkLjEJKQTNbtPyPWpvadpNUCtY08J06Cqm7GVik9uC5pSrtnxxPuqWiqBWh63L+ln3mUatB2IjODqjw4JnSn5lQMkZkgoPo4L0mwXRLk12Vs92293qEJ3u8lDPBbOgr+CbC3tVYfeHR0jzrJbno+d4YNlhqPtdvAphS40wJ3TfVBHHF1Q/xaJ2oicGfMpuFb8xur3yBbM5+pC07S1+k8vF0ulNotycZfIoaY9ArNgZoWkdmJ3kOXdfnOJnZ/7FS4A2AC0DhYd6eliXqtw7Mr+/ef3s7wycVtAVny9efc4u1WBfd0LVyXADNaMaMJOROZhiwsbWkBZelRTkIrOfo3Dc+PtCiLJhIkIhWfGvlWB7anv5jFu4Rxz8XwQ8cey3fc5Uqg9/bponY0bdRTe77FpD1w5+/+J/essr/IUlE4nvOCH3ByCXEaujl5BsJ1J9JNCqSphoxM4ZvHhOe1OiFtxMwuNd71yYn0tioBBT/9aDWQsGNIzK44jyncEdgQ3QHqNkyaNIfIN2LjWvb1UXGwv4qVVdlzh3yo4CDr6jNxMRWDrj5RcDmQnwO0Ndae6Aky1bi6iuS7HGKVHtoewttUM8cscNNdXZXEcIGX7IL9clg7xEx8ODVSexySyR/E95Rq6A2vHo/+fvxKNFh4p9a+WeHftVY5FPcFPQdMpj6G5SLmHSCTs8a54rxCM/03EiJPZMMILo/rghTg/LqbwfuLvFRGXSuYwSyh8Kg+9Ynx2NeU3nxKZJgLu5KuSBmrhMYzN1PKXOYiqC5ghki3WDSUx5TtUTVNmbFKf9fdr0BFjH8QAm4TOuYQZdCye9WL5pG+kQ0XyhkB4VsfjDTsSwAYo77HiBZqctWLjWlEDw5o7OfGBFN/f7GmU4THT+FJJwZfylR/hDQRfo//hp3YKNqz3QWCADhM8RR9PxSA4CgB7M0ZdoRc50MUq7pcUsF+y/PWPq1GsUJNY5DN29NQgbN6VLcuy1T+TCFBHJQOSAu2uw6GwT0O4TcTmntFE0l5aHj2jp0HiQNG1VrzBoLFfKxKajV7Ow4dmPuYKch2cN2uQBnhhzt/jIAabzHHh9ZRNg2CTY9eAgPIAcdZvptbcr6TlzyPVrRGelA9dq26fBbu6Gb+T/5DLT3RX3OIp9LLsoAjzcoHzbKo7FoZt5R+2zpxGbSTw2ggz5l4uDpH2lcA==",
  bxUmidToken: "T2gA7_OWyqqywqI5kQCUhKWsiSzPDR807uSYRVwoj0ioIjTuzbLu9xT6d9E0EW4ma2I=",
  userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
};

// ============================================================================
// Helper Functions
// ============================================================================

function generateUUID() {
  return crypto.randomUUID();
}

// ============================================================================
// Send Message to Qwen API
// ============================================================================

async function createChat() {
  const { token, bxUa, bxUmidToken, userAgent } = CREDENTIAL;
  const cookieValue = `token=${token}`;
  
  const headers = {
    'Content-Type': 'application/json',
    'accept': 'application/json',
    'User-Agent': userAgent,
    'Cookie': cookieValue,
    'source': 'web',
    'version': '0.2.64',
    'Referer': 'https://chat.qwen.ai/c/new-chat',
    'Origin': BASE_URL,
    'X-Request-Id': generateUUID(),
    'sec-ch-ua': '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Linux"',
    'Accept-Language': 'en-US,en;q=0.9',
    'Timezone': new Date().toDateString() + ' ' + new Date().toTimeString().split(' ')[0] + ' GMT+0700',
    'bx-v': '2.5.36',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (bxUa) headers['bx-ua'] = bxUa;
  if (bxUmidToken) headers['bx-umidtoken'] = bxUmidToken;
  
  console.log('[createChat] Creating new chat via POST /api/v2/chats/new');
  
  const response = await fetch(`${BASE_URL}/api/v2/chats/new`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),  // Empty body works
  });
  
  const actualStatusCode = response.headers.get('x-actual-status-code');
  const responseText = await response.text();
  
  console.log(`[createChat] Status: ${response.status}, actual: ${actualStatusCode}`);
  console.log(`[createChat] Response: ${responseText}`);
  
  if (!response.ok || (actualStatusCode && actualStatusCode !== '200')) {
    throw new Error(`Create chat failed: ${response.status} - ${responseText}`);
  }
  
  const json = JSON.parse(responseText);
  const chatId = json.data?.id || json.id;
  
  if (!chatId) {
    throw new Error(`No chat_id in response: ${responseText}`);
  }
  
  console.log(`[createChat] Chat created successfully: ${chatId}`);
  return chatId;
}

async function sendMessage(options) {
  const { 
    messages, 
    conversationId = null, 
    parentMessageId = null,
    model = 'qwen3.7-plus',
    onContent,
    onDone,
    onError,
    onSessionCreated
  } = options;

  const { token, bxUa, bxUmidToken, userAgent } = CREDENTIAL;
  const cookieValue = `token=${token}`;
  const isNewChat = !conversationId;

  const nowSec = Math.floor(Date.now() / 1000);
  const requestId = generateUUID();
  const timezone = `${new Date().toDateString()} ${new Date().toTimeString().split(' ')[0]} GMT+0700`;

  const lastMsg = messages[messages.length - 1];
  const msgFid = generateUUID();

  // Build payload
  const payload = {
    stream: true,
    version: '2.1',
    incremental_output: true,
    ...(conversationId && { chat_id: conversationId }),
    chat_mode: 'normal',
    model: model,
    parent_id: parentMessageId,
    messages: [
      {
        fid: msgFid,
        parentId: parentMessageId,
        childrenIds: [],
        role: lastMsg.role,
        content: lastMsg.content,
        user_action: 'chat',
        files: [],
        timestamp: nowSec,
        models: [model],
        chat_type: 't2t',
        feature_config: {
          thinking_enabled: false,
          output_schema: 'phase',
          research_mode: 'normal',
          auto_thinking: false,
          thinking_mode: 'Fast',
          auto_search: true,
        },
        extra: { meta: { subChatType: 't2t' } },
        sub_chat_type: 't2t',
      },
    ],
    timestamp: nowSec,
  };

  // Build headers
  const headers = {
    'Content-Type': 'application/json',
    'accept': 'application/json',
    'User-Agent': userAgent,
    'Origin': BASE_URL,
    'Referer': conversationId ? `${BASE_URL}/c/${conversationId}` : BASE_URL,
    'x-accel-buffering': 'no',
    'x-request-id': requestId,
    'Cookie': cookieValue,
    'source': 'web',
    'version': '0.2.64',
    'bx-v': '2.5.36',
    'timezone': timezone,
    'accept-language': 'en-US,en;q=0.9',
  };
  
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (bxUa) headers['bx-ua'] = bxUa;
  if (bxUmidToken) headers['bx-umidtoken'] = bxUmidToken;

  // Build URL
  const url = conversationId 
    ? `${BASE_URL}/api/v2/chat/completions?chat_id=${conversationId}`
    : `${BASE_URL}/api/v2/chat/completions`;

  console.log(`[Request] URL: ${url}`);
  console.log(`[Request] isNewChat: ${isNewChat}`);
  console.log(`[Request] conversationId: ${conversationId || '(none)'}`);

  try {
    console.log(`[Request] Headers:`, JSON.stringify(headers, null, 2).slice(0, 500));
    console.log(`[Request] Payload preview:`, JSON.stringify(payload, null, 2).slice(0, 500));
    
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload),
    });

    console.log(`[Response] Status: ${response.status} ${response.statusText}`);
    console.log(`[Response] Headers:`, Object.fromEntries(response.headers.entries()));

    const actualStatusCode = response.headers.get('x-actual-status-code');
    if (actualStatusCode && actualStatusCode !== '200') {
      const errorText = await response.text();
      console.error(`[Response] Actual status code: ${actualStatusCode}`);
      console.error(`[Response] Error body: ${errorText.slice(0, 1000)}`);
      throw new Error(`Qwen API Error ${actualStatusCode}: ${errorText.slice(0, 500)}`);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Response] Error body: ${errorText.slice(0, 1000)}`);
      throw new Error(`Qwen API Error ${response.status}: ${errorText.slice(0, 500)}`);
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    let buffer = '';
    let conversationIdCaptured = false;
    let fullContent = '';
    let chunkCount = 0;
    let hasReceivedData = false;

    for await (const chunk of response.body) {
      chunkCount++;
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        
        // Handle SSE data lines
        let jsonStr = trimmed;
        if (trimmed.startsWith('data: ')) {
          jsonStr = trimmed.slice(6).trim();
        } else if (trimmed.startsWith('data:')) {
          jsonStr = trimmed.slice(5).trim();
        } else {
          // Not an SSE data line, skip
          continue;
        }
        
        console.log(`[DEBUG] jsonStr: ${jsonStr.slice(0, 100)}...`);
        if (jsonStr === '[DONE]') {
          if (onDone) onDone(fullContent);
          return;
        }
        
        try {
          const json = JSON.parse(jsonStr);
          
          // Debug: log first few chunks to see structure
          if (chunkCount <= 3) {
            console.log(`[DEBUG] Chunk ${chunkCount}:`, JSON.stringify(json, null, 2).slice(0, 500));
          }
          
          // Try multiple possible field names for chat_id
          const possibleChatId = json.chat_id || json.conversation_id || json.id || json.data?.chat_id || json.data?.id;
          
          // Capture chat_id from response for new conversations
          if (isNewChat && !conversationIdCaptured && possibleChatId) {
            conversationIdCaptured = true;
            console.log(`[Capture] New chat_id: ${possibleChatId} (from field: ${json.chat_id ? 'chat_id' : json.conversation_id ? 'conversation_id' : json.id ? 'id' : 'data.id'})`);
            if (onSessionCreated) onSessionCreated(possibleChatId);
          }
          
          // Capture parent_id from response.created
          // Handle both formats: direct object or with 'response.created' key
          let responseCreated = null;
          if (json['response.created']) {
            responseCreated = json['response.created'];
          } else if (json.response && json.response.created) {
            responseCreated = json.response.created;
          }
          
          if (responseCreated && responseCreated.parent_id) {
            const parentIdFromStream = responseCreated.parent_id;
            console.log(`[Capture] Found parent_id in stream: ${parentIdFromStream}`);
            if (onMetadata) {
              console.log(`[Capture] Calling onMetadata with parent_id: ${parentIdFromStream}`);
              onMetadata({ parent_id: parentIdFromStream });
            } else {
              console.log('[Capture] onMetadata is not defined');
            }
          }
          
          // Extract content - try multiple paths
          let content = null;
          if (json.choices?.[0]?.delta?.content) {
            content = json.choices[0].delta.content;
          } else if (json.delta?.content) {
            content = json.delta.content;
          } else if (json.content) {
            content = json.content;
          }
          
          if (content) {
            fullContent += content;
            if (onContent) onContent(content);
          }
        } catch (e) {
          // Skip non-JSON lines
          if (chunkCount <= 2) {
            console.log(`[DEBUG] Non-JSON line: ${trimmed.slice(0, 200)}`);
          }
        }
      }
    }
    
    if (onDone) onDone(fullContent);
  } catch (error) {
    if (onError) onError(error);
    else console.error('[Error]', error.message);
  }
}

// ============================================================================
// Main Test
// ============================================================================

async function main() {
  // Generate random secret number
  const secretNumber = Math.floor(Math.random() * 9000 + 1000);
  console.log('=============================================');
  console.log('  Qwen Hardcoded Test');
  console.log(`  Secret: ${secretNumber}`);
  console.log('=============================================\n');

  // Turn 1: Create chat first, then send message
  console.log('[Turn 1] Creating chat...');
  let conversationId = null;
  try {
    conversationId = await createChat();
    console.log(`[Turn 1] Chat created with ID: ${conversationId}`);
  } catch (error) {
    console.error(`[Turn 1] Failed to create chat: ${error.message}`);
    process.exit(1);
  }
  
  console.log('[Turn 1] Sending secret number...');
  
  let turn1Response = '';
  let parentId = null;
  
  await sendMessage({
    messages: [{ role: 'user', content: `Secret number: ${secretNumber}. Remember it. Reply: Got it ${secretNumber}` }],
    conversationId: conversationId,
    onContent: (chunk) => {
      process.stdout.write(chunk);
      turn1Response += chunk;
    },
    onMetadata: (meta) => {
      if (meta.parent_id) {
        parentId = meta.parent_id;
        console.log(`\n[Capture] parent_id: ${parentId}`);
      }
    },
    onDone: () => {
      console.log('\n');
    },
    onError: (error) => {
      console.error(`\n[Turn 1 Error] ${error.message}`);
      process.exit(1);
    }
  });

  if (!conversationId) {
    console.error('[FAIL] No conversationId captured from response');
    process.exit(1);
  }

  console.log(`[Turn 1 Complete] Response length: ${turn1Response.length} chars\n`);

  // Wait a moment before next request
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Turn 2: Ask for the secret number (using existing conversationId)
  console.log('[Turn 2] Asking for secret number (using conversationId only)...');
  
  // Debug: log parentId before sending turn 2
  console.log(`[Turn 2] Using parent_id: ${parentId || '(null)'}`);
  
  let turn2Response = '';
  
  await sendMessage({
    messages: [{ role: 'user', content: 'What was the secret number? Reply with the number only.' }],
    conversationId: conversationId,
    parentMessageId: parentId,  // Send parent_id to maintain context
    onContent: (chunk) => {
      process.stdout.write(chunk);
      turn2Response += chunk;
    },
    onDone: () => {
      console.log('\n');
    },
    onError: (error) => {
      console.error(`\n[Turn 2 Error] ${error.message}`);
      process.exit(1);
    }
  });

  console.log(`[Turn 2 Complete] Response: "${turn2Response.trim()}"\n`);

  // Verify
  console.log('=============================================');
  console.log(`  Secret planted : ${secretNumber}`);
  console.log(`  Qwen recalled  : ${turn2Response.trim()}`);
  console.log('=============================================');

  if (turn2Response.includes(secretNumber.toString())) {
    console.log('  [PASS] Context preserved!');
    process.exit(0);
  } else {
    console.log('  [FAIL] Context lost!');
    process.exit(1);
  }
}

// Run main
main().catch(console.error);