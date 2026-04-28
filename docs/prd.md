# Requirements Document

## 1. Application Overview

### 1.1 Application Name
Forgefly

### 1.2 Application Description
Forgefly is an AI-first business operating system designed for solopreneurs and freelancers. The platform enables users to describe their business in natural language and instantly generates a complete back office infrastructure including service packages, proposals, contracts, invoicing, CRM, and cashflow management. The tagline is Forge Your Freedom.

### 1.3 Design Specifications
- Primary color: Deep navy #0A1428
- Accent color: Emerald green #10B981
- Highlight color: Warm gold #F59E0B
- Dark mode as default theme
- Modern premium SaaS aesthetic with subtle glows, smooth micro-animations, rounded corners, and generous whitespace
- Fully responsive design supporting desktop and mobile PWA

## 2. Users and Usage Scenarios

### 2.1 Target Users
Freelancers and solopreneurs across various industries including graphic designers, consultants, developers, writers, and other independent service providers.

### 2.2 Core Usage Scenarios
- Initial business setup through conversational AI onboarding
- Daily business operations management including project tracking and client communication
- Financial planning and cashflow forecasting
- Client relationship management and proposal generation
- Invoice creation and payment tracking

## 3. Page Structure and Functionality

```
Forgefly Application
├── Authentication
│   ├── Login Page
│   └── Signup Page
├── Conversational Onboarding Page
├── Main Dashboard
├── Clients Page
│   ├── Client List View
│   └── Client Detail View
├── Projects Page
├── Finances Page
├── Calendar Page
├── Proposals Page
│   ├── Proposal List
│   └── Proposal Builder
├── Automations Page
├── Settings Page
└── Client Portal View
```

### 3.1 Authentication Pages

**Login Page**
- Email and password input fields
- Demo login option for quick access
- Link to signup page
- Smooth transition animations

**Signup Page**
- Email registration form
- Password creation with validation
- Terms acceptance checkbox
- Link back to login page

### 3.2 Conversational Onboarding Page

**Primary Interface**
- Large centered input box with placeholder text: Describe your freelance business...
- Example prompt displayed: I'm a graphic designer charging $120/hr with 3 packages...
- Real-time AI parsing as user types

**Preview Panel (Right Side)**
- Dynamic preview cards showing:
  - Generated service packages
  - Branding suggestions
  - Proposal template preview
  - Contract template preview
- Cards appear with smooth animations as AI processes input

**Action Button**
- Prominent Launch My Business OS button
- Creates complete business profile and navigates to main dashboard
- Success animation on completion

### 3.3 Main Dashboard

**Layout Components**
- Left sidebar navigation (persistent across all pages)
- Main content area with multiple widgets
- Floating AI Co-pilot button (bottom right)

**Dashboard Widgets**

*Predictive Cashflow Chart*
- Visual chart displaying projected income and expenses
- Interactive What-if sliders for scenario planning
- Time range selector (monthly, quarterly, yearly)

*Active Projects Kanban Board*
- Compact view of current projects
- Status indicators for each project
- Quick access to project details

*Today's Tasks and Bookings*
- List of scheduled activities
- Calendar integration display
- Quick action buttons

*Key Statistics Cards*
- Total revenue
- Active clients count
- Pending invoices
- Project completion rate

### 3.4 Navigation Sidebar

**Menu Items**
- Home (Dashboard)
- Clients
- Projects
- Finances
- Calendar
- Proposals
- Automations
- Settings

**Visual Design**
- Icons for each menu item
- Active state highlighting
- Smooth hover effects
- Collapsible on mobile

### 3.5 AI Co-pilot

**Interface**
- Floating button with AI icon
- Expandable chat sidebar panel
- Context-aware conversation interface

**Capabilities**
- Generate proposals based on client information
- Draft client emails
- Create invoices
- Suggest workflow automations
- Answer business-related questions
- Provide insights from business data

