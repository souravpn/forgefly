import type { ReactNode } from 'react';
import LandingPage from './pages/LandingPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import GeneratedPortalPage from './pages/GeneratedPortalPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import OnboardingPage from './pages/OnboardingPage';
import DashboardPage from './pages/DashboardPage';
import ClientsPage from './pages/ClientsPage';
import ProjectsPage from './pages/ProjectsPage';
import PackagesPage from './pages/PackagesPage';
import FinancesPage from './pages/FinancesPage';
import CalendarPage from './pages/CalendarPage';
import ProposalsPage from './pages/ProposalsPage';
import InvoicesPage from './pages/InvoicesPage';
import AutomationsPage from './pages/AutomationsPage';
import SettingsPage from './pages/SettingsPage';
import PipelinePage from './pages/PipelinePage';
import BrandKitPage from './pages/BrandKitPage';
import ClientPortalPage from './pages/ClientPortalPage';
import PaymentSuccessPage from './pages/PaymentSuccessPage';
import PaymentCancelPage from './pages/PaymentCancelPage';
import PublicPortfolioPage from './pages/PublicPortfolioPage';
import RequestsPage from './pages/RequestsPage';
import VisibilityPage from './pages/VisibilityPage';
import OutreachKitPage from './pages/OutreachKitPage';
import MessagesPage from './pages/MessagesPage';

export interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
  /** Accessible without login. Routes without this flag require authentication. Has no effect when RouteGuard is not in use. */
  public?: boolean;
}

export const routes: RouteConfig[] = [
  // ─── Public routes (no layout) ────────────────────────────────────────────
  {
    name: 'Landing',
    path: '/',
    element: <LandingPage />,
    public: true,
  },
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
    name: 'Auth Callback',
    path: '/auth/callback',
    element: <AuthCallbackPage />,
    public: true,
  },
  {
    name: 'Generated Portal Preview',
    path: '/preview',
    element: <GeneratedPortalPage />,
    public: true,
  },
  {
    name: 'Client Portal',
    path: '/portal/:token',
    element: <ClientPortalPage />,
    public: true,
  },
  {
    name: 'Public Portfolio',
    path: '/p/:slug',
    element: <PublicPortfolioPage />,
    public: true,
  },

  // ─── Protected routes (inside AppShell via MainLayout) ────────────────────
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
    name: 'Services',
    path: '/dashboard/services',
    element: <PackagesPage />,
  },
  {
    name: 'Pipeline',
    path: '/dashboard/pipeline',
    element: <PipelinePage />,
  },
  {
    name: 'Invoices',
    path: '/dashboard/invoices',
    element: <InvoicesPage />,
  },
  {
    name: 'Clients',
    path: '/dashboard/clients',
    element: <ClientsPage />,
  },
  {
    name: 'Client Detail',
    path: '/dashboard/clients/:clientId',
    element: <ClientsPage />,
  },
  {
    name: 'Proposals',
    path: '/dashboard/proposals',
    element: <ProposalsPage />,
  },
  {
    name: 'Brand Kit',
    path: '/dashboard/brand',
    element: <BrandKitPage />,
  },
  {
    name: 'Calendar',
    path: '/dashboard/calendar',
    element: <CalendarPage />,
  },
  {
    name: 'Automations',
    path: '/dashboard/automations',
    element: <AutomationsPage />,
  },
  {
    name: 'Settings',
    path: '/dashboard/settings',
    element: <SettingsPage />,
  },
  {
    name: 'Projects',
    path: '/dashboard/projects',
    element: <ProjectsPage />,
  },
  {
    name: 'Finances',
    path: '/dashboard/finances',
    element: <FinancesPage />,
  },
  {
    name: 'Requests',
    path: '/dashboard/requests',
    element: <RequestsPage />,
  },
  {
    name: 'Visibility',
    path: '/dashboard/visibility',
    element: <VisibilityPage />,
  },
  {
    name: 'Outreach Kit',
    path: '/dashboard/outreach',
    element: <OutreachKitPage />,
  },
  {
    name: 'Messages',
    path: '/dashboard/messages',
    element: <MessagesPage />,
  },
  {
    name: 'Payment Success',
    path: '/payment/success',
    element: <PaymentSuccessPage />,
  },
  {
    name: 'Payment Cancel',
    path: '/payment/cancel',
    element: <PaymentCancelPage />,
  },
];
