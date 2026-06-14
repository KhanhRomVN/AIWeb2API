(function() {
  console.log('[Inject] Z.AI Bridge Network Interception loaded.');

  // ← NEW: Search mode flag — set by content.js via postMessage
  window.__zai_search_enabled = false;

  // ← NEW: Listen for search enable message from content.js
  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    if (event.data && event.data.type === 'Z_AI_ENABLE_SEARCH') {
      console.log('[Inject] 🔍 Search enable message received. Setting __zai_search_enabled = true');
      window.__zai_search_enabled = true;
    }
  });

  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const [request, config] = args;
    let url = '';
    
    if (request instanceof Request) {
      url = request.url;
    } else if (typeof request === 'string') {
      url = request;
    }

    // Chỉ can thiệp vào endpoint chat của Z.AI
    if (url.includes('/api/v2/chat/completions') || url.includes('/api/agent/v2/chat/completions')) {
      console.log('[Inject] Target API detected:', url.split('?')[0]);

      // ← NEW: Check if search mode is requested → modify fetch payload
      const searchEnabled = window.__zai_search_enabled === true;
      let modifiedArgs = args;

      if (searchEnabled) {
        try {
          let body = null;

          // Extract body from args
          if (request instanceof Request) {
            const cloned = request.clone();
            body = await cloned.json();
          } else if (config && config.body) {
            if (typeof config.body === 'string') {
              body = JSON.parse(config.body);
            } else {
              body = config.body;
            }
          }

          if (body) {
            // Modify features.web_search
            if (body.features) {
              body.features.web_search = true;
              console.log('[Inject] 🔍 Search mode: features.web_search set to TRUE');
            } else {
              body.features = { image_generation: false, web_search: true, auto_web_search: false, preview_mode: true, flags: [] };
              console.log('[Inject] 🔍 Search mode: created features with web_search = TRUE');
            }

            // Rebuild args with modified body
            const bodyStr = JSON.stringify(body);

            if (request instanceof Request) {
              modifiedArgs = [new Request(request, {
                body: bodyStr,
                method: request.method,
                headers: request.headers,
              })];
            } else {
              modifiedArgs = [request, { ...config, body: bodyStr }];
            }

            // Reset flag after use
            window.__zai_search_enabled = false;
          }
        } catch (e) {
          console.error('[Inject] Failed to modify request body for search:', e);
          window.__zai_search_enabled = false;
        }
      }
      
      // Gọi request (có thể đã modified)
      const response = await originalFetch.apply(this, modifiedArgs);
      
      // 🚨 WAF Detection - Detect blocks before processing stream
      if (response.status === 403 || response.status === 429 || response.status === 503) {
        console.log('[Inject] 🚨 WAF/Rate limit detected! Status:', response.status);
        window.postMessage({
          type: 'Z_AI_WAF_BLOCK',
          status: response.status
        }, '*');
        return response;
      }
      
      const contentType = response.headers.get('Content-Type') || '';

      if (contentType.includes('text/event-stream')) {
        console.log('[Inject] SSE Stream detected. Intercepting via TransformStream (no clone)...');
        
        let sseBuffer = '';
        const decoder = new TextDecoder();
        
        const interceptor = new TransformStream({
          transform(chunk, controller) {
            try {
              const text = decoder.decode(chunk, { stream: true });
              sseBuffer += text;
              const lines = sseBuffer.split('\n');
              sseBuffer = lines.pop() || '';
              
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const jsonStr = line.substring(6).trim();
                  if (jsonStr === '[DONE]') continue;
                  try {
                    const parsed = JSON.parse(jsonStr);
                    queuePostMessage(parsed);

                    // ← NEW: Detect usage data (phase: "other")
                    if (parsed.data && parsed.data.phase === 'other' && parsed.data.usage) {
                      console.log('[Inject] 📊 Usage data from Z.AI API:', JSON.stringify(parsed.data.usage));
                      window.postMessage({
                        type: 'Z_AI_USAGE',
                        usage: parsed.data.usage,
                      }, '*');
                    }

                    // ← NEW: Detect search results
                    if (parsed.data && parsed.data.search_results) {
                      console.log('[Inject] 🔍 Search results detected');
                      window.postMessage({
                        type: 'Z_AI_SEARCH_RESULTS',
                        results: parsed.data.search_results,
                      }, '*');
                    }

                    // ← NEW: Detect search phase
                    if (parsed.data && parsed.data.phase === 'searching') {
                      window.postMessage({
                        type: 'Z_AI_SEARCH_PHASE',
                        phase: 'searching',
                      }, '*');
                    }
                  } catch (e) {}
                }
              }
            } catch (e) {
              console.error('[Inject] SSE transform error:', e);
            }
            
            controller.enqueue(chunk);
          },
          flush() {
            if (sseBuffer.trim()) {
              const line = sseBuffer.trim();
              if (line.startsWith('data: ')) {
                const jsonStr = line.substring(6).trim();
                if (jsonStr !== '[DONE]') {
                  try {
                    const parsed = JSON.parse(jsonStr);
                    queuePostMessage(parsed);
                  } catch (e) {}
                }
              }
            }
            flushInjectBuffer();
            window.postMessage({ type: 'Z_AI_STREAM_END_RAW' }, '*');
          }
        });
        
        const interceptedBody = response.body.pipeThrough(interceptor);
        
        const newHeaders = new Headers(response.headers);
        newHeaders.delete('content-encoding');
        newHeaders.delete('content-length');
        
        return new Response(interceptedBody, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders,
        });
      }
      return response;
    }

    return originalFetch.apply(this, args);
  };

  // Che giấu việc patch fetch để vượt qua kiểm tra dấu vân tay của WAF
  try {
    const nativeToString = Function.prototype.toString;
    Function.prototype.toString = function() {
      if (this === window.fetch) {
        return "function fetch() { [native code] }";
      }
      return nativeToString.apply(this, arguments);
    };
    window.fetch.toString = function() {
      return "function fetch() { [native code] }";
    };
  } catch (e) {
    console.error('[Inject] Failed to patch toString:', e);
  }

  // ✅ Fix P1: Tăng buffer từ 20ms → 100ms + giới hạn batch size
  let injectBuffer = [];
  let injectTimer = null;
  const MAX_BATCH_SIZE = 50;

  function queuePostMessage(parsed) {
    injectBuffer.push(parsed);
    if (injectBuffer.length >= MAX_BATCH_SIZE) {
      flushInjectBuffer();
      return;
    }
    if (!injectTimer) {
      injectTimer = setTimeout(() => {
        flushInjectBuffer();
      }, 100);
    }
  }

  function flushInjectBuffer() {
    if (injectTimer) {
      clearTimeout(injectTimer);
      injectTimer = null;
    }
    if (injectBuffer.length > 0) {
      window.postMessage({
        type: 'Z_AI_SSE_DELTAS',
        payloads: [...injectBuffer]
      }, '*');
      injectBuffer = [];
    }
  }

})();