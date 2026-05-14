import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ReactElement, ReactNode } from 'react';

// Mock user for testing
export const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
};

// Mock AuthContext value
const mockAuthContextValue = {
  user: mockUser,
  loading: false,
};

// Wrapper component for tests
interface WrapperProps {
  children: ReactNode;
}

function TestWrapper({ children }: WrapperProps) {
  return <BrowserRouter>{children}</BrowserRouter>;
}

// Custom render function
export function renderWithRouter(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: TestWrapper, ...options });
}

// Re-export everything from testing library
export * from '@testing-library/react';
export { renderWithRouter as render };
