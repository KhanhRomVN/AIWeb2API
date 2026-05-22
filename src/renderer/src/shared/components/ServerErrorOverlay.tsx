import { AlertCircle, Terminal, RefreshCw } from 'lucide-react';

interface ServerErrorOverlayProps {
  onRetry: () => void;
}

export const ServerErrorOverlay = ({ onRetry }: ServerErrorOverlayProps) => {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/30 backdrop-blur-xl animate-in fade-in duration-500">
      <div className="w-full max-w-lg p-8 rounded-2xl border border-border/50 bg-card/80 shadow-2xl space-y-6 text-center animate-in zoom-in-95 duration-300">
        <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
          <AlertCircle className="w-10 h-10 text-destructive" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">Elara Server Connection Failed</h2>
          <p className="text-muted-foreground leading-relaxed">
            The app could not start or connect to the required <code>elara-server</code> background
            service.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-black/40 border border-white/5 text-left space-y-4">
          <div className="flex items-center gap-2.5 text-sm font-semibold text-primary/80">
            <div className="p-1 rounded bg-primary/10">
              <Terminal className="w-3.5 h-3.5" />
            </div>
            <span>How to fix:</span>
          </div>
          <p className="text-sm text-muted-foreground/90 leading-relaxed px-1">
            Ensure the Elara server is running. Start it manually:
          </p>
          <div className="bg-black/60 p-4 rounded-xl border border-white/10 font-mono text-[13px] select-all text-primary shadow-inner">
            <span className="text-muted-foreground/50 mr-2">$</span>
            elara-server
          </div>
        </div>

        <button
          onClick={onRetry}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all flex items-center justify-center gap-2 group shadow-lg shadow-primary/20"
        >
          <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
          <span>Retry Server Startup</span>
        </button>
      </div>
    </div>
  );
};
