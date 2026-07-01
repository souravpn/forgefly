import React from 'react';
import { BrowserRouter as Router, MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import PublicPortfolioPage from './pages/PublicPortfolioPage';
import IntersectObserver from '@/components/common/IntersectObserver';
import { Toaster } from '@/components/ui/sonner';
import { MainLayout } from '@/components/layouts/MainLayout';
import { PWAInstallPrompt } from '@/components/common/PWAInstallPrompt';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

import { routes } from './routes';

import { AuthProvider } from '@/contexts/AuthContext';
import { RouteGuard } from '@/components/common/RouteGuard';
import { ThemeProvider } from '@/contexts/ThemeContext';

const App: React.FC = () => {
  const portfolioMatch = window.location.hostname.match(/^([a-z0-9-]+)\.p\.forgefly\.io$/)
  if (portfolioMatch) {
    const slug = portfolioMatch[1]
    return (
      <ErrorBoundary>
        <ThemeProvider>
          <MemoryRouter initialEntries={[`/p/${slug}`]}>
            <Routes>
              <Route path="/p/:slug" element={<PublicPortfolioPage />} />
            </Routes>
            <Toaster />
          </MemoryRouter>
        </ThemeProvider>
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary>
      <ThemeProvider>
      <Router>
        <AuthProvider>
          <RouteGuard>
            <IntersectObserver />
            <Routes>
              {/* Public routes without layout */}
              {routes
                .filter(route => route.public)
                .map((route, index) => (
                  <Route
                    key={index}
                    path={route.path}
                    element={route.element}
                  />
                ))}

              {/* Protected routes with layout */}
              <Route element={<MainLayout />}>
                {routes
                  .filter(route => !route.public)
                  .map((route, index) => (
                    <Route
                      key={index}
                      path={route.path}
                      element={route.element}
                    />
                  ))}
              </Route>

              {/* Redirect undefined routes to landing page */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <Toaster />
            <PWAInstallPrompt />
          </RouteGuard>
        </AuthProvider>
      </Router>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
