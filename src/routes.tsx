import type { ReactNode } from 'react';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import OnboardingPage from './pages/OnboardingPage';
import DashboardPage from './pages/DashboardPage';
import ClientsPage from './pages/ClientsPage';
import ProjectsPage from './pages/ProjectsPage';
import FinancesPage from './pages/FinancesPage';
import CalendarPage from './pages/CalendarPage';
import ProposalsPage from './pages/ProposalsPage';
import AutomationsPage from './pages/AutomationsPage';
import SettingsPage from './pages/SettingsPage';
import ClientPortalPage from './pages/ClientPortalPage';

export interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
  /** Accessible without login. Routes without this flag require authentication. Has no effect when RouteGuard is not in use. */
  public?: boolean;
}

export const routes: RouteConfig[] = [
  {
    name: 'Login',
    path: '/login',
    element: <LoginPage />,
    public: true,
  },
  {
    name: 'Signup',
    path: '/signup',
    element: <SignupPage />,
    public: true,
  },
  {
    name: 'Onboarding',
    path: '/onboarding',
    element: <OnboardingPage />,
  },
  {
    name: 'Dashboard',
    path: '/dashboard',
    element: <DashboardPage />,
  },
  {
    name: 'Clients',
    path: '/clients',
    element: <ClientsPage />,
  },
  {
    name: 'Client Detail',
    path: '/clients/:clientId',
    element: <ClientsPage />,
  },
  {
    name: 'Projects',
    path: '/projects',
    element: <ProjectsPage />,
  },
  {
    name: 'Finances',
    path: '/finances',
    element: <FinancesPage />,
  },
  {
    name: 'Calendar',
    path: '/calendar',
    element: <CalendarPage />,
  },
  {
    name: 'Proposals',
    path: '/proposals',
    element: <ProposalsPage />,
  },
  {
    name: 'Automations',
    path: '/automations',
    element: <AutomationsPage />,
  },
  {
    name: 'Settings',
    path: '/settings',
    element: <SettingsPage />,
  },
  {
    name: 'Client Portal',
    path: '/portal',
    element: <ClientPortalPage />,
    public: true,
  },
];
