import { X, Thermometer, Settings2 } from 'lucide-react';
import { cn } from '../../../shared/lib/utils';

interface SettingsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  temperature: number;
  setTemperature: (val: number) => void;
}

export const SettingsSidebar = ({
  isOpen,
  onClose,
  temperature,
  setTemperature,
}: SettingsSidebarProps) => {
  if (!isOpen) return null;

  return (
    <div className="flex flex-col h-full border-l bg-card shadow-2xl shrink-0 w-[320px] animate-in slide-in-from-right duration-300 z-50">
      <div className="flex flex-col h-full gap-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-14 border-b bg-muted/20">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-primary" />
            <span className="font-bold text-sm tracking-tight uppercase">Settings</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-muted rounded-full transition-colors group"
          >
            <X className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold flex items-center gap-2">
                    <Thermometer className="w-4 h-4 text-muted-foreground" />
                    Temperature
                  </label>
                  <span className="text-[10px] font-mono bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                    {temperature.toFixed(1)}
                  </span>
                </div>

                <div className="space-y-3">
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.1}
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between text-[9px] text-muted-foreground font-bold uppercase tracking-widest">
                    <span>Precise</span>
                    <span>Creative</span>
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground leading-relaxed italic">
                  Higher values make output more random, lower values more deterministic.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto border-t p-4 bg-muted/10">
          <div className="flex items-center justify-center gap-2">
            <span className="w-1 h-1 rounded-full bg-primary animate-pulse" />
            <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-black">
              Elara v1.0
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
