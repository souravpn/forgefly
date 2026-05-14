# Welcome to Your Miaoda Project
Miaoda Application Link URL
    URL:https://medo.dev/projects/app-bj1thg4coydd

# Forgefly - AI Business OS for Solopreneurs

[![CI/CD Pipeline](https://github.com/yourusername/forgefly/actions/workflows/ci.yml/badge.svg)](https://github.com/yourusername/forgefly/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Built for the Build with MeDo Hackathon** - An intelligent business operating system that helps freelancers and solopreneurs manage clients, projects, proposals, invoices, and payments—all in one beautiful, AI-powered platform.

## 🚀 Features

### Core Functionality
- **Client Management** - Track clients with status, contact info, and relationship history
- **Project Kanban Board** - Visual project management with drag-and-drop columns (To Do, In Progress, Done)
- **AI Proposal Generation** - Generate professional proposals with AI assistance
- **Invoice Management** - Create, track, and manage invoices with Stripe integration
- **Payment Processing** - Secure Stripe checkout with automatic payment verification
- **Financial Dashboard** - Real-time revenue tracking, cashflow forecasting, and analytics
- **AI Co-pilot** - Context-aware AI assistant for business tasks

### Technical Highlights
- **Modern Tech Stack** - React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend** - Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **Payment Integration** - Stripe Checkout with secure server-side verification
- **Real-time Updates** - Supabase Realtime for live data synchronization
- **Responsive Design** - Mobile-first, desktop-optimized UI with dark mode
- **PWA Support** - Installable progressive web app
- **Comprehensive Testing** - Unit and integration tests with Vitest
- **CI/CD Pipeline** - Automated testing, linting, and deployment

## 🛠️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for blazing-fast builds
- **Tailwind CSS** for utility-first styling
- **shadcn/ui** for premium UI components
- **React Router** for navigation
- **React Hook Form** + Zod for form validation
- **Recharts** for data visualization
- **DnD Kit** for drag-and-drop functionality

### Backend
- **Supabase** - PostgreSQL database, authentication, storage
- **Edge Functions** - Serverless functions for Stripe integration
- **Row Level Security** - Database-level access control

### Testing & Quality
- **Vitest** - Fast unit testing framework
- **React Testing Library** - Component testing
- **ESLint** + **Prettier** - Code quality and formatting
- **TypeScript** - Type safety

### DevOps
- **GitHub Actions** - CI/CD pipeline
- **Vercel** - Preview deployments (optional)

## 📦 Installation

### Prerequisites
- Node.js 20.x or higher
- pnpm 8.x or higher
- Supabase account
- Stripe account (for payment features)

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/forgefly.git
   cd forgefly
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Configure environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Set up Supabase**
   - Run the database migrations in `supabase/migrations/`
   - Deploy Edge Functions: `create-invoice-checkout` and `verify-stripe-payment`
   - Configure Stripe secret key in Supabase Edge Function secrets

5. **Configure Stripe**
   - Add `STRIPE_SECRET_KEY` to Supabase Edge Function secrets
   - Get your key from [Stripe Dashboard](https://dashboard.stripe.com/apikeys)

## 🧪 Testing

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

### Test Coverage
The test suite includes:
- ✅ Client CRUD operations
- ✅ Project Kanban board functionality
- ✅ Proposal generation flow
- ✅ Stripe checkout integration
- ✅ Payment verification
- ✅ Landing page and onboarding
- ✅ Error handling and edge cases

## 🔍 Code Quality

### Linting
```bash
pnpm lint
```

### Type checking
```bash
pnpm type-check
```

### Format code
```bash
pnpm format
```

### Check formatting
```bash
pnpm format:check
```

## 🚀 Deployment

### Build for production
```bash
pnpm build
```

### CI/CD Pipeline
The project includes a GitHub Actions workflow that:
1. Runs ESLint and Prettier checks
2. Performs TypeScript type checking
3. Executes all tests with coverage
4. Builds the application
5. Deploys preview to Vercel (on PRs)

## 📁 Project Structure

```
forgefly/
├── src/
│   ├── components/       # Reusable UI components
│   │   ├── common/       # Shared components (ErrorBoundary, Footer, etc.)
│   │   ├── layouts/      # Layout components (Sidebar, MainLayout, AICopilot)
│   │   └── ui/           # shadcn/ui components
│   ├── contexts/         # React contexts (AuthContext)
│   ├── db/               # Database client (Supabase)
│   ├── pages/            # Page components
│   ├── test/             # Test files
│   ├── types/            # TypeScript type definitions
│   ├── App.tsx           # Main app component
│   └── routes.tsx        # Route definitions
├── supabase/
│   ├── functions/        # Edge Functions
│   └── migrations/       # Database migrations
├── .github/
│   └── workflows/        # CI/CD pipelines
├── vitest.config.ts      # Vitest configuration
├── .prettierrc           # Prettier configuration
└── package.json          # Dependencies and scripts
```

## 🎨 Design System

Forgefly uses a premium dark theme with:
- **Primary Colors**: Navy blue background with emerald and gold accents
- **Typography**: Clean, minimal hierarchy with proper spacing
- **Components**: Glassmorphic cards with subtle shadows
- **Animations**: Smooth transitions and micro-interactions
- **Accessibility**: WCAG AA compliant, keyboard navigation support

## 🔐 Security

- **Row Level Security (RLS)** - Database-level access control
- **Server-side validation** - All payment logic in Edge Functions
- **Environment secrets** - Sensitive keys stored securely
- **HTTPS only** - Secure communication
- **Input sanitization** - XSS protection

## 📝 License

MIT License - see [LICENSE](LICENSE) for details

## 🙏 Acknowledgments

- Built with [MeDo](https://medo.ai) - AI-powered development platform
- UI components from [shadcn/ui](https://ui.shadcn.com)
- Backend powered by [Supabase](https://supabase.com)
- Payments by [Stripe](https://stripe.com)

## 🏆 Hackathon Submission

This project was built for the **Build with MeDo Hackathon** to demonstrate:
- Production-grade code quality
- Comprehensive testing coverage
- Modern CI/CD practices
- Clean, maintainable architecture
- Real-world business value

---

**Made with ❤️ by Sourav Nayak • Powered by MeDo**
