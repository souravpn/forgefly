# Contributing to Forgefly

Thank you for your interest in contributing to Forgefly! This document provides guidelines and instructions for contributing to this project.

## Development Setup

### Prerequisites
- Node.js 20.x or higher
- pnpm 8.x or higher
- Git

### Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/forgefly.git
   cd forgefly
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your Supabase credentials
   ```

4. **Run tests**
   ```bash
   pnpm test
   ```

5. **Check code quality**
   ```bash
   pnpm lint
   pnpm type-check
   pnpm format:check
   ```

## Development Workflow

### Branch Strategy
- `main` - Production-ready code
- `develop` - Development branch
- `feature/*` - New features
- `fix/*` - Bug fixes
- `docs/*` - Documentation updates

### Making Changes

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write clean, maintainable code
   - Follow the existing code style
   - Add tests for new functionality
   - Update documentation as needed

3. **Test your changes**
   ```bash
   pnpm test
   pnpm lint
   pnpm type-check
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

   Follow [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` - New feature
   - `fix:` - Bug fix
   - `docs:` - Documentation changes
   - `style:` - Code style changes (formatting, etc.)
   - `refactor:` - Code refactoring
   - `test:` - Adding or updating tests
   - `chore:` - Maintenance tasks

5. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request**
   - Provide a clear description of the changes
   - Reference any related issues
   - Ensure all CI checks pass

## Code Style

### TypeScript
- Use TypeScript for all new code
- Define proper types and interfaces
- Avoid `any` type when possible
- Use strict mode

### React
- Use functional components with hooks
- Follow React best practices
- Keep components small and focused
- Use proper prop types

### Styling
- Use Tailwind CSS utility classes
- Follow the design system in `src/index.css`
- Use semantic color tokens (e.g., `bg-primary`, not `bg-blue-500`)
- Ensure responsive design (mobile-first)

### File Organization
```
src/
├── components/
│   ├── common/      # Shared components
│   ├── layouts/     # Layout components
│   └── ui/          # shadcn/ui components
├── contexts/        # React contexts
├── db/              # Database client
├── pages/           # Page components
├── test/            # Test files
└── types/           # TypeScript types
```

## Testing Guidelines

### Writing Tests
- Write tests for all new features
- Include happy path and edge cases
- Mock external dependencies
- Keep tests focused and isolated

### Test Coverage
- Aim for 70%+ code coverage
- Critical paths should have 90%+ coverage
- Run coverage report: `pnpm test:ci`

### Running Tests
```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch

# With UI
pnpm test:ui

# With coverage
pnpm test:ci
```

## Pull Request Process

1. **Before Submitting**
   - [ ] All tests pass
   - [ ] Code is linted and formatted
   - [ ] TypeScript compiles without errors
   - [ ] Documentation is updated
   - [ ] Commit messages follow conventions

2. **PR Description**
   - Describe what changes were made
   - Explain why the changes were necessary
   - Include screenshots for UI changes
   - Reference related issues

3. **Review Process**
   - Address reviewer feedback
   - Keep the PR focused and small
   - Respond to comments promptly

4. **After Approval**
   - Squash commits if requested
   - Ensure CI passes
   - Merge when ready

## Code Review Guidelines

### For Reviewers
- Be constructive and respectful
- Focus on code quality and maintainability
- Check for test coverage
- Verify documentation updates
- Test the changes locally if needed

### For Authors
- Respond to all comments
- Ask questions if feedback is unclear
- Make requested changes promptly
- Thank reviewers for their time

## Reporting Issues

### Bug Reports
Include:
- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Screenshots or error messages
- Environment details (OS, browser, etc.)

### Feature Requests
Include:
- Clear description of the feature
- Use case and benefits
- Proposed implementation (optional)
- Mockups or examples (optional)

## Community Guidelines

- Be respectful and inclusive
- Help others learn and grow
- Give credit where it's due
- Follow the code of conduct

## Questions?

- Open an issue for bugs or feature requests
- Start a discussion for questions
- Check existing issues before creating new ones

## License

By contributing to Forgefly, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for contributing to Forgefly!** 🚀
