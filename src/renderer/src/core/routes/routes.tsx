import { RouteObject } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import AccountsPage from '../../features/accounts';
import { ModelsPage } from '../../features/models';
import { PlaygroundWithTabs } from '../../features/playground/components/PlaygroundWithTabs';
import SettingsPage from '../../features/settings';

import Dashboard from '../../features/dashboard';
import MappingPage from '../../features/mapping';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <MainLayout />,
    children: [
      {
        path: '',
        element: <Dashboard />,
      },
      {
        path: 'accounts',
        element: <AccountsPage />,
      },
      {
        path: 'models',
        element: <ModelsPage />,
      },
      {
        path: 'playground',
        element: <PlaygroundWithTabs />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
      {
        path: 'mapping',
        element: <MappingPage />,
      },
      {
        path: 'analytics',
        element: (
          <div className="p-6">
            <h1 className="text-2xl font-bold">Analytics</h1>
          </div>
        ),
      },
    ],
  },
];
