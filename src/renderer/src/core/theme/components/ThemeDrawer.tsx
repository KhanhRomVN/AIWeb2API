import React, { useMemo, memo } from 'react';
import { useTheme } from '../ThemeProvider';
import { Drawer } from '../../../shared/components/ui/drawer';
import { X, Moon, Sun, Palette } from 'lucide-react';
import { PRESET_THEMES } from '../theme-loader';
import { cn } from '../../../shared/lib/utils';

interface ThemeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const ThemeDrawer: React.FC<ThemeDrawerProps> = memo(({ isOpen, onClose }) => {
  const { theme, setTheme, applyPresetTheme } = useTheme();

  // Filter to just Light and Dark
  const themes = useMemo(
    () => [
      { value: 'light', label: 'Light', icon: Sun },
      { value: 'dark', label: 'Dark', icon: Moon },
    ],
    [],
  );

  // Cast theme to 'light' | 'dark' safely since we removed system
  const currentMode = theme === 'light' || theme === 'dark' ? theme : 'dark';

  // Helper to convert space-separated RGB (from JSON) to valid CSS rgb()
  const resolveColor = (color: string) => {
    if (!color) return 'transparent';
    // If it's already a standard hex or rgb, return as is
    if (color.startsWith('#') || color.startsWith('rgb')) return color;
    // If it's space-separated "R G B", convert to rgb(R G B)
    if (color.includes(' ')) return `rgb(${color})`;
    return color;
  };

  const renderPresetThemes = () => (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Palette className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">Preset Themes</h3>
      </div>
      <div className="grid grid-cols-2 gap-4 pb-10">
        {PRESET_THEMES[currentMode]?.map((preset, idx) => {
          return (
            <button
              key={idx}
              onClick={() => applyPresetTheme(preset)}
              className="relative flex flex-col p-3 rounded-xl transition-all overflow-hidden bg-card border border-border hover:border-primary/50 hover:scale-[1.02] active:scale-[0.98] duration-200 group text-left shadow-sm"
            >
              {/* Skeleton UI Preview */}
              <div
                className="w-full h-32 rounded-lg overflow-hidden mb-3 relative border border-border/50 shadow-inner"
                style={{ backgroundColor: resolveColor(preset.tailwind.background) }}
              >
                {/* Header skeleton */}
                <div
                  className="h-4 w-full border-b border-border/20"
                  style={{ backgroundColor: resolveColor(preset.tailwind.sidebarBackground) }}
                />

                <div className="flex h-full">
                  {/* Sidebar skeleton */}
                  <div
                    className="w-1/4 h-full border-r border-border/20 pt-2 px-1"
                    style={{
                      backgroundColor: resolveColor(preset.tailwind.sidebarBackground),
                    }}
                  >
                    <div
                      className="w-full h-1.5 rounded-full mb-1 opacity-20"
                      style={{ backgroundColor: resolveColor(preset.tailwind.textPrimary) }}
                    />
                    <div
                      className="w-2/3 h-1.5 rounded-full mb-1 opacity-20"
                      style={{ backgroundColor: resolveColor(preset.tailwind.textPrimary) }}
                    />
                    <div
                      className="w-3/4 h-1.5 rounded-full opacity-20"
                      style={{ backgroundColor: resolveColor(preset.tailwind.textPrimary) }}
                    />
                  </div>

                  {/* Content skeleton */}
                  <div className="flex-1 p-2 space-y-2">
                    <div className="flex gap-2">
                      <div
                        className="h-10 flex-1 rounded-md opacity-40 shadow-sm"
                        style={{ backgroundColor: resolveColor(preset.tailwind.cardBackground) }}
                      />
                      <div
                        className="h-10 w-8 rounded-md opacity-40 shadow-sm"
                        style={{ backgroundColor: resolveColor(preset.tailwind.cardBackground) }}
                      />
                    </div>
                    <div
                      className="w-full h-2 rounded-full opacity-30"
                      style={{ backgroundColor: resolveColor(preset.tailwind.textPrimary) }}
                    />
                    <div
                      className="w-5/6 h-2 rounded-full opacity-20"
                      style={{ backgroundColor: resolveColor(preset.tailwind.textPrimary) }}
                    />

                    {/* Primary Button skeleton */}
                    <div
                      className="w-1/3 h-3 rounded-md mt-2 shadow-sm"
                      style={{ backgroundColor: resolveColor(preset.tailwind.primary) }}
                    />
                  </div>
                </div>

                {/* Status Dot */}
                <div className="absolute top-1.5 right-1.5 bg-background/80 backdrop-blur-sm p-0.5 rounded-full shadow-sm border border-border/50">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: resolveColor(preset.tailwind.primary) }}
                  />
                </div>
              </div>

              <div className="flex justify-between items-center w-full px-1">
                <span className="font-bold text-sm block text-foreground tracking-tight">
                  {preset.name.replace(/Light$|Dark$/, '')}
                </span>
                <div
                  className="w-2 h-2 rounded-full ring-4 ring-background shadow-sm"
                  style={{ backgroundColor: resolveColor(preset.tailwind.primary) }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      width="600px"
      direction="right"
      className="!bg-drawer-background flex flex-col shadow-2xl"
    >
      <div className="h-16 flex items-center justify-between px-6 border-b border-border shrink-0 bg-background/50 backdrop-blur-md sticky top-0 z-10">
        <div>
          <h2 className="text-xl font-bold text-foreground">Theme Settings</h2>
        </div>

        <div className="flex items-center gap-3">
          {/* Theme Mode Toggle in Header */}
          <div className="flex items-center bg-muted/50 p-1 rounded-full border border-border mr-2">
            {themes.map(({ value, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value as any)}
                className={cn(
                  'p-1.5 rounded-full transition-all duration-200',
                  theme === value
                    ? 'bg-primary text-primary-foreground shadow-sm scale-110'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                )}
                title={`${value.charAt(0).toUpperCase() + value.slice(1)} Mode`}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>

          <button
            onClick={onClose}
            className="p-2 -mr-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-full transition-all duration-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar">
        {renderPresetThemes()}
      </div>
    </Drawer>
  );
});

export default ThemeDrawer;
