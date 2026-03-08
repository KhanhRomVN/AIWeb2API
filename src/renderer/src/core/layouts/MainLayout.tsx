import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { cn } from '../../shared/lib/utils';
import { useUI } from '../contexts/UIContext';
import ThemeDrawer from '../theme/components/ThemeDrawer';

const MainLayout = () => {
  const {
    isMainSidebarCollapsed,
    setIsMainSidebarCollapsed,
    isThemeDrawerOpen,
    setIsThemeDrawerOpen,
  } = useUI();

  return (
    <div className="flex min-h-screen bg-sidebar-background">
      <Sidebar isCollapsed={isMainSidebarCollapsed} setIsCollapsed={setIsMainSidebarCollapsed} />
      <div
        className={cn(
          'flex-1 flex flex-col h-screen overflow-hidden transition-all duration-300',
          isMainSidebarCollapsed ? 'pl-[60px]' : 'pl-72',
        )}
      >
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <Outlet />
        </div>
      </div>

      <ThemeDrawer isOpen={isThemeDrawerOpen} onClose={() => setIsThemeDrawerOpen(false)} />
    </div>
  );
};

export default MainLayout;