**Interaction**
- Natural language input
- Streaming response display
- Action buttons for generated content (e.g., Save Proposal, Send Email)
- Conversation history

### 3.6 Clients Page

**Client List View**
- Grid layout of client cards
- Each card displays:
  - Client name and company
  - Contact information
  - Total project value
  - Last interaction date
  - Status indicator
- Search and filter functionality
- Add New Client button

**Client Detail View**
- Complete client profile information
- Project history with this client
- Communication timeline
- Financial summary (invoices, payments)
- Notes section
- Edit and delete options

### 3.7 Projects Page

**Kanban Board Layout**
- Draggable project cards across stages
- Default stages: Lead, In Progress, Review, Completed
- Each card shows:
  - Project name
  - Client name
  - Deadline
  - Value
  - Progress indicator
- Add New Project button
- Stage customization option

**Drag and Drop Functionality**
- Smooth card movement between stages
- Visual feedback during drag
- Auto-save on drop

### 3.8 Finances Page

**Cashflow Dashboard**
- Comprehensive financial overview chart
- Income vs expenses visualization
- Profit margin display

**Cashflow Simulator**
- Interactive sliders for:
  - Projected new clients
  - Average project value
  - Monthly expenses
  - Payment terms
- Real-time chart updates based on inputs
- Scenario comparison view

**Financial Summary Cards**
- Outstanding invoices
- Received payments this month
- Upcoming expenses
- Net profit

**Invoice Management Section**
- List of all invoices
- Status filters (Paid, Pending, Overdue)
- Quick invoice creation

### 3.9 Calendar Page

**Calendar View**
- Monthly calendar grid
- Event markers for:
  - Client meetings
  - Project deadlines
  - Payment due dates
  - Tasks
- Day, week, month view options

**Event Management**
- Click to add new events
- Event detail popup
- Integration with projects and clients

### 3.10 Proposals Page

**Proposal List**
- Table or card view of all proposals
- Status indicators (Draft, Sent, Accepted, Rejected)
- Client name and project association
- Creation and sent dates
- Value amount
- Quick actions (View, Edit, Duplicate, Send)

**Proposal Builder**
- Left panel: Editable content sections
  - Cover page with branding
  - Service description
  - Pricing breakdown
  - Timeline and deliverables
  - Terms and conditions
- Right panel: Live PDF-style preview
- AI assistance button for content generation
- Save as draft and Send to client buttons
- Template selection option

### 3.11 Automations Page

**Automation List**
- Display of configured automations
- Each automation shows:
  - Trigger condition
  - Action to be performed
  - Status (Active/Inactive)
- Toggle switches for enable/disable

**Create Automation**
- Trigger selection (e.g., New client added, Invoice overdue, Project completed)
- Action configuration (e.g., Send email, Create task, Update status)
- AI suggestions for useful automations

### 3.12 Settings Page

**Business Profile**
- Business name and description
- Service packages configuration
- Hourly rates and pricing
- Branding elements (logo, colors)

**User Account**
- Personal information
- Email and password management
- Notification preferences

**Integrations**
- Calendar sync options
- Payment gateway connections
- Email service integration

### 3.13 Client Portal View

**Portal Interface**
- Branded header with user's business identity
- Client-specific dashboard showing:
  - Active projects
  - Proposals awaiting review
  - Outstanding invoices
  - Shared documents
- Simplified navigation for client use
- Secure access with client credentials

## 4. Business Rules and Logic

### 4.1 AI Onboarding Processing
- Parse natural language input to extract:
  - Service type
  - Pricing structure (hourly rate, package pricing)
  - Number and types of service packages
  - Target client profile
- Generate default templates based on extracted information
- Create initial business profile in database

### 4.2 Cashflow Prediction Algorithm
- Calculate based on:
  - Historical project data
  - Current pipeline value
  - Average payment terms
  - Recurring expenses
