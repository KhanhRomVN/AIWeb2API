import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Terminal, AlertTriangle, RefreshCw, Copy, Check } from 'lucide-react';
import { cn } from '../../shared/lib/utils';
import { toast } from 'sonner';

export const GlobalPackageCheck = () => {
  const [isInstalled, setIsInstalled] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

// Version check removed: no longer required
  return null;
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    toast.success('Command copied to clipboard');
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  if (isInstalled === true || (isInstalled === null && checking)) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/30 backdrop-blur-2xl animate-in fade-in duration-700">
      <div className="max-w-lg w-full mx-4 bg-card border border-border/50 shadow-2xl rounded-2xl overflow-hidden animate-in zoom-in-95 duration-500">
        <div className="p-8 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-6">
            <AlertTriangle className="w-8 h-8 text-amber-500" />
          </div>

          <h2 className="text-2xl font-bold mb-2">Setup Required</h2>
          <p className="text-muted-foreground mb-8 text-sm px-4">
            Follow these steps to get <span className="text-foreground font-semibold">Elara</span>{' '}
            up and running on your system.
          </p>

          <div className="w-full space-y-4 mb-8">
            {/* Step 1: Install */}
            <div className="bg-black/40 rounded-xl p-5 text-left border border-white/5 relative group">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 mb-3">
                <span className="flex items-center justify-center w-4 h-4 rounded-full bg-primary/20 text-primary mr-1">
                  1
                </span>
                Install Package
              </div>
              <code className="block font-mono text-sm text-emerald-500/90 whitespace-nowrap bg-transparent border-none p-0 pr-10 leading-relaxed overflow-hidden text-ellipsis">
                npm install -g @khanhromvn/elara-server
              </code>
              <button
                onClick={() =>
                  copyToClipboard('npm install -g @khanhromvn/elara-server', 'install')
                }
                className="absolute right-4 top-[42px] p-2 rounded-lg hover:bg-white/5 text-muted-foreground/60 hover:text-foreground transition-all active:scale-95"
                title="Copy to clipboard"
              >
                {copiedCmd === 'install' ? (
                  <Check className="w-4 h-4 text-emerald-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Step 2: Run */}
            <div className="bg-black/40 rounded-xl p-5 text-left border border-white/5 relative group">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 mb-1">
                <span className="flex items-center justify-center w-4 h-4 rounded-full bg-primary/20 text-primary mr-1">
                  2
                </span>
                Run Server (Separate Terminal)
              </div>
              <p className="text-[10px] text-muted-foreground/60 mb-3 ml-7">
                Use <code className="text-amber-500/80">-p &lt;port&gt;</code> for custom ports.
              </p>
              <code className="block font-mono text-sm text-emerald-500/90 whitespace-nowrap bg-transparent border-none p-0 pr-10 leading-relaxed overflow-hidden text-ellipsis">
                elara-server
              </code>
              <button
                onClick={() => copyToClipboard('elara-server', 'run')}
                className="absolute right-4 top-[54px] p-2 rounded-lg hover:bg-white/5 text-muted-foreground/60 hover:text-foreground transition-all active:scale-95"
                title="Copy to clipboard"
              >
                {copiedCmd === 'run' ? (
                  <Check className="w-4 h-4 text-emerald-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <button
            onClick={checkInstall}
            disabled={checking}
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {checking ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <RefreshCw className="w-5 h-5" />
                Check Again
              </>
            )}
          </button>

          <p className="mt-4 text-[10px] text-muted-foreground uppercase tracking-widest opacity-50">
            Restarting the app may also resolve this if just installed.
          </p>
        </div>
      </div>
    </div>
  );
};
