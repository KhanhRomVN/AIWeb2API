import { ConversationTab } from '../types';

export const createDefaultTab = (id?: string): ConversationTab => {
  return {
    id: id || crypto.randomUUID(),
    title: 'New Chat',

    // Conversation state
    messages: [],
    activeChatId: null,
    conversationTitle: '',

    // Provider & account
    selectedProvider: '',
    selectedAccount: '',

    // Model selections - will be populated dynamically from cache
    providerModels: {},
    providerModelsList: {},

    // UI state
    input: '',
    attachments: [],
    tokenCount: 0,
    accumulatedUsage: 0,
    inputTokenCount: 0,

    // Settings
    thinkingEnabled: true,
    searchEnabled: false,
  };
};

export const getTabTitle = (tab: ConversationTab): string => {
  if (tab.conversationTitle) return tab.conversationTitle;
  if (tab.messages.length > 0) {
    // Extract first user message as title
    const firstUserMessage = tab.messages.find((m) => m.role === 'user');
    if (firstUserMessage) {
      return (
        firstUserMessage.content.slice(0, 30) + (firstUserMessage.content.length > 30 ? '...' : '')
      );
    }
  }
  return tab.title || 'New Chat';
};
