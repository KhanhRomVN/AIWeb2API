import React, { memo } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  BookOpen,
  Boxes,
  FoldHorizontal,
  UnfoldHorizontal,
  Settings,
  Palette,
  Globe,
  Wifi,
  Power,
} from 'lucide-react';
import { cn } from '../../shared/lib/utils';
import AppIcon from '../../assets/icon.png';
import { useBackendConnection } from '../contexts/BackendConnectionContext';
import ThemeDrawer from '../theme/components/ThemeDrawer';

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (value: boolean) => void;
}

const Sidebar = memo(({ isCollapsed, setIsCollapsed }: SidebarProps) => {
  const {
    isConnected,
    currentUrl,
    isServerRunning,
    serverPort,
    stopServer,
    startServer,
    serverError,
    backendMode,
    setBackendMode,
  } = useBackendConnection();
  const [isThemeDrawerOpen, setIsThemeDrawerOpen] = React.useState(false);

  const navItems = [
    {
      title: 'Dashboard',
      href: '/',
      icon: LayoutDashboard,
      disabled: false,
      color: '#0ea5e9', // Sky Blue
    },
    {
      title: 'Accounts',
      href: '/accounts',
      icon: Users,
      color: '#10b981', // Emerald
    },
    {
      title: 'Models',
      href: '/models',
      icon: Boxes,
      color: '#f59e0b', // Amber
    },
    {
      title: 'Playground',
      href: '/playground',
      icon: MessageSquare,
      color: '#8b5cf6', // Violet
    },
    {
      title: 'Tutorial',
      href: '/tutorial',
      icon: BookOpen,
      disabled: false,
      color: '#f97316', // Orange
    },
    {
      title: 'Settings',
      href: '/settings',
      icon: Settings,
      disabled: false,
      color: '#94a3b8', // Slate
    },
    {
      title: 'Mapping',
      href: '/mapping',
      icon: Boxes, // Using Boxes or similar for mapping
      color: '#ec4899', // Pink
    },
  ];

  /* -------------------------------------------------------------------------------------------------
   * Render
   * -----------------------------------------------------------------------------------------------*/
  return (
    <div
      className={cn(
        'flex flex-col h-screen fixed left-0 top-0 bg-card/50 backdrop-blur-xl border-r border-border transition-[width] duration-300 ease-in-out z-50 will-change-[width]',
        isCollapsed ? 'w-[60px]' : 'w-72',
      )}
    >
      {/* Header */}
      <div
        className={cn(
          'h-12 flex items-center border-b border-border/50 transition-[padding] duration-300 overflow-hidden shrink-0',
          isCollapsed ? 'justify-center px-0' : 'px-4 justify-between',
        )}
      >
        <div
          className={cn(
            'flex items-center gap-2 overflow-hidden whitespace-nowrap',
            isCollapsed && 'hidden',
          )}
        >
          {/* Logo container tailored to match Zentri's look but using Elara's icon */}
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
            <img src={AppIcon} alt="Elara" className="w-full h-full object-cover" />
          </div>
          <span className="font-bold text-xl tracking-tight opacity-100 transition-opacity duration-300 text-foreground">
            Elara
          </span>
        </div>

        {isCollapsed && (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 animate-in fade-in zoom-in duration-300 overflow-hidden">
            <img src={AppIcon} alt="Elara" className="w-full h-full object-cover" />
          </div>
        )}

        {!isCollapsed && (
          <div className="flex items-center gap-1 opacity-100 transition-opacity duration-300">
            <button
              onClick={() => setIsThemeDrawerOpen(true)}
              className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded-md transition-colors"
              title="Theme Settings"
            >
              <Palette className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsCollapsed(true)}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
              title="Collapse Sidebar"
            >
              <FoldHorizontal className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav
        className={cn(
          'flex-1 py-4 space-y-1',
          isCollapsed ? 'overflow-visible px-2' : 'overflow-y-auto custom-scrollbar',
        )}
      >
        {navItems.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            onClick={(e) => item.disabled && e.preventDefault()}
            end={item.href === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 py-3 text-sm font-medium rounded-none transition-all relative group',
                isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                isCollapsed ? 'justify-center px-0 mx-0 w-full mb-1' : 'px-4 mb-1',
                item.disabled && 'opacity-50 cursor-not-allowed grayscale pointer-events-none',
              )
            }
            style={({ isActive }) => ({
              background: isActive
                ? `linear-gradient(to right, ${item.color}15, transparent)`
                : undefined,
            })}
          >
            {({ isActive }) => (
              <>
                {/* Active Indicator Bar */}
                {isActive && !isCollapsed && (
                  <div
                    className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-l-lg"
                    style={{ backgroundColor: item.color }}
                  />
                )}

                <item.icon
                  className={cn(
                    'w-5 h-5 flex-shrink-0 transition-colors',
                    isActive && isCollapsed && 'drop-shadow-md',
                  )}
                  style={{ color: isActive ? item.color : undefined }}
                />

                {!isCollapsed && (
                  <span className="whitespace-nowrap overflow-hidden text-ellipsis">
                    {item.title}
                  </span>
                )}

                {/* Tooltip for Collapsed State */}
                {isCollapsed && (
                  <div className="absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-popover border border-border text-popover-foreground text-xs font-medium rounded-md shadow-lg z-[100] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    {item.title} {item.disabled && '(Disabled)'}
                    <div className="absolute left-[-4px] top-1/2 -translate-y-1/2 w-2 h-2 bg-popover border-l border-b border-border rotate-45 transform" />
                  </div>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Settings/Collapse Footer (Only in Collapsed Mode OR Version info in Open Mode) */}
      <div
        className={cn(
          'mt-auto transition-all duration-300',
          isCollapsed ? 'flex flex-col items-center gap-2' : 'border-t border-border/50s',
        )}
      >
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-2 w-full">
            <button
              onClick={() => setIsThemeDrawerOpen(true)}
              className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
            >
              <Palette className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsCollapsed(false)}
              className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-all"
            >
              <UnfoldHorizontal className="w-5 h-5" />
            </button>

            <div className="flex flex-col items-center py-2 w-full">
              {backendMode === 'remote' ? (
                <div
                  className={cn(
                    'p-2 rounded-lg transition-all group relative',
                    isConnected ? 'text-emerald-500' : 'text-red-500',
                  )}
                >
                  <Wifi className="w-4 h-4" />
                  <div className="absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2 px-2 py-1 bg-popover border border-border text-popover-foreground text-[10px] rounded shadow-md opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none z-50">
                    {isConnected ? 'API Connected' : 'API Disconnected'}
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => (isServerRunning ? stopServer() : startServer())}
                  className={cn(
                    'p-2 rounded-lg transition-all group relative',
                    isServerRunning && isConnected
                      ? 'text-emerald-500'
                      : serverError
                        ? 'text-red-500'
                        : 'text-muted-foreground hover:bg-muted/10',
                  )}
                  title={isServerRunning ? 'Stop Server' : 'Start Server'}
                >
                  <Power className="w-4 h-4" />
                  <div className="absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2 px-2 py-1 bg-popover border border-border text-popover-foreground text-[10px] rounded shadow-md opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none z-50">
                    {isServerRunning ? 'Local Server Running' : 'Local Server Stopped'}
                  </div>
                </button>
              )}
            </div>

            {/* Compact Toggle Mode at bottom */}
            <div className="flex flex-col gap-0.5 mt-1 w-full px-2">
              <button
                onClick={() => setBackendMode('local')}
                className={cn(
                  'w-full h-9 flex items-center justify-center rounded-lg transition-all hover:bg-emerald-500/10 hover:text-emerald-500',
                  backendMode === 'local' ? 'text-emerald-500 font-black' : 'text-muted-foreground',
                )}
                title="Local Mode"
              >
                <Boxes className="w-4 h-4" />
              </button>
              <button
                onClick={() => setBackendMode('remote')}
                className={cn(
                  'w-full h-9 flex items-center justify-center rounded-lg transition-all hover:bg-blue-500/10 hover:text-blue-500',
                  backendMode === 'remote' ? 'text-blue-500 font-black' : 'text-muted-foreground',
                )}
                title="Remote Mode"
              >
                <Globe className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {/* Status Section for Expanded Mode */}
            <div className="flex flex-col gap-2">
              {backendMode === 'local' ? (
                <div className="flex items-center gap-3 p-2">
                  <button
                    onClick={() => (isServerRunning ? stopServer() : startServer())}
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center transition-all shrink-0',
                      isServerRunning && isConnected
                        ? 'bg-emerald-500/10 text-emerald-500'
                        : serverError
                          ? 'bg-red-500/10 text-red-500'
                          : 'text-muted-foreground hover:bg-muted/10',
                    )}
                    title={isServerRunning ? 'Stop Server' : 'Start Server'}
                  >
                    <Power className="w-4 h-4" />
                  </button>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                      LOCAL SERVER
                    </span>
                    <span className="text-xs font-medium text-foreground truncate">
                      Port: {serverPort}
                    </span>
                    {serverError && (
                      <span className="text-[10px] text-red-500 font-medium animate-pulse truncate">
                        {serverError}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-2 transition-all">
                  <div
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                      isConnected
                        ? 'bg-emerald-500/10 text-emerald-500'
                        : 'bg-red-500/10 text-red-500',
                    )}
                  >
                    <Wifi className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                      REMOTE API
                    </span>
                    <span
                      className={cn(
                        'text-xs font-medium truncate',
                        isConnected ? 'text-foreground' : 'text-red-500/80',
                      )}
                    >
                      {currentUrl}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Toggle Mode (Bottom) */}
            <div className="flex w-ful border-t">
              <button
                onClick={() => setBackendMode('local')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-2.5 text-[11px] transition-all tracking-tight hover:bg-emerald-500/10 hover:text-emerald-500',
                  backendMode === 'local'
                    ? 'text-emerald-500 font-black bg-emerald-500/10 shadow-sm'
                    : 'font-bold text-muted-foreground',
                )}
              >
                <Boxes className="w-3.5 h-3.5" />
                LOCAL
              </button>
              <button
                onClick={() => setBackendMode('remote')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-2.5 text-[11px] transition-all tracking-tight hover:bg-blue-500/10 hover:text-blue-500',
                  backendMode === 'remote'
                    ? 'text-blue-500 font-black bg-blue-500/10 shadow-sm'
                    : 'font-bold text-muted-foreground',
                )}
              >
                <Globe className="w-3.5 h-3.5" />
                REMOTE
              </button>
            </div>
          </div>
        )}
      </div>

      <ThemeDrawer isOpen={isThemeDrawerOpen} onClose={() => setIsThemeDrawerOpen(false)} />
    </div>
  );
});

export default Sidebar;
