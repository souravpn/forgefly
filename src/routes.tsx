import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import AutomationsPage from "./pages/AutomationsPage";
import BrandKitPage from "./pages/BrandKitPage";
import CalendarPage from "./pages/CalendarPage";
import ClientPortalPage from "./pages/ClientPortalPage";
import ClientsPage from "./pages/ClientsPage";
import ContactPage from "./pages/ContactPage";
import DashboardPage from "./pages/DashboardPage";
import DocumentationPage from "./pages/DocumentationPage";
import FinancesPage from "./pages/FinancesPage";
import GeneratedPortalPage from "./pages/GeneratedPortalPage";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import MarketResearchPage from "./pages/MarketResearchPage";
import MessagesPage from "./pages/MessagesPage";
import OutreachKitPage from "./pages/OutreachKitPage";
import PackagesPage from "./pages/PackagesPage";
import PaymentCancelPage from "./pages/PaymentCancelPage";
import PaymentSuccessPage from "./pages/PaymentSuccessPage";
import PipelinePage from "./pages/PipelinePage";
import PortfolioPage from "./pages/PortfolioPage";
import ProjectsPage from "./pages/ProjectsPage";
import ProposalsPage from "./pages/ProposalsPage";
import PublicPortfolioPage from "./pages/PublicPortfolioPage";
import RequestsPage from "./pages/RequestsPage";
import ReviewSubmitPage from "./pages/ReviewSubmitPage";
import ReviewsPage from "./pages/ReviewsPage";
import SettingsPage from "./pages/SettingsPage";
import SignupPage from "./pages/SignupPage";
import SocialPage from "./pages/SocialPage";
import VisibilityPage from "./pages/VisibilityPage";

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
    name: "Landing",
    path: "/",
    element: <LandingPage />,
    public: true,
  },
  {
    name: "Login",
    path: "/login",
    element: <LoginPage />,
    public: true,
  },
  {
    name: "Signup",
    path: "/signup",
    element: <SignupPage />,
    public: true,
  },
  {
    name: "Auth Callback",
    path: "/auth/callback",
    element: <AuthCallbackPage />,
    public: true,
  },
  {
    name: "Generated Portal Preview",
    path: "/preview",
    element: <GeneratedPortalPage />,
    public: true,
  },
  {
    name: "Client Portal",
    path: "/portal/:token",
    element: <ClientPortalPage />,
    public: true,
  },
  {
    name: "Public Portfolio",
    path: "/p/:slug",
    element: <PublicPortfolioPage />,
    public: true,
  },
  {
    name: "Review Submit",
    path: "/review/:token",
    element: <ReviewSubmitPage />,
    public: true,
  },
  {
    name: "Contact",
    path: "/contact",
    element: <ContactPage />,
    public: true,
  },
  {
    name: "Documentation",
    path: "/documentation",
    element: <DocumentationPage />,
    public: true,
  },

  // ─── Protected routes (inside AppShell via MainLayout) ────────────────────
  {
    name: "Dashboard",
    path: "/dashboard",
    element: <DashboardPage />,
  },
  {
    name: "Services",
    path: "/dashboard/services",
    element: <PackagesPage />,
  },
  {
    name: "Leads",
    path: "/dashboard/leads",
    element: <PipelinePage />,
  },
  {
    name: "Pipeline (legacy)",
    path: "/dashboard/pipeline",
    element: <Navigate to="/dashboard/leads" replace />,
  },
  {
    name: "Invoices",
    path: "/dashboard/invoices",
    element: <Navigate to="/dashboard/finances?tab=invoices" replace />,
  },
  {
    name: "Clients",
    path: "/dashboard/clients",
    element: <ClientsPage />,
  },
  {
    name: "Client Detail",
    path: "/dashboard/clients/:clientId",
    element: <ClientsPage />,
  },
  {
    name: "Proposals",
    path: "/dashboard/proposals",
    element: <ProposalsPage />,
  },
  {
    name: "Brand Kit",
    path: "/dashboard/brand",
    element: <BrandKitPage />,
  },
  {
    name: "Calendar",
    path: "/dashboard/calendar",
    element: <CalendarPage />,
  },
  {
    name: "Automations",
    path: "/dashboard/automations",
    element: <AutomationsPage />,
  },
  {
    name: "Settings",
    path: "/dashboard/settings",
    element: <SettingsPage />,
  },
  {
    name: "Projects",
    path: "/dashboard/projects",
    element: <ProjectsPage />,
  },
  {
    name: "Finances",
    path: "/dashboard/finances",
    element: <FinancesPage />,
  },
  {
    name: "Market Research",
    path: "/dashboard/market-research",
    element: <MarketResearchPage />,
  },
  {
    name: "Social",
    path: "/dashboard/social",
    element: <SocialPage />,
  },
  {
    name: "Requests",
    path: "/dashboard/requests",
    element: <RequestsPage />,
  },
  {
    name: "Visibility",
    path: "/dashboard/visibility",
    element: <VisibilityPage />,
  },
  {
    name: "Outreach Kit",
    path: "/dashboard/outreach",
    element: <OutreachKitPage />,
  },
  {
    name: "Reviews",
    path: "/dashboard/reviews",
    element: <ReviewsPage />,
  },
  {
    name: "Messages",
    path: "/dashboard/messages",
    element: <MessagesPage />,
  },
  {
    name: "Portfolio",
    path: "/dashboard/portfolio",
    element: <PortfolioPage />,
  },
  {
    name: "Payment Success",
    path: "/payment/success",
    element: <PaymentSuccessPage />,
  },
  {
    name: "Payment Cancel",
    path: "/payment/cancel",
    element: <PaymentCancelPage />,
  },
];