- Update predictions when simulator sliders are adjusted
- Display confidence intervals for projections

### 4.3 Project Status Management
- Automatic status updates based on stage changes in Kanban board
- Trigger notifications when projects move to specific stages
- Update financial projections when project values change

### 4.4 Invoice Generation
- Auto-populate invoice details from project information
- Apply business branding automatically
- Calculate totals including any applicable taxes
- Track payment status and send reminders for overdue invoices

### 4.5 Proposal Workflow
- Draft proposals can be edited multiple times
- Sent proposals are locked from editing
- Track client interactions with proposals (opened, viewed duration)
- Accepted proposals automatically create projects

### 4.6 Authentication and Authorization
- Secure password hashing
- Session management with token-based authentication
- Client portal access uses separate authentication from main app
- Demo login provides read-only access to sample data

## 5. Exception and Boundary Conditions

| Scenario | Handling Method |
|----------|----------------|
| User provides incomplete business description during onboarding | Display helpful prompts and examples; allow proceeding with partial information and editing later in Settings |
| AI Co-pilot fails to generate content | Show error message with retry option; provide manual input alternative |
| Network connection lost during data save | Queue changes locally; sync when connection restored; show offline indicator |
| Drag and drop operation interrupted | Return card to original position; show error notification |
| Invoice payment marked as received but later disputed | Allow status reversal; maintain audit log of all status changes |
| Client portal accessed with invalid credentials | Show error message; provide password reset option |
| Cashflow simulator inputs result in negative projections | Display warning indicator; suggest adjustments |
| Proposal sent to client with no email address | Validate email before sending; show error if missing |
| Multiple users editing same client record simultaneously | Implement last-write-wins with conflict notification |
| Demo login attempting to modify data | Block write operations; show notification that demo mode is read-only |

## 6. Acceptance Criteria

1. User can complete conversational onboarding by describing their business and see generated preview cards within 3 seconds
2. Launch My Business OS button successfully creates business profile and navigates to dashboard
3. Dashboard displays all required widgets: cashflow chart, projects Kanban, tasks, and statistics cards
4. Left sidebar navigation is present on all pages and correctly highlights active page
5. AI Co-pilot button is accessible from all pages and opens chat interface
6. AI Co-pilot can generate at least one proposal and one invoice based on demo data
7. Clients page displays grid of client cards with all specified information
8. Client detail view shows complete profile, project history, and financial summary
9. Projects Kanban board supports drag and drop between stages with smooth animations
10. Finances page displays cashflow chart and simulator with functional sliders
11. Cashflow simulator updates chart in real-time as sliders are adjusted
12. Calendar page displays monthly view with events from projects and clients
13. Proposals page lists all proposals with correct status indicators
14. Proposal builder shows live preview that updates as content is edited
15. Automations page displays list of automations with working toggle switches
16. Settings page allows editing of business profile and user account information
17. Client portal view displays branded interface with client-specific information
18. Authentication system supports both demo login and email signup
19. All pages are fully responsive on desktop and mobile devices
20. Application uses specified color scheme: #0A1428, #10B981, #F59E0B
21. Dark mode is applied by default across entire application
22. All interactions include smooth micro-animations and loading states
23. Demo data is populated for a freelance graphic designer with realistic information
24. Application functions as a Progressive Web App with offline capability indicators

## 7. Out of Scope for Current Release

- Multi-user team collaboration features
- Advanced reporting and analytics beyond basic dashboards
- Third-party integrations with external tools (accounting software, CRM systems)
- Mobile native applications for iOS and Android
- Multi-language support
- Custom domain for client portals
- Advanced automation workflows with conditional logic branches
- Time tracking functionality
- Expense receipt scanning and OCR
- Tax calculation and filing assistance
- Video conferencing integration
- Contract e-signature functionality
- Payment processing integration (actual transactions)
- Email marketing campaigns
- Social media management tools
- White-label reselling capabilities