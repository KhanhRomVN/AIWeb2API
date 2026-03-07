import { AlertTriangle, Download, RefreshCw } from 'lucide-react';

interface ServerVersionUpdateOverlayProps {
  installedVersion: string;
  latestVersion: string;
  onCheckAgain: () => void;
}

export const ServerVersionUpdateOverlay = ({
  installedVersion,
  latestVersion,
  onCheckAgain,
}: ServerVersionUpdateOverlayProps) => {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/30 backdrop-blur-xl animate-in fade-in duration-500">
      <div className="w-full max-w-lg p-8 rounded-2xl border border-border/50 bg-card/80 shadow-2xl space-y-6 text-center animate-in zoom-in-95 duration-300">
        <div className="mx-auto w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center mb-4">
          <AlertTriangle className="w-10 h-10 text-warning" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">Update Required</h2>
          <p className="text-muted-foreground leading-relaxed">
            A new version of <code>@khanhromvn/elara-server</code> is available. Please update to
            continue using the application safely.
          </p>
        </div>

        <div className="flex items-center justify-center gap-8 py-2">
          <div className="text-center">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">
              Installed
            </p>
            <p className="text-lg font-mono font-bold text-muted-foreground">{installedVersion}</p>
          </div>
          <div className="w-px h-8 bg-border/50" />
          <div className="text-center">
            <p className="text-xs uppercase tracking-wider text-primary font-semibold mb-1">
              Latest
            </p>
            <p className="text-lg font-mono font-bold text-primary">{latestVersion}</p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-black/40 border border-white/5 text-left space-y-4">
          <div className="flex items-center gap-2.5 text-sm font-semibold text-primary/80">
            <div className="p-1 rounded bg-primary/10">
              <Download className="w-3.5 h-3.5" />
            </div>
            <span>How to update:</span>
          </div>
          <p className="text-sm text-muted-foreground/90 leading-relaxed px-1">
            Run the following command in your terminal to update the server package:
          </p>
          <div className="bg-black/60 p-4 rounded-xl border border-white/10 font-mono text-[13px] select-all text-primary shadow-inner">
            <span className="text-muted-foreground/50 mr-2">$</span>
            npm install -g @khanhromvn/elara-server
          </div>
        </div>

        <button
          onClick={onCheckAgain}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all flex items-center justify-center gap-2 group shadow-lg shadow-primary/20"
        >
          <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
          <span>Check Again</span>
        </button>
      </div>
    </div>
  );
};
