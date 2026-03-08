import { memo } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Boxes,
  FoldHorizontal,
  UnfoldHorizontal,
  Settings,
  Palette,
  Wifi,
  AlertCircle,
} from 'lucide-react';
import { cn } from '../../shared/lib/utils';
import AppIcon from '../../assets/icon.png';
import { useBackendConnection } from '../contexts/BackendConnectionContext';
import { useUI } from '../contexts/UIContext';

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (value: boolean) => void;
}

const Sidebar = memo(({ isCollapsed, setIsCollapsed }: SidebarProps) => {
  const { isConnected, currentUrl, serverUpdate } = useBackendConnection();
  const { setIsThemeDrawerOpen } = useUI();

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

      {/* Footer Container */}
      <div className="mt-auto flex flex-col shrink-0 overflow-hidden">
        {/* Version Update Section */}
        {serverUpdate?.available && (
          <div
            className={cn(
              'w-full transition-all duration-300',
              isCollapsed ? 'p-2' : 'py-0', // No padding in expanded mode as requested
            )}
            title={serverUpdate.message}
          >
            <div
              className={cn(
                'flex items-center gap-3 text-amber-500 bg-amber-500/10 transition-all',
                isCollapsed ? 'rounded-lg h-10 justify-center' : 'px-4 py-3',
              )}
            >
              <div className="flex items-center justify-center shrink-0 w-8 h-8 rounded-lg bg-amber-500/20">
                <AlertCircle className={cn('h-4 w-4 shrink-0', isCollapsed && 'h-5 w-5')} />
              </div>
              {!isCollapsed && (
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-80">
                    Update Available
                  </span>
                  <span className="text-xs font-bold truncate">v{serverUpdate.latest}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Separator Border */}
        <div className="border-t border-border/50" />

        {/* Status & Actions Section */}
        <div
          className={cn(
            'transition-all duration-300',
            isCollapsed ? 'flex flex-col items-center gap-3 p-2 pb-4' : 'p-4',
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

              <div
                className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center transition-all group relative mt-2',
                  isConnected ? 'text-emerald-500 bg-emerald-500/10' : 'text-red-500 bg-red-500/10',
                )}
              >
                <Wifi className="w-4 h-4" />
                <div className="absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2 px-2 py-1 bg-popover border border-border text-popover-foreground text-[10px] rounded shadow-md opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none z-50">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 transition-all">
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default Sidebar;
