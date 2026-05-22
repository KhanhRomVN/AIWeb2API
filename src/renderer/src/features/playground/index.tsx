import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ModelSelector } from './components/ModelSelector';
import { CustomSelect } from './components/CustomSelect';
import { AccountAvatar } from '../accounts/components/AccountAvatar';

import { ChatArea } from './components/ChatArea';
import { InputArea } from './components/InputArea';
import { WelcomeScreen } from './components/WelcomeScreen';
import { TabBar } from './components/TabBar';
import { SettingsSidebar } from './components/SettingsSidebar';
import { ConversationTab } from './types';
import { usePlaygroundLogic } from './hooks/usePlaygroundLogic';
import { useUI } from '../../core/contexts/UIContext';
import { useGitStatus } from './hooks/useGitStatus';
import { toast } from 'sonner';
import { useGit } from '../../shared/hooks/tauri/useGit';

export const PlaygroundPage = ({
  tabs,
  activeTabId,
  onTabClick,
  onTabClose,
  onNewTab,
  onUpdateTab,
}: {
  tabs?: ConversationTab[];
  activeTabId?: string;
  onTabClick?: (id: string) => void;
  onTabClose?: (id: string) => void;
  onNewTab?: () => void;
  onUpdateTab?: (id: string, data: Partial<ConversationTab>) => void;
} = {}) => {
  const navigate = useNavigate();
  const activeTab = tabs?.find((t) => t.id === activeTabId);

  const {
    messages,
    input,
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
    handleInput,
    handleKeyDown,
    handleSend,
    handleStop,
    startNewChat,
    providersList,
    streamEnabled,
    setStreamEnabled,
    temperature,
    setTemperature,
  } = usePlaygroundLogic({ activeTab, activeTabId, onUpdateTab });

  const { addFiles, diff } = useGit();

  const {} = useUI();

  // Settings Sidebar State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Git Status - for commit message generation only
  const { gitStatus } = useGitStatus(undefined);

  const handleGitCommit = async () => {
    try {
      toast.loading('Preparing Git changes...', { id: 'git-commit' });

      // 1. Git Add .
      await addFiles('.', ['.']);

      // 2. Get staged diff
      const stagedDiff = await diff('.', true);

      if (!stagedDiff) {
        toast.error('No changes to commit', { id: 'git-commit' });
        return;
      }

      // 3. Prepare AI Prompt
      const fullPrompt = `Generate a concise commit message for the following changes:\n\`\`\`diff\n${stagedDiff}\n\`\`\``;

      // 4. Start New Chat & Send
      startNewChat();

      // We need a small delay or use a more robust way to ensure startNewChat finished state updates
      // However, handleSend usually uses the current state.
      // In usePlaygroundLogic, handleSend uses messages from state.
      // Since startNewChat is sync (it just sets state), we can call handleSend.
      setTimeout(() => {
        handleSend(fullPrompt);
        toast.success('Generating commit message...', { id: 'git-commit' });
      }, 0);
    } catch (error: any) {
      console.error('Git Commit Automation failed:', error);
      toast.error('Git Error', {
        id: 'git-commit',
        description: error.message || 'Failed to automate git commit.',
      });
    }
  };

  const filteredAccounts = selectedProvider
    ? accounts.filter((acc) => acc.provider_id.toLowerCase() === selectedProvider.toLowerCase())
    : [];

  // Layout Logic
  const innerContent = (
    <div className="flex-1 flex overflow-hidden relative">
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-background relative">
        {tabs && onTabClick && onTabClose && onNewTab && (
          <TabBar
            tabs={tabs}
            activeTabId={activeTabId || ''}
            onTabClick={onTabClick}
            onTabClose={onTabClose}
            onNewTab={onNewTab}
            providersList={providersList}
          />
        )}

        <div className="flex-1 flex overflow-hidden relative">
          <div className="flex-1 flex flex-col min-w-0 bg-background relative">
            {messages.length === 0 ? (
              <WelcomeScreen
                dropdowns={
                  <div className="flex flex-wrap gap-4">
                    <CustomSelect
                      value={selectedProvider}
                      onChange={(val) => {
                        setSelectedProvider(val as any);
                        const providerAccounts = accounts.filter((acc) => acc.provider_id === val);
                        if (providerAccounts.length > 0) {
                          setSelectedAccount(providerAccounts[0].id);
                        } else {
                          setSelectedAccount('');
                        }
                      }}
                      options={providersList.map((p) => {
                        return {
                          value: p.provider_id,
                          label: p.provider_name,
                          icon: p.website
                            ? `https://www.google.com/s2/favicons?domain=${new URL(p.website).hostname}&sz=64`
                            : undefined,
                          disabled: !p.is_enabled,
                        };
                      })}
                      placeholder="Select Provider"
                    />
                    {selectedProvider && (
                      <div className="flex flex-row items-center gap-4">
                        <CustomSelect
                          value={selectedAccount}
                          onChange={setSelectedAccount}
                          options={filteredAccounts.map((acc) => ({
                            value: acc.id,
                            label: acc.email,
                            icon: (
                              <AccountAvatar
                                email={acc.email}
                                provider={acc.provider_id}
                                className="w-4 h-4 text-[8px]"
                              />
                            ),
                          }))}
                          placeholder={
                            filteredAccounts.length === 0 ? 'No account' : 'Select Account'
                          }
                          disabled={!selectedProvider || filteredAccounts.length === 0}
                        />
                        {(() => {
                          const providerKey = selectedProvider.toLowerCase();
                          const models = providerModelsList[providerKey] || [];
                          const selectedModel = providerModels[providerKey] || '';

                          const setModel = (val: string) => {
                            setProviderModels((prev) => ({ ...prev, [providerKey]: val }));
                          };

                          if (models.length > 0) {
                            const providerData = providersList.find(
                              (p) =>
                                p.provider_name.toLowerCase() === selectedProvider?.toLowerCase() ||
                                p.provider_id?.toLowerCase() === selectedProvider?.toLowerCase(),
                            );
                            const nameToDisplay = providerData?.provider_name || selectedProvider;

                            return (
                              <ModelSelector
                                value={selectedModel}
                                onChange={setModel}
                                models={models}
                                placeholder={`Select ${nameToDisplay} Model`}
                              />
                            );
                          }

                          return null;
                        })()}
                      </div>
                    )}
                  </div>
                }
                input={input}
                handleInput={handleInput}
                handleKeyDown={handleKeyDown}
                handleSend={handleSend}
                loading={loading}
                isStreaming={isStreaming}
                selectedAccount={selectedAccount}
                selectedProvider={selectedProvider}
                thinkingEnabled={thinkingEnabled}
                setThinkingEnabled={setThinkingEnabled}
                searchEnabled={searchEnabled}
                setSearchEnabled={setSearchEnabled}
                onFileSelect={handleFileSelect}
                attachments={attachments}
                onRemoveAttachment={handleRemoveAttachment}
                streamEnabled={streamEnabled}
                setStreamEnabled={setStreamEnabled}
                supportsSearch={(() => {
                  const providerKey = selectedProvider.toLowerCase();
                  const models = providerModelsList[providerKey] || [];
                  const selectedModelId = providerModels[providerKey];
                  if (models && selectedModelId) {
                    const model = models.find((m) => m.id === selectedModelId);
                    return model?.is_search === true;
                  }
                  return false;
                })()}
                supportsUpload={(() => {
                  const providerKey = selectedProvider.toLowerCase();
                  const models = providerModelsList[providerKey] || [];
                  const selectedModelId = providerModels[providerKey];
                  if (models && selectedModelId) {
                    const model = models.find((m) => m.id === selectedModelId);
                    return model?.is_upload === true;
                  }
                  return false;
                })()}
                supportsThinking={(() => {
                  const providerKey = selectedProvider.toLowerCase();
                  const models = providerModelsList[providerKey] || [];
                  const selectedModelId = providerModels[providerKey];
                  if (models && selectedModelId) {
                    const model = models.find((m) => m.id === selectedModelId);
                    return model?.is_thinking === true;
                  }
                  return false;
                })()}
                temperature={temperature}
                setTemperature={setTemperature}
                isTemperatureSupported={true}
                onToggleSettings={() => setIsSettingsOpen(!isSettingsOpen)}
                onNavigateToSettings={() => navigate('/settings')}
              />
            ) : (
              <>
                <div className="h-9 border-b flex items-center justify-between px-4 bg-background/50 backdrop-blur-sm sticky top-0 z-10">
                  <div className="flex items-center gap-2 max-w-[300px] truncate">
                    {(() => {
                      const providerData = providersList.find(
                        (p) =>
                          p.provider_name.toLowerCase() === selectedProvider?.toLowerCase() ||
                          p.provider_id?.toLowerCase() === selectedProvider?.toLowerCase(),
                      );
                      const faviconUrl = providerData?.website
                        ? `https://www.google.com/s2/favicons?domain=${new URL(providerData.website).hostname}&sz=64`
                        : null;
                      const modelName = providerModels[selectedProvider?.toLowerCase()] || '';

                      return (
                        <>
                          {faviconUrl && (
                            <img
                              src={faviconUrl}
                              alt="Provider"
                              className="w-3.5 h-3.5 object-contain"
                            />
                          )}
                          <span className="text-[10px] font-bold text-foreground/80 tracking-tight uppercase">
                            {providerData?.provider_name || selectedProvider}
                          </span>
                          <span className="text-[10px] text-muted-foreground mx-1">•</span>
                          <span className="text-[10px] font-medium text-muted-foreground truncate">
                            {modelName}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                  <div className="text-sm font-semibold truncate flex-1 text-center flex items-center justify-center gap-2">
                    {conversationTitle || 'New Chat'}
                    {activeChatId && activeChatId !== 'new-session' && (
                      <span className="text-[9px] font-mono bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded uppercase">
                        #{activeChatId.substring(0, 8)}
                      </span>
                    )}
                  </div>
                  <div className="w-24 text-right text-[10px] text-muted-foreground mr-2 font-mono">
                    {(tokenCount + accumulatedUsage + inputTokenCount).toLocaleString()} tokens
                  </div>
                </div>

                <ChatArea messages={messages} loading={loading} isStreaming={isStreaming} />

                <InputArea
                  input={input}
                  handleInput={handleInput}
                  handleKeyDown={handleKeyDown}
                  handleSend={handleSend}
                  handleStop={handleStop}
                  loading={loading}
                  isStreaming={isStreaming}
                  selectedAccount={selectedAccount}
                  selectedProvider={selectedProvider}
                  thinkingEnabled={thinkingEnabled}
                  setThinkingEnabled={setThinkingEnabled}
                  searchEnabled={searchEnabled}
                  setSearchEnabled={setSearchEnabled}
                  onFileSelect={handleFileSelect}
                  attachments={attachments}
                  onRemoveAttachment={handleRemoveAttachment}
                  streamEnabled={streamEnabled}
                  setStreamEnabled={setStreamEnabled}
                  supportsSearch={(() => {
                    const providerKey = selectedProvider.toLowerCase();
                    const models = providerModelsList[providerKey] || [];
                    const selectedModelId = providerModels[providerKey];
                    if (models && selectedModelId) {
                      const model = models.find((m) => m.id === selectedModelId);
                      return model?.is_search === true;
                    }
                    return false;
                  })()}
                  supportsUpload={(() => {
                    const providerKey = selectedProvider.toLowerCase();
                    const models = providerModelsList[providerKey] || [];
                    const selectedModelId = providerModels[providerKey];
                    if (models && selectedModelId) {
                      const model = models.find((m) => m.id === selectedModelId);
                      return model?.is_upload === true;
                    }
                    return false;
                  })()}
                  supportsThinking={(() => {
                    const providerKey = selectedProvider.toLowerCase();
                    const models = providerModelsList[providerKey] || [];
                    const selectedModelId = providerModels[providerKey];
                    if (models && selectedModelId) {
                      const model = models.find((m) => m.id === selectedModelId);
                      return model?.is_thinking === true;
                    }
                    return false;
                  })()}
                  isConversationActive={messages.length > 0}
                  temperature={temperature}
                  setTemperature={setTemperature}
                  isTemperatureSupported={true}
                  onToggleSettings={() => setIsSettingsOpen(!isSettingsOpen)}
                  onGitCommit={handleGitCommit}
                  isGitRepo={gitStatus.isRepo}
                  providersList={providersList}
                  accounts={accounts}
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Settings Sidebar (Right) */}
      <SettingsSidebar
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        temperature={temperature ?? 0.7}
        setTemperature={setTemperature}
      />
    </div>
  );

  if (tabs) {
    return <div className="flex-1 flex flex-col min-w-0">{innerContent}</div>;
  }

  return <div className="h-full flex flex-col bg-background">{innerContent}</div>;
};

export default PlaygroundPage;
