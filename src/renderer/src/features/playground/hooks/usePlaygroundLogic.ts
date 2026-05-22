import { useState, useEffect, useRef, useCallback } from 'react';
import { Message, Account, PendingAttachment, ConversationTab } from '../types';

import { getCachedModels, fetchAndCacheModels } from '../../../utils/model-cache';
import { getApiBaseUrl } from '../../../utils/apiUrl';
import { fetchProviders } from '../../../config/providers';
import { useWorkspaces } from '../../../shared/hooks/tauri/useWorkspaces';
import { callBackend } from '../../../shared/utils/backend';

export const usePlaygroundLogic = ({
  activeTab,
  activeTabId,
  onUpdateTab,
}: {
  activeTab?: ConversationTab;
  activeTabId?: string;
  onUpdateTab?: (id: string, data: Partial<ConversationTab>) => void;
}) => {
  const { listWorkspaces, unlinkWorkspace } = useWorkspaces();

  // Load state from localStorage on mount

  const [messages, setMessages] = useState<Message[]>(() => activeTab?.messages || []);
  const [input, setInput] = useState(() => activeTab?.input || '');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [providersList, setProvidersList] = useState<any[]>([]);
  const [streamEnabled, setStreamEnabled] = useState(true);
  const [temperature, setTemperature] = useState<number>(() => activeTab?.temperature ?? 0.7);

  const [availableWorkspaces, setAvailableWorkspaces] = useState<any[]>([]);

  const [selectedProvider, setSelectedProvider] = useState<string>(
    () => (activeTab?.selectedProvider as any) || localStorage.getItem('elara_last_provider') || '',
  );
  const [selectedAccount, setSelectedAccount] = useState<string>(
    () => activeTab?.selectedAccount || localStorage.getItem('elara_last_account') || '',
  );
  const [loading, setLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [, setCurrentMessageId] = useState<number | null>(null);

  const [thinkingEnabled, setThinkingEnabled] = useState(() => activeTab?.thinkingEnabled ?? true);
  const [searchEnabled, setSearchEnabled] = useState(() => activeTab?.searchEnabled ?? false);
  const [attachments, setAttachments] = useState<PendingAttachment[]>(
    () => activeTab?.attachments || [],
  );
  const [tokenCount, setTokenCount] = useState(() => activeTab?.tokenCount || 0);
  const [inputTokenCount, setInputTokenCount] = useState(() => activeTab?.inputTokenCount || 0);
  const [accumulatedUsage, setAccumulatedUsage] = useState(() => activeTab?.accumulatedUsage || 0);

  const [language, setLanguage] = useState<string | null>(() => {
    return localStorage.getItem('elara_preferred_language');
  });

  useEffect(() => {
    const handleStorageChange = () => {
      setLanguage(localStorage.getItem('elara_preferred_language'));
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Fetch available workspaces from persistent storage - only once on mount
  useEffect(() => {
    const fetchWorkspaces = async () => {
      try {
        const data = await listWorkspaces();
        setAvailableWorkspaces(data || []);
      } catch (error) {
        console.error('Failed to fetch persistent workspaces:', error);
      }
    };
    fetchWorkspaces();
  }, []); // Empty dependency - only run once on mount

  const [activeChatId, setActiveChatId] = useState<string | null>(
    () => activeTab?.activeChatId || null,
  );
  const [conversationTitle, setConversationTitle] = useState<string>(
    () => activeTab?.conversationTitle || '',
  );

  // Model selections - Mapping provider_id to selected model_id
  const [providerModels, setProviderModels] = useState<Record<string, string>>(() => {
    if (activeTab?.providerModels) return activeTab.providerModels;
    try {
      const saved = localStorage.getItem('elara_last_provider_models');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  // Save configuration to localStorage
  useEffect(() => {
    if (selectedProvider) localStorage.setItem('elara_last_provider', selectedProvider);
    if (selectedAccount) localStorage.setItem('elara_last_account', selectedAccount);
    if (providerModels && Object.keys(providerModels).length > 0) {
      localStorage.setItem('elara_last_provider_models', JSON.stringify(providerModels));
    }
  }, [selectedProvider, selectedAccount, providerModels]);

  // Model lists - Mapping provider_id to list of models
  const [providerModelsList, setProviderModelsList] = useState<Record<string, any[]>>(
    () => activeTab?.providerModelsList || {},
  );

  const estimateTokens = (text: string): number => {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  };

  // Helper to normalize file input
  const itemsToFileArray = (items: FileList | File[]): File[] => {
    if (Array.isArray(items)) {
      return items;
    }
    return Array.from(items);
  };

  const handleFileSelect = async (files: FileList | File[] | null) => {
    if (!files) return;
    const newFiles = itemsToFileArray(files);

    const newAttachments: PendingAttachment[] = newFiles.map((file) => ({
      id: Math.random().toString(36).substring(7),
      file,
      status: 'pending',
      previewUrl: URL.createObjectURL(file),
      progress: 0,
    }));

    setAttachments((prev) => [...prev, ...newAttachments]);
  };

  // Auto-disable search if conflict with upload
  useEffect(() => {
    const providerConfig = providersList.find(
      (p) => p.provider_id.toLowerCase() === selectedProvider.toLowerCase(),
    );
    if (providerConfig?.conflict_search_with_upload && attachments.length > 0 && searchEnabled) {
      setSearchEnabled(false);
    }
  }, [attachments.length, searchEnabled, selectedProvider, providersList]);

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // Handle File Uploads (Smart Upload Management) - debounced
  useEffect(() => {
    const uploadPendingFiles = async () => {
      // Check if model supports upload
      const providerKey = selectedProvider.toLowerCase();
      const models = providerModelsList[providerKey] || [];
      const selectedModelId = providerModels[providerKey];
      const model = models.find((m) => m.id === selectedModelId);
      if (!model?.is_upload) return;

      // If no account selected, we wait (files remain in 'pending' state)
      if (!selectedAccount) return;

      const account = accounts.find((a) => a.id === selectedAccount);
      if (!account) return;

      // Identify files needing upload
      const itemsToUpload = attachments.filter(
        (a) =>
          a.status === 'pending' ||
          (a.status === 'completed' && a.accountId !== selectedAccount) ||
          (a.status === 'error' && a.accountId !== selectedAccount),
      );

      if (itemsToUpload.length === 0) return;

      // Mark as uploading immediately to prevent double-triggering
      setAttachments((prev) =>
        prev.map((a) =>
          itemsToUpload.some((i) => i.id === a.id) ? { ...a, status: 'uploading', progress: 0 } : a,
        ),
      );

      try {
        // Process uploads in parallel
        itemsToUpload.forEach(async (att) => {
          try {
            const formData = new FormData();
            formData.append('file', att.file);

            const baseUrl = getApiBaseUrl();
            const uploadUrl = `${baseUrl}/v1/chat/accounts/${account.id}/uploads`;

            const res = await fetch(uploadUrl, {
              method: 'POST',
              body: formData,
            });

            if (res.ok) {
              const data = await res.json();
              if (data.success && data.data?.file_id) {
                setAttachments((prev) =>
                  prev.map((p) =>
                    p.id === att.id
                      ? {
                          ...p,
                          status: 'completed',
                          fileId: data.data.file_id,
                          accountId: account.id,
                          progress: 100,
                        }
                      : p,
                  ),
                );
                if (data.data.token_usage) {
                  setAccumulatedUsage((prev) => prev + data.data.token_usage);
                }
              } else {
                throw new Error(data.error || 'Invalid upload response');
              }
            } else {
              const errText = await res.text();
              throw new Error(`Upload failed ${res.status}: ${errText}`);
            }
          } catch (err) {
            console.error(`[Smart Upload] Error uploading ${att.file.name}:`, err);
            setAttachments((prev) =>
              prev.map((p) => (p.id === att.id ? { ...p, status: 'error' } : p)),
            );
          }
        });
      } catch (e) {
        console.error('[Smart Upload] System error:', e);
      }
    };

    // Debounce upload by 500ms to avoid multiple triggers
    const timeoutId = setTimeout(uploadPendingFiles, 500);
    return () => clearTimeout(timeoutId);
  }, [attachments, selectedAccount, selectedProvider, accounts, providersList]);

  const handleDeleteWorkspace = async (id: string) => {
    try {
      await unlinkWorkspace(id);
      // Refresh list
      const updatedList = await listWorkspaces();
      setAvailableWorkspaces(updatedList);
    } catch (error) {
      console.error('Failed to delete workspace:', error);
    }
  };

  const handleStop = useCallback(async () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
    setLoading(false);
    setIsStreaming(false);
    setCurrentMessageId(null);
  }, [abortController]);

  // Sync state ref
  // Sync state to ref for cleanup - Only sync on tab change/unmount
  const stateRef = useRef({
    messages,
    input,
    selectedProvider,
    selectedAccount,
    providerModels,
    providerModelsList,
    thinkingEnabled,
    searchEnabled,
    attachments,
    tokenCount,
    accumulatedUsage,
    inputTokenCount,
    activeChatId,
    conversationTitle,
    temperature,
    language,
  });

  // Update ref only when needed (not on every render)
  useEffect(() => {
    if (onUpdateTab && activeTabId) {
      stateRef.current = {
        messages,
        input,
        selectedProvider,
        selectedAccount,
        providerModels,
        providerModelsList,
        thinkingEnabled,
        searchEnabled,
        attachments,
        tokenCount,
        accumulatedUsage,
        inputTokenCount,
        activeChatId,
        conversationTitle,
        temperature,
        language,
      };
    }
  }, [onUpdateTab, activeTabId]); // Only sync when tab changes

  // Sync state on unmount or tab change
  useEffect(() => {
    return () => {
      if (onUpdateTab && activeTabId) {
        onUpdateTab(activeTabId, stateRef.current);
      }
    };
  }, [activeTabId, onUpdateTab]);

  // Sync title immediately (debounced)
  const lastSyncedTitleRef = useRef<string>('');
  useEffect(() => {
    if (
      onUpdateTab &&
      activeTabId &&
      conversationTitle &&
      conversationTitle !== lastSyncedTitleRef.current
    ) {
      lastSyncedTitleRef.current = conversationTitle;
      const timeoutId = setTimeout(() => {
        onUpdateTab(activeTabId, { conversationTitle });
      }, 500);
      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [conversationTitle, activeTabId, onUpdateTab]);

  // Sync messages on done (debounced)
  useEffect(() => {
    if (!isStreaming && messages.length > 0 && onUpdateTab && activeTabId) {
      const timeoutId = setTimeout(() => {
        onUpdateTab(activeTabId, { messages, tokenCount, accumulatedUsage });
      }, 1000);
      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [isStreaming, messages, tokenCount, accumulatedUsage, activeTabId, onUpdateTab]);

  // Fetch Providers - Only once on mount
  useEffect(() => {
    const loadProviders = async () => {
      try {
        const allProviders = await fetchProviders(8888);
        setProvidersList(allProviders);
      } catch (error) {
        console.error('Failed to fetch providers:', error);
      }
    };
    loadProviders();
  }, []); // Empty dependency - only run once

  // Fetch Accounts when provider changes (debounced)
  useEffect(() => {
    const fetchAccountsByProvider = async () => {
      if (!selectedProvider) {
        setAccounts([]);
        setSelectedAccount('');
        return;
      }

      try {
        // Find the correct provider ID from the list
        // selectedProvider might hold name or ID
        const providerConfig = providersList.find(
          (p) => p.provider_name === selectedProvider || p.provider_id === selectedProvider,
        );
        const providerId = providerConfig?.provider_id || selectedProvider.toLowerCase();

        const res = await callBackend(
          `/v1/accounts?page=1&limit=10&provider_id=${encodeURIComponent(providerId)}`,
        );
        if (res) {
          const accountsList = res.data?.accounts || [];
          setAccounts(accountsList);
          if (accountsList.length > 0) {
            setSelectedAccount(accountsList[0].id);
          } else {
            setSelectedAccount('');
          }
        } else {
          console.error('[Playground] Failed to fetch accounts, status:', res.status);
        }
      } catch (error) {
        console.error('Failed to fetch accounts:', error);
        setAccounts([]);
      }
    };

    // Debounce account fetching by 300ms
    const timeoutId = setTimeout(fetchAccountsByProvider, 300);
    return () => clearTimeout(timeoutId);
  }, [selectedProvider]);

  // Fetch Models using cache - trigger on provider selection (debounced)
  useEffect(() => {
    const fetchModels = async () => {
      if (!selectedProvider) return;

      try {
        // Find the correct provider ID from the list
        // selectedProvider currently holds the provider NAME (e.g. "QwQ")
        // but we need the ID (e.g. "qwq") for the API call
        const providerConfig = providersList.find(
          (p) => p.provider_name === selectedProvider || p.provider_id === selectedProvider,
        );
        const providerId = providerConfig?.provider_id || selectedProvider;

        const updateModels = (models: any[]) => {
          // maintain compatibility with UI which uses selectedProvider (name) as key
          // or we should consistently use the same key.
          // looking at index.tsx: providerModels[selectedProvider.toLowerCase()]
          // so we should probably stick to lowercased selectedProvider for the key
          // ensuring it matches what index.tsx expects.
          const providerKey = selectedProvider.toLowerCase();

          setProviderModelsList((prev) => ({
            ...prev,
            [providerKey]: models,
          }));

          if (!providerModels[providerKey] && models.length > 0) {
            setProviderModels((prev) => ({
              ...prev,
              [providerKey]: models[0].id || models[0].name || '',
            }));
          }
        };

        // Try cache first
        const cached = getCachedModels(providerId);
        if (cached && cached.length > 0) {
          updateModels(cached);
          return; // Use cache immediately, skip API call
        }

        // Only fetch if no cache
        const models = await fetchAndCacheModels(providerId, '', 8888);
        if (models.length > 0) {
          updateModels(models);
        }
      } catch (error) {
        console.error('Failed to fetch models:', error);
      }
    };

    // Debounce model fetching by 500ms
    const timeoutId = setTimeout(fetchModels, 500);
    return () => clearTimeout(timeoutId);
  }, [selectedProvider, providersList]);

  // Input Token Count
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!input) {
        setInputTokenCount(0);
        return;
      }

      // Claude token counting
    }, 500);
    return () => clearTimeout(timer);
  }, [input, selectedProvider, providerModels]);

  const handleSend = async (
    overrideContent?: string,
    hiddenContent?: string,
    uiHidden?: boolean,
  ) => {
    const finalInput = overrideContent ?? input;
    if (!finalInput.trim()) return;

    if (!selectedProvider) {
      console.warn('[Chat] No provider selected');
      return;
    }

    const providerKey = selectedProvider.toLowerCase();
    const modelId = providerModels[providerKey];
    if (!modelId) {
      console.warn('[Chat] No model selected for provider:', selectedProvider);
      return;
    }

    setTokenCount((prev) => prev + accumulatedUsage);
    setAccumulatedUsage(0);

    const account = accounts.find((acc) => acc.id === selectedAccount);
    if (!account && selectedAccount) {
      console.warn('Selected account not found');
      return;
    }

    const messageAttachments = attachments.map((att) => ({
      id: att.id,
      name: att.file.name,
      type: att.file.type.startsWith('image/') ? 'image' : 'file',
      url: att.previewUrl,
      size: att.file.size,
      mimeType: att.file.type,
    }));

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: finalInput,
      hiddenText: hiddenContent,
      uiHidden: uiHidden,
      timestamp: new Date(),
      attachments:
        !overrideContent && messageAttachments.length > 0 ? (messageAttachments as any) : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentAttachments = overrideContent ? [] : attachments;
    if (!overrideContent) {
      setInput('');
      setAttachments([]);
    }
    setLoading(true);

    try {
      const account = accounts.find((acc) => acc.id === selectedAccount);

      // Check if provider requires account
      const providerConfig = providersList.find(
        (p) => p.provider_id.toLowerCase() === selectedProvider.toLowerCase(),
      );
      const requiresAccount = providerConfig?.auth_method && providerConfig.auth_method.length > 0;

      if (!account && requiresAccount) throw new Error('Account not found');

      // Use new unified endpoint
      const baseUrl = getApiBaseUrl();
      const url = `${baseUrl}/v1/chat/accounts/messages`;

      const controller = new AbortController();
      setAbortController(controller);

      const uploadedFileIds: string[] = [];
      currentAttachments.forEach((att) => {
        if (att.fileId) uploadedFileIds.push(att.fileId);
      });

      // Helper to get model ID for providers without explicit state
      const getProviderModel = (providerId: string): string => {
        const id = providerModels[providerId.toLowerCase()];
        if (id) return id;
        const cached = getCachedModels(providerId);
        return cached && cached.length > 0 ? cached[0].id : '';
      };

      // Build first message content with codebase context if enabled
      let firstMessageContent = hiddenContent ?? finalInput;

      if (messages.length === 0 && !overrideContent) {
        // Add language constraint if selected
        if (language) {
          let langName = language;
          try {
            const displayNames = new Intl.DisplayNames(['en'], { type: 'language' });
            langName = displayNames.of(language) || language;
          } catch (e) {
            // Fallback to code if DisplayNames fails
          }
          const langPrompt = `\n\nIMPORTANT: Please respond to the user using ${langName} language.`;
          firstMessageContent += langPrompt;
        }
      }

      // Estimate input tokens
      const currentInputTokens =
        inputTokenCount > 0
          ? inputTokenCount
          : estimateTokens(JSON.stringify(messages) + firstMessageContent);

      console.log(
        '[TokenDebug] currentInputTokens:',
        currentInputTokens,
        'inputTokenCount:',
        inputTokenCount,
      );

      const targetProviderId = account?.provider_id || selectedProvider;
      const targetAccountId = account?.id || null;
      const targetModelId = getProviderModel(targetProviderId);

      const response = await fetch(url, {
        signal: controller.signal,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: targetModelId,
          providerId: targetProviderId,
          accountId: targetAccountId,
          messages: [
            ...messages.map((m) => ({ role: m.role, content: m.hiddenText ?? m.content })),
            {
              role: 'user',
              content: firstMessageContent,
            },
          ],
          conversationId: activeChatId && activeChatId !== 'new-session' ? activeChatId : '',
          stream: streamEnabled,
          search: searchEnabled,
          ref_file_ids: uploadedFileIds,
          thinking: (() => {
            return thinkingEnabled;
          })(),
          temperature,
        }),
      });

      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const assistantMessageId = crypto.randomUUID();
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setLoading(false);

      let accumulatedContent = '';
      let accumulatedMetadata: any = {};

      if (streamEnabled) {
        // Handle streaming response
        setIsStreaming(true);

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        if (!reader) throw new Error('No response body');

        let readerDone = false;
        while (!readerDone) {
          const result = await reader.read();
          readerDone = result.done;
          const value = result.value;
          if (readerDone) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);

                // Handle content chunk: { content: "..." }
                if (parsed.content) {
                  accumulatedContent += parsed.content;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMessageId
                        ? { ...m, content: m.content + parsed.content }
                        : m,
                    ),
                  );
                }

                // Handle thinking chunk: { thinking: "..." }
                if (parsed.thinking) {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMessageId
                        ? {
                            ...m,
                            thinking: (m.thinking || '') + parsed.thinking,
                          }
                        : m,
                    ),
                  );
                }

                // Handle metadata: { meta: { conversation_id, conversation_title, thinking_elapsed } }
                if (parsed.meta) {
                  accumulatedMetadata = { ...accumulatedMetadata, ...parsed.meta };
                  if (parsed.meta.conversation_id) {
                    setActiveChatId(parsed.meta.conversation_id);
                  }
                  if (parsed.meta.conversation_title) {
                    setConversationTitle(parsed.meta.conversation_title);
                  }
                  if (parsed.meta.total_token !== undefined) {
                    // Logic fix: Ensure total_token doesn't drop below input tokens
                    // Some providers might return only output usage in stream
                    const reportedTotal = parsed.meta.total_token;
                    const currentOutput = estimateTokens(accumulatedContent);
                    console.log('[TokenDebug] Stream meta:', {
                      reportedTotal,
                      currentOutput,
                      currentInputTokens,
                    });
                    setTokenCount(Math.max(reportedTotal, currentInputTokens + currentOutput));
                  }
                  if (parsed.meta.accountId && !selectedAccount) {
                    setSelectedAccount(parsed.meta.accountId);
                  }
                  if (parsed.meta.thinking_elapsed !== undefined) {
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMessageId
                          ? { ...m, thinking_elapsed: parsed.meta.thinking_elapsed }
                          : m,
                      ),
                    );
                  }
                }
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
        }
        setIsStreaming(false);
      } else {
        // Handle non-streaming response
        const result = await response.json();
        if (result.success && result.message) {
          accumulatedContent = result.message.content;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId ? { ...m, content: result.message.content } : m,
            ),
          );
        }
        if (result.metadata) {
          accumulatedMetadata = result.metadata;
          if (result.metadata.conversation_id) {
            setActiveChatId(result.metadata.conversation_id);
          }
          if (result.metadata.conversation_title) {
            setConversationTitle(result.metadata.conversation_title);
          }
          if (result.metadata.total_token !== undefined) {
            setTokenCount(result.metadata.total_token);
          }
          if (result.metadata.accountId && !selectedAccount) {
            setSelectedAccount(result.metadata.accountId);
          }
        }
      }

      // Calculate and report metrics
      const finalInputTokens = currentInputTokens;
      const finalOutputTokens = estimateTokens(accumulatedContent);
      // Prefer provider metadata if available and reasonable
      const providerTotal = accumulatedMetadata?.total_token || 0;
      const totalTokens = Math.max(providerTotal, finalInputTokens + finalOutputTokens);

      console.log('[TokenDebug] Final Metrics:', {
        finalInputTokens,
        finalOutputTokens,
        providerTotal,
        totalTokens,
        accumulatedMetadata,
      });

      // Report to backend
      if (account) {
        try {
          const baseUrl = getApiBaseUrl();
          const metricsUrl = `${baseUrl}/v1/stats/metrics`;
          fetch(metricsUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              account_id: account.id,
              provider_id: account.provider_id,
              model_id: getProviderModel(account.provider_id),
              conversation_id: activeChatId, // Session ID is updated during stream
              total_tokens: totalTokens,
              timestamp: Date.now(),
            }),
          }).catch((err) => console.error('Failed to report metrics', err));
        } catch (e) {
          console.error('Error reporting metrics', e);
        }
      }

      // Fetch updated title if still "New Chat" (REMOVED HISTORY FETCH)
      if (
        !conversationTitle ||
        conversationTitle === 'New Chat' ||
        conversationTitle === 'Untitled'
      ) {
        // Logic to update title from history removed
      }
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === 'AbortError' || error.message.includes('aborted'))
      ) {
        return;
      }
      console.error('Failed to send message:', error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Failed'}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      setIsStreaming(false);
    }
  };

  const startNewChat = () => {
    setActiveChatId(null);
    setMessages([]);
    setInput('');
    setConversationTitle('');
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const target = e.target;
    target.style.height = 'auto';
    const maxHeight = 240;
    const newHeight = Math.min(target.scrollHeight, maxHeight);
    target.style.height = `${newHeight}px`;
    const newValue = target.value;
    setInput(newValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return {
    messages,
    setMessages,
    input,
    setInput,
    accounts,
    selectedProvider,
    setSelectedProvider,
    selectedAccount,
    setSelectedAccount,
    loading,
    isStreaming,
    thinkingEnabled,
    setThinkingEnabled,
    searchEnabled,
    setSearchEnabled,
    attachments,
    handleFileSelect,
    handleRemoveAttachment,
    tokenCount,
    accumulatedUsage,
    inputTokenCount,
    activeChatId,
    conversationTitle,
    providerModels,
    setProviderModels,
    providerModelsList,
    setProviderModelsList,
    providersList,
    streamEnabled,
    setStreamEnabled,
    handleSend,
    handleStop,
    handleInput,
    handleKeyDown,
    startNewChat,
    temperature,
    setTemperature,
    language,
    setLanguage: (lang: string | null) => {
      setLanguage(lang);
      if (lang) {
        localStorage.setItem('elara_preferred_language', lang);
      } else {
        localStorage.removeItem('elara_preferred_language');
      }
    },
    availableWorkspaces,
    handleDeleteWorkspace,
  };
};
