# Testing Documentation

## Overview

Forgefly includes a comprehensive test suite using Vitest and React Testing Library to ensure code quality and reliability.

## Test Structure

```
src/test/
├── setup.ts              # Test configuration and global mocks
├── test-utils.tsx        # Custom render utilities
├── components.test.tsx   # UI component tests
└── stripe.test.ts        # Stripe integration tests
```

## Running Tests

### Run all tests
```bash
pnpm test
```

### Run tests in watch mode
```bash
pnpm test:watch
```

### Run tests with UI
```bash
pnpm test:ui
```

### Run tests with coverage
```bash
pnpm test:ci
```

## Test Coverage

### Current Test Suite (10 tests)

#### UI Components (4 tests)
- ✅ Button component rendering
- ✅ Card component rendering
- ✅ Button variant prop handling
- ✅ Button size prop handling

#### Stripe Integration (6 tests)
- ✅ Create checkout session with valid invoice data
- ✅ Handle checkout session creation failure
- ✅ Verify payment with valid session ID
- ✅ Handle payment verification failure
- ✅ Update invoice status after successful payment
- ✅ Handle missing STRIPE_SECRET_KEY gracefully

## Mocking Strategy

### Supabase Client
The test setup includes comprehensive mocks for:
- Database queries (`from`, `select`, `insert`, `update`, `delete`)
- Authentication (`auth.getUser`, `auth.signIn`, `auth.signOut`)
- Storage (`storage.from`, `upload`, `getPublicUrl`)
- Edge Functions (`functions.invoke`)

### React Router
- `useNavigate` - Mocked navigation function
- `useLocation` - Returns mock location object

### Toast Notifications
- `sonner` toast methods are mocked for testing

### Window APIs
- `matchMedia` - Mocked for responsive design tests

## Writing New Tests

### Component Test Example
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MyComponent } from '@/components/MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    const { container } = render(<MyComponent onClick={vi.fn()} />);
    expect(container.firstChild).toBeTruthy();
  });
});
```

### Integration Test Example
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFunction = vi.fn();

describe('Feature Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles success case', async () => {
    mockFunction.mockResolvedValue({ data: 'success', error: null });
    const result = await mockFunction();
    expect(result.data).toBe('success');
  });
});
```

## Best Practices

1. **Isolation**: Each test should be independent and not rely on other tests
2. **Clear Mocks**: Always clear mocks in `beforeEach` to prevent test pollution
3. **Meaningful Assertions**: Test behavior, not implementation details
4. **Edge Cases**: Include tests for error states and edge cases
5. **Async Handling**: Use `async/await` for asynchronous operations

## CI/CD Integration

Tests are automatically run in the CI/CD pipeline:
1. On every push to `main` or `develop` branches
2. On every pull request
3. Before deployment

The pipeline fails if:
- Any test fails
- Code coverage drops below threshold
- Type checking fails
- Linting errors are present

## Coverage Goals

- **Target**: 70%+ code coverage
- **Critical Paths**: 90%+ coverage for payment and auth flows
- **UI Components**: 60%+ coverage

## Troubleshooting

### Tests Failing Locally
1. Clear node_modules and reinstall: `rm -rf node_modules && pnpm install`
2. Clear Vitest cache: `pnpm test --clearCache`
3. Check for environment variable issues

### Mock Issues
- Ensure mocks are defined before imports
- Use `vi.clearAllMocks()` in `beforeEach`
- Check mock return values match expected types

### Async Test Issues
- Always use `async/await` for async operations
- Use `waitFor` from Testing Library for async UI updates
- Check for unhandled promise rejections

## Future Enhancements

- [ ] Add E2E tests with Playwright
- [ ] Increase coverage to 80%+
- [ ] Add visual regression tests
- [ ] Add performance benchmarks
- [ ] Add accessibility tests with axe-core
