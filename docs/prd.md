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
- PWA install prompt displayed on first visit or after key interaction
- Smooth page transitions with fade and slide animations
- Loading states with skeleton screens and progress indicators
- Hover effects with scale and glow transformations
- Success animations with confetti or checkmark effects

## 2. Users and Usage Scenarios

### 2.1 Target Users
Freelancers and solopreneurs across various industries including graphic designers, consultants, developers, writers, and other independent service providers.

### 2.2 Core Usage Scenarios
- Initial business setup through conversational AI onboarding
- Daily business operations management including project tracking and client communication
- Financial planning and cashflow forecasting
- Client relationship management and proposal generation
- Invoice creation and payment tracking
- Package subscription management and payment processing
- Email communication with clients for proposals and invoices
- Calendar management for project deadlines and client meetings
- AI-assisted business operations through contextual Co-pilot

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
│   └── Client Create/Edit Modal
├── Projects Page
│   ├── Kanban Board
│   └── Project Create/Edit Modal
├── Packages Page
│   ├── Package List View
│   └── Package Create/Edit Modal
├── Finances Page
├── Calendar Page
├── Proposals Page
│   ├── Proposal List
│   ├── Proposal Builder
│   └── Proposal Generator
├── Invoices Page
│   ├── Invoice List
│   └── Invoice Create/Edit Modal
├── Automations Page
├── Settings Page
├── Client Portal View
│   ├── Client Dashboard
│   ├── Client Projects View
│   ├── Client Proposals View
│   ├── Client Invoices View
│   └── Client Payment Page
└── Stripe Payment Pages
    ├── Checkout Success Page
    └── Checkout Cancel Page
```

### 3.1 Authentication Pages

**Login Page**
- Email and password input fields with floating labels
- Demo login option for quick access
- Link to signup page
- Smooth transition animations with fade-in effects
- Loading spinner during authentication

**Signup Page**
- Email registration form with real-time validation
- Password creation with strength indicator
- Terms acceptance checkbox
- Link back to login page
- Success animation on account creation

### 3.2 Conversational Onboarding Page

**Primary Interface**
- Large centered input box with placeholder text: Describe your freelance business...
- Example prompt displayed: I'm a graphic designer charging $120/hr with 3 packages...
- Real-time AI parsing as user types with typing indicator
- Character count and helpful tips

**Preview Panel (Right Side)**
- Dynamic preview cards showing:
  - Generated service packages
  - Branding suggestions
  - Proposal template preview
  - Contract template preview
- Cards appear with smooth staggered animations as AI processes input
- Shimmer loading effect during generation

**Action Button**
- Prominent Launch My Business OS button with glow effect
- Creates complete business profile and navigates to main dashboard
- Success animation with confetti effect on completion

### 3.3 Main Dashboard

**Layout Components**
- Left sidebar navigation (persistent across all pages)
- Main content area with multiple widgets in responsive grid
- Floating AI Co-pilot button (bottom right) with pulse animation

**Dashboard Widgets**

*Predictive Cashflow Chart*
- Visual chart displaying projected income and expenses with gradient fills
- Interactive What-if sliders for scenario planning
- Time range selector (monthly, quarterly, yearly) with smooth transitions
- Revenue data includes Stripe payment transactions
- Real-time updates when payments are received with animated counters
- Tooltip on hover showing detailed breakdown

*Active Projects Kanban Board*
- Compact view of current projects with card previews
- Status indicators for each project with color coding
- Quick access to project details with slide-in panel
- Drag preview with shadow effect

*Today's Tasks and Bookings*
- List of scheduled activities with checkboxes
- Calendar integration display with mini calendar
- Quick action buttons with icon animations
- Completed task strikethrough animation

*Key Statistics Cards*
- Total revenue (includes Stripe payments) with animated counter
- Active clients count with growth indicator
- Pending invoices with urgency badge
- Project completion rate with progress ring
- Monthly recurring revenue from package subscriptions with trend arrow
- Cards with hover lift effect and subtle glow

### 3.4 Navigation Sidebar

**Menu Items**
- Home (Dashboard)
- Clients
- Projects
- Packages
- Finances
- Calendar
- Proposals
- Invoices
- Automations
- Settings

**Visual Design**
- Icons for each menu item with consistent style
- Active state highlighting with emerald green accent
- Smooth hover effects with background color transition
- Collapsible on mobile with slide animation
- Badge indicators for notifications or pending items

### 3.5 AI Co-pilot (Enhanced Contextual Intelligence)

**Interface**
- Floating button with AI icon and subtle pulse animation
- Expandable chat sidebar panel with smooth slide-in transition
- Context-aware conversation interface with typing indicators
- Quick-action suggestion chips displayed prominently

**Contextual Understanding**
- Full access to user business profile including:
  - Business name, description, and branding
  - Service packages and pricing structure
  - Hourly rates and payment terms
- Real-time awareness of all clients:
  - Client names, companies, contact information
  - Client project history and total value
  - Outstanding invoices and payment status
- Complete project visibility:
  - Active projects with status and deadlines
  - Project values and associated clients
  - Project completion rates and timelines
- Financial data comprehension:
  - Current cashflow and projections
  - Revenue breakdown (one-time, recurring, Stripe payments)
  - Outstanding invoices and payment history
  - Monthly recurring revenue trends
- Proposal and invoice awareness:
  - Draft, sent, and accepted proposals
  - Invoice statuses and due dates
  - Payment processing history

**Action Capabilities**
- Generate proposals:
  - Create proposal for [Client Name] command
  - Auto-populate with client and project data
  - Suggest pricing based on packages or hourly rate
  - Generate complete proposal content with one command
- Create invoices:
  - Generate invoice for [Project Name] command
  - Auto-fill client, project, and amount details
  - Calculate amounts based on project scope
  - Set appropriate due dates based on payment terms
- Forecast cashflow:
  - Forecast next 3 months command
  - Analyze historical data and current pipeline
  - Project revenue from recurring subscriptions
  - Identify potential cash gaps and opportunities
- Client insights:
  - Summarize [Client Name] activity command
  - Show project history and total value
  - List outstanding invoices and proposals
  - Suggest next actions for client relationship
- Business analytics:
  - Show top clients by revenue command
  - Analyze project completion rates
  - Identify overdue invoices
  - Suggest pricing optimizations
- Draft communications:
  - Draft email to [Client Name] about [Topic] command
  - Generate follow-up messages for proposals
  - Create payment reminder emails
  - Compose project update communications
- Workflow automation suggestions:
  - Suggest automations for my business command
  - Identify repetitive tasks
  - Recommend trigger-action combinations
  - Estimate time savings

**Quick-Action Suggestion Chips**
- Displayed at bottom of chat interface
- Context-aware suggestions based on current page and recent activity
- Examples:
  - Create proposal for [Recent Client]
  - Generate invoice for [Completed Project]
  - Forecast cashflow for next quarter
  - Draft follow-up email for [Sent Proposal]
  - Analyze revenue trends
  - Show overdue invoices
- Chips update dynamically based on:
  - Current page context
  - Recent user actions
  - Pending tasks or deadlines
  - Business state (e.g., overdue invoices, completed projects)
- Clicking chip executes action immediately or opens relevant form
- Smooth chip appearance with fade-in animation
- Maximum 4 chips displayed at once, prioritized by relevance

**Interaction**
- Natural language input with autocomplete suggestions
- Streaming response display with typing animation
- Action buttons for generated content (e.g., Save Proposal, Send Email, Create Invoice)
- Conversation history with collapsible previous sessions
- Copy to clipboard functionality for generated content
- Feedback buttons (thumbs up/down) for response quality
- Voice input option for hands-free interaction

**Visual Design**
- Chat messages with distinct user and AI styling
- Code blocks and formatted content rendering
- Loading states with animated dots
- Success confirmations with checkmark animations
- Error handling with retry options
- Minimized state shows unread message count badge

### 3.6 Clients Page

**Client List View**
- Grid layout of client cards with hover lift effect
- Each card displays:
  - Client avatar (uploaded or default) with border glow
  - Client name with bold typography
  - Company name in secondary text
  - Email address with icon
  - Phone number with icon
  - Total project value with currency formatting
  - Last interaction date with relative time
- Search and filter functionality with instant results
- Add New Client button with icon and hover glow
- Empty state with illustration and Create Your First Client call-to-action when no clients exist
- Skeleton loading state during data fetch

**Client Create/Edit Modal**
- Modal overlay with backdrop blur and fade-in animation
- Form fields:
  - Name (required) with floating label
  - Email (required) with validation indicator
  - Company (optional)
  - Phone (optional) with format validation
  - Notes (optional text area) with character count
  - Avatar upload (optional, with preview) and drag-drop support
- Save and Cancel buttons with loading states
- Form validation with inline error messages and shake animation
- Success animation with checkmark on save
- Real-time data persistence to Supabase

**Client Actions**
- Edit: Opens modal with pre-filled data and smooth transition
- Delete: Confirmation dialog with warning message before deletion
- View Details: Navigate to client detail view showing:
  - Complete profile information with edit button
  - Associated projects list with status badges
  - Associated proposals list with quick actions
  - Associated invoices list with payment status
  - Communication timeline with activity feed
  - Notes section with rich text editor

### 3.7 Projects Page

**Kanban Board Layout**
- Four draggable columns: To Do, In Progress, Review, Done
- Each project card displays:
  - Project name with truncation
  - Client name (linked) with avatar
  - Deadline date with countdown indicator
  - Project value with currency formatting
  - Progress indicator with percentage
  - Status color coding with gradient
- Drag and drop functionality between columns with smooth animations
- Drop zone highlighting during drag
- Add New Project button with icon and pulse effect
- Empty state for each column when no projects exist
- Column collapse/expand functionality

**Project Create/Edit Modal**
- Modal overlay with backdrop blur and slide-up animation
- Form fields:
  - Project name (required) with floating label
  - Client selection dropdown (required, populated from clients list) with search
  - Description (optional text area) with rich text formatting
  - Value/Budget (required, numeric input) with currency symbol
  - Deadline (required, date picker) with calendar popup
  - Status (auto-set based on column, editable) with dropdown
- Save and Cancel buttons with loading spinners
- Form validation with inline error messages
- Success animation with confetti on save
- Real-time data persistence to Supabase

**Drag and Drop Functionality**
- Smooth card movement between columns with physics-based animation
- Visual feedback during drag (shadow, opacity change, scale)
- Auto-save status change on drop with optimistic update
- Real-time updates across all connected clients
- Optimistic UI updates with rollback on error and error toast
- Haptic feedback on mobile devices

**Project Actions**
- Edit: Opens modal with pre-filled data
- Delete: Confirmation dialog with cascade warning before deletion
- Quick status change via drag and drop
- View Details: Slide-in panel with full project information

### 3.8 Packages Page

**Package List View**
- Grid or card layout displaying all service packages with hover effects
- Each package card displays:
  - Package name with bold typography
  - Description with truncation and read more
  - One-time price (if applicable) with currency formatting
  - Monthly recurring price (if applicable) with per month label
  - Features list with checkmark icons
  - Active/Inactive status toggle with smooth transition
- Add New Package button with icon and glow effect
- Empty state with illustration and Create Your First Package call-to-action when no packages exist
- Skeleton loading state during data fetch

**Package Create/Edit Modal**
- Modal overlay with backdrop blur and fade-in animation
- Form fields:
  - Package name (required) with floating label
  - Description (required, text area) with character count
  - One-time price (optional, numeric input with currency symbol)
  - Monthly recurring price (optional, numeric input with currency symbol)
  - Features list (dynamic list input) with add/remove buttons
  - Active status toggle (default: active) with smooth animation
- At least one price type (one-time or monthly) must be provided
- Save and Cancel buttons with loading states
- Form validation with inline error messages
- Success animation with checkmark on save
- Real-time data persistence to Supabase
- Stripe Price ID fields (auto-generated on save via Stripe API)

**Package Actions**
- Edit: Opens modal with pre-filled data
- Delete: Confirmation dialog with subscription check before deletion
- Toggle Active/Inactive: Updates package availability with animation
- View Subscribers: Shows list of clients subscribed to monthly packages in slide-in panel

### 3.9 Finances Page

**Cashflow Dashboard**
- Comprehensive financial overview chart with gradient fills and animations
- Income vs expenses visualization with dual-axis chart
- Profit margin display with percentage indicator
- Revenue breakdown showing:
  - One-time payments from invoices
  - Recurring revenue from package subscriptions
  - Stripe payment transactions
- Interactive legend with toggle visibility

**Cashflow Simulator**
- Interactive sliders for:
  - Projected new clients with range indicator
  - Average project value with currency formatting
  - Monthly expenses with breakdown
  - Payment terms with day selector
- Real-time chart updates based on inputs with smooth transitions
- Scenario comparison view with side-by-side charts
- Save scenario button for future reference

**Financial Summary Cards**
- Outstanding invoices with count and total amount
- Received payments this month (includes Stripe payments) with growth indicator
- Upcoming expenses with calendar integration
- Net profit with percentage change
- Monthly recurring revenue (MRR) with trend arrow
- Total Stripe revenue with transaction count
- Cards with hover lift effect and animated counters

**Invoice Management Section**
- List of all invoices with quick filters (All, Paid, Unpaid, Overdue)
- Link to Invoices page for full management
- Quick actions for each invoice

**Payment History**
- List of recent Stripe transactions with pagination
- Each transaction displays:
  - Date and time with relative formatting
  - Amount with currency symbol
  - Payment method with card icon
  - Client name (linked)
  - Invoice or package reference (linked)
  - Payment status badge
- Export to CSV functionality
- Filter by date range and payment method

### 3.10 Calendar Page

**Calendar View**
- Monthly calendar grid with day, week, and month view options
- Event markers for:
  - Project deadlines (automatically populated from Projects)
  - Client meetings
  - Payment due dates
  - Custom tasks
- Color-coded event types for visual distinction
- Smooth view transitions with fade animation
- Today indicator with highlight

**Event Display**
- Project deadlines display:
  - Project name with truncation
  - Client name with avatar
  - Deadline date with time
  - Visual indicator on calendar grid with color coding
- Client meetings display:
  - Meeting title
  - Client name with avatar
  - Date and time with duration
  - Location or meeting link with icon
- Payment due dates display:
  - Invoice number (linked)
  - Client name
  - Amount due with currency formatting
  - Due date indicator with urgency color

**Event Management**
- Click on calendar date to add new event with modal popup
- Event creation modal with fields:
  - Event type (Meeting, Task, Custom) with icon selector
  - Title (required) with floating label
  - Client selection (optional, for meetings) with search
  - Date and time (required) with date-time picker
  - Duration (optional) with preset options
  - Location or meeting link (optional) with validation
  - Notes (optional) with rich text editor
- Event detail popup on click showing full information with smooth transition
- Edit and delete actions for custom events
- Project deadlines are read-only and sync from Projects page
- Drag and drop to reschedule events with confirmation

**Google Calendar Integration (Optional)**
- Connect Google Calendar button in Settings with OAuth flow
- OAuth authentication flow for Google account with popup window
- Two-way sync option:
  - Import Google Calendar events into Forgefly
  - Export Forgefly events to Google Calendar
- Sync status indicator with last sync time
- Manual sync trigger button with loading spinner
- Disconnect option in Settings with confirmation

### 3.11 Proposals Page

**Proposal List**
- Table or card view of all proposals with sorting options
- Each proposal displays:
  - Proposal title with truncation
  - Client name (linked) with avatar
  - Associated project (if any) with status badge
  - Status badge (Draft, Sent, Accepted, Rejected) with color coding
  - Creation date with relative time
  - Sent date with timestamp
  - Value amount with currency formatting
- Quick actions: View, Edit, Duplicate, Send, Delete with icon buttons
- Filter by status with dropdown
- Search functionality with instant results
- Create New Proposal button with icon and glow effect
- Empty state with illustration and Create Your First Proposal call-to-action
- Skeleton loading state during data fetch

**Proposal Generator**
- Accessible via Create New Proposal button
- Client selection dropdown (required) with search and avatar display
- Project selection dropdown (optional, filtered by selected client)
- Generate from AI button: Auto-populates content based on client and project data with loading animation
- Manual input option if AI generation not used
- Preview panel showing generated content in real-time

**Proposal Builder**
- Split view layout:
  - Left panel: Editable rich text content sections
    - Cover page with business branding and logo upload
    - Client information with auto-fill
    - Service description with formatting toolbar
    - Pricing breakdown table with editable rows
    - Timeline and deliverables with milestone editor
    - Terms and conditions with template library
  - Right panel: Live PDF-style preview with real-time updates and zoom controls
- Rich text editor with formatting options (bold, italic, lists, headings, images)
- Save as Draft button with auto-save indicator
- Send to Client button (triggers email sending) with confirmation
- Success animation with confetti on save and send
- Real-time data persistence to Supabase
- Undo/redo functionality

**Proposal Actions**
- Edit: Opens builder with existing content (only for Draft status)
- View: Read-only preview mode with print option
- Duplicate: Creates copy with Draft status and appended Copy suffix
- Send: Opens email confirmation modal, then sends branded email to client
- Delete: Confirmation dialog before deletion
- Mark as Accepted/Rejected: Manual status update with confirmation

**Send Proposal Email Flow**
- Send button opens confirmation modal displaying:
  - Client email address with validation
  - Proposal title
  - Preview of email content with formatting
  - Confirm Send and Cancel buttons
- On confirmation:
  - Changes proposal status to Sent with animation
  - Locks proposal from editing
  - Sends branded email to client email address
  - Shows success notification with sent timestamp and confetti
  - Updates proposal sent date in database

### 3.12 Invoices Page

**Invoice List**
- Table or card view of all invoices with sorting options
- Each invoice displays:
  - Invoice number (auto-generated) with copy button
  - Client name (linked) with avatar
  - Associated project (linked) with status badge
  - Amount with currency formatting
  - Issue date with relative time
  - Due date with countdown indicator
  - Status badge (Draft, Sent, Paid, Overdue) with color coding
  - Payment status badge (Unpaid, Processing, Paid) with icon
- Quick actions: View, Edit, Send, Mark as Paid, Delete, Pay with Stripe with icon buttons
- Filter by status with dropdown
- Search functionality with instant results
- Create New Invoice button with icon and glow effect
- Empty state with illustration and Create Your First Invoice call-to-action
- Skeleton loading state during data fetch

**Invoice Create/Edit Modal**
- Modal overlay with backdrop blur and slide-up animation
- Form fields:
  - Client selection dropdown (required) with search and avatar display
  - Project selection dropdown (required, filtered by selected client)
  - Amount (required, numeric input) with currency symbol
  - Issue date (required, date picker, defaults to today)
  - Due date (required, date picker) with validation
  - Description/Line items (optional text area or structured line item inputs) with add/remove rows
  - Notes (optional) with rich text editor
  - Status (Draft, Sent, Paid) with dropdown
- Save and Cancel buttons with loading states
- Form validation with inline error messages
- Success animation with checkmark on save
- Real-time data persistence to Supabase

**Invoice Actions**
- Edit: Opens modal with pre-filled data (only for Draft status)
- View: Read-only preview with formatted invoice layout including Pay with Stripe button and print option
- Send: Opens email confirmation modal, then sends branded email to client
- Mark as Paid: Changes status to Paid and updates financial dashboard with animation
- Delete: Confirmation dialog before deletion
- Pay with Stripe: Creates Stripe Checkout Session and redirects to secure payment page
- Automatic status change to Overdue when due date passes and status is Sent with notification

**Send Invoice Email Flow**
- Send button opens confirmation modal displaying:
  - Client email address with validation
  - Invoice number and amount
  - Preview of email content with formatting
  - Confirm Send and Cancel buttons
- On confirmation:
  - Changes invoice status to Sent with animation
  - Sends branded email to client email address with:
    - Invoice details (number, amount, due date)
    - Payment link (Stripe checkout or client portal)
    - PDF attachment or view link
  - Shows success notification with sent timestamp and confetti
  - Updates invoice sent date in database

**Stripe Payment Integration**
- Pay with Stripe button displayed on invoice view page with emerald green styling
- Button styling matches application design system with hover glow
- Clicking button initiates Stripe Checkout Session creation with loading spinner
- Redirects to Stripe-hosted checkout page with invoice details
- Checkout page displays:
  - Invoice number and amount
  - Business branding with logo
  - Secure payment form
  - Test mode indicator
- Success redirect returns to Checkout Success Page
- Cancel redirect returns to Checkout Cancel Page

### 3.13 Automations Page

**Automation List**
- Display of configured automations in card layout
- Each automation shows:
  - Trigger condition with icon
  - Action to be performed with description
  - Status (Active/Inactive) with toggle
  - Last run timestamp
- Toggle switches for enable/disable with smooth animation
- Edit and delete actions for each automation

**Create Automation**
- Trigger selection (e.g., New client added, Invoice overdue, Project completed) with icon picker
- Action configuration (e.g., Send email, Create task, Update status) with parameter inputs
- AI suggestions for useful automations based on business data
- Test automation button with preview of results
- Save button with validation

### 3.14 Settings Page

**Business Profile**
- Business name and description with rich text editor
- Service packages configuration with link to Packages page
- Hourly rates and pricing with currency selector
- Branding elements (logo, colors) with color picker and logo upload
- Save button with success animation

**User Account**
- Personal information with editable fields
- Email and password management with change password modal
- Notification preferences with toggle switches
- Profile picture upload with preview

**Integrations**
- Calendar sync options with status indicators
- Google Calendar connection toggle with OAuth flow
- Payment gateway connections with Stripe logo
- Email service integration with provider selection

**Stripe Configuration**
- Stripe account connection status with badge
- Test mode indicator with warning message
- Publishable key display (masked) with copy button
- Webhook endpoint URL with copy button
- Connection/Disconnection actions with confirmation

**Email Configuration**
- Email service provider settings with dropdown
- Sender email address configuration with validation
- Email template customization options with preview
- Test email sending functionality with recipient input

### 3.15 Client Portal View (Enhanced)

**Portal Interface**
- Branded header with user's business identity (logo, colors, business name)
- Welcome message with client name personalization
- Client-specific dashboard showing:
  - Active projects with progress bars and status badges
  - Proposals awaiting review with quick accept/reject actions
  - Outstanding invoices with Pay with Stripe buttons and due date indicators
  - Shared documents with download links
  - Recent activity timeline
- Simplified navigation for client use with clear labels
- Secure access with client credentials (email and password)
- Responsive design optimized for mobile devices

**Client Dashboard**
- Overview cards displaying:
  - Total project value with currency formatting
  - Active projects count with status breakdown
  - Pending proposals count with urgency indicator
  - Outstanding invoices total with payment button
- Quick action buttons:
  - View all projects
  - Review proposals
  - Pay invoices
  - Contact business owner

**Client Projects View**
- List of all projects associated with client
- Each project displays:
  - Project name with description
  - Status badge with color coding
  - Deadline with countdown
  - Progress indicator with percentage
  - Deliverables checklist
- Project detail view with:
  - Full description
  - Timeline with milestones
  - File attachments
  - Communication thread

**Client Proposals View**
- List of proposals sent to client
- Each proposal displays:
  - Proposal title
  - Sent date with relative time
  - Value amount with currency formatting
  - Status badge (Pending, Accepted, Rejected)
  - View button
- Proposal detail view with:
  - Full proposal content with formatting
  - Accept and Reject buttons (for pending proposals)
  - Download PDF option
  - Comments section for questions

**Client Invoices View**
- List of all invoices for client
- Each invoice displays:
  - Invoice number with copy button
  - Issue date and due date
  - Amount with currency formatting
  - Status badge (Unpaid, Paid, Overdue)
  - Pay with Stripe button (for unpaid invoices)
  - View button
- Invoice detail view with:
  - Full invoice breakdown
  - Line items with descriptions
  - Payment history
  - Download PDF option

**Client Payment Page**
- Accessed via Pay with Stripe button on invoices
- Displays invoice details with amount due
- Secure payment form powered by Stripe
- Payment method selection (card, other methods)
- Save payment method option for future use
- Processing indicator during payment
- Success confirmation with receipt

**Client Portal Security**
- Separate authentication from main app
- Client-specific credentials (email and password)
- Session management with timeout
- Read-only access to business owner data
- Secure payment processing through Stripe

**Client Portal UX Enhancements**
- Smooth page transitions with fade animations
- Loading states with skeleton screens
- Success animations for actions (accept proposal, payment)
- Mobile-optimized touch interactions
- Offline mode with cached data display
- Push notifications for new proposals and invoices (PWA)

### 3.16 Stripe Payment Pages

**Checkout Success Page**
- Success confirmation message with large checkmark icon and animation
- Payment details summary:
  - Invoice number with copy button
  - Amount paid with currency formatting
  - Payment method with card icon
  - Transaction ID with copy button
  - Payment date and time
- Return to Dashboard button with icon
- Automatic invoice status update to Paid
- Automatic payment record creation in database
- Success animation with confetti effect
- Email confirmation sent notification

**Checkout Cancel Page**
- Cancellation message with friendly tone
- Explanation that payment was not processed
- Invoice details reminder with amount and due date
- Try Again button (redirects back to invoice view) with icon
- Return to Dashboard button with icon
- Friendly tone encouraging user to complete payment later
- Support contact information

## 4. Business Rules and Logic

### 4.1 Data Persistence and Storage
- All client, project, package, proposal, and invoice data stored in Supabase database
- Stripe payment transactions stored in Supabase with reference to invoices
- Real-time subscriptions enabled for:
  - Client list updates
  - Project Kanban board changes
  - Proposal status changes
  - Invoice status changes
  - Payment status changes
  - Calendar event changes
- Optimistic UI updates with automatic rollback on save failure
- Data validation on both client and server side
- Automatic data backup and recovery mechanisms

### 4.2 Client Management Rules
- Client email must be unique across the system
- Client name is required for creation
- Deleting a client requires confirmation
- Client deletion cascades to associated projects, proposals, and invoices (with warning)
- Avatar images stored in Supabase storage with public access URLs
- Client portal credentials generated on first client creation

### 4.3 Project Management Rules
- Project must be linked to an existing client
- Project status automatically updates when card is dragged to different Kanban column
- Status values map to columns: To Do, In Progress, Review, Done
- Project value must be a positive number
- Deadline must be a future date (warning if past date)
- Deleting a project requires confirmation
- Project deadlines automatically sync to Calendar page in real-time

### 4.4 Package Management Rules
- Package name is required and must be unique
- At least one price type (one-time or monthly) must be provided
- Prices must be positive numbers
- When package is created or updated, corresponding Stripe Price objects are created via Stripe API
- Stripe Price IDs are stored in database for reference
- Active packages are available for client purchase
- Inactive packages are hidden from client portal but retain existing subscriptions
- Monthly packages create recurring Stripe subscriptions
- One-time packages create single Stripe payment intents

### 4.5 Proposal Management Rules
- Proposal must be linked to a client
- Proposal can optionally be linked to a project
- Draft proposals can be edited unlimited times
- Sent proposals are locked from editing
- Proposal status workflow: Draft → Sent → Accepted/Rejected
- AI-generated proposals use client and project data to populate content
- Proposal content stored as rich text (HTML or Markdown)
- Duplicate action creates new proposal with Draft status and appended Copy suffix
- Send action triggers email delivery to client email address
- Email must contain proposal content or link to view proposal in client portal

### 4.6 Invoice Management Rules
- Invoice must be linked to both a client and a project
- Invoice number auto-generated using format: INV-YYYYMMDD-XXX
- Invoice status workflow: Draft → Sent → Paid
- Payment status workflow: Unpaid → Processing → Paid
- Automatic status change to Overdue when due date passes and status is Sent
- Send action triggers email delivery to client email address
- Email must contain invoice details and payment link
- Mark as Paid action updates status and triggers financial dashboard recalculation
- Invoice amount must be a positive number
- Due date must be equal to or after issue date
- Pay with Stripe button only visible when invoice status is Sent or Overdue

### 4.7 Email Sending Rules
- All emails sent using configured email service provider
- Email templates use dark theme with emerald green accents matching application design
- Proposal emails include:
  - Business branding (logo, colors)
  - Personalized greeting with client name
  - Proposal title and summary
  - Link to view full proposal in client portal or PDF attachment
  - Call-to-action button with emerald green styling
  - Footer with business contact information
- Invoice emails include:
  - Business branding (logo, colors)
  - Personalized greeting with client name
  - Invoice number, amount, and due date
  - Itemized breakdown or summary
  - Payment link (Stripe checkout or client portal) with prominent button
  - PDF attachment or view link
  - Footer with business contact information
- Email sending status tracked in database
- Failed email delivery triggers retry mechanism (up to 3 attempts)
- Email delivery confirmation shown to user with timestamp

### 4.8 Calendar Management Rules
- Project deadlines automatically populate calendar from Projects page
- Deadline changes in Projects page sync to Calendar in real-time
- Custom events can be created, edited, and deleted
- Project deadline events are read-only on Calendar page
- Event types are color-coded for visual distinction
- Google Calendar sync (if enabled) runs every 15 minutes
- Sync conflicts resolved using last-modified timestamp
- Disconnecting Google Calendar retains local events

### 4.9 Stripe Payment Processing Rules
- All Stripe operations use test mode API keys
- Checkout Session creation includes:
  - Invoice amount and currency
  - Client email
  - Invoice number in metadata
  - Success and cancel URLs
  - Payment method types: card
- Successful payment triggers webhook event
- Webhook handler validates event signature
- Webhook handler updates invoice status to Paid
- Webhook handler updates payment status to Paid
- Webhook handler creates payment record in database with:
  - Transaction ID
  - Amount
  - Payment method
  - Timestamp
  - Invoice reference
  - Client reference
- Failed payments retain Unpaid status
- Payment records are immutable once created
- Stripe Customer objects created for each client on first payment
- Customer ID stored in client record for future transactions

### 4.10 Real-time Updates
- Supabase real-time subscriptions for all CRUD operations
- Multiple users can view same data with live updates
- Conflict resolution uses last-write-wins strategy
- Visual indicators show when data is being updated by another user
- Payment status updates trigger real-time dashboard refresh
- Calendar events sync in real-time across all connected clients

### 4.11 AI Onboarding Processing
- Parse natural language input to extract:
  - Service type
  - Pricing structure (hourly rate, package pricing)
  - Number and types of service packages
  - Target client profile
- Generate default templates based on extracted information
- Create initial business profile in database

### 4.12 Cashflow Prediction Algorithm
- Calculate based on:
  - Historical project data
  - Current pipeline value
  - Average payment terms
  - Recurring expenses
  - Invoice payment status
  - Stripe payment transactions
  - Monthly recurring revenue from package subscriptions
- Update predictions when simulator sliders are adjusted
- Display confidence intervals for projections
- Include projected subscription renewals in future cashflow

### 4.13 Authentication and Authorization
- Secure password hashing using bcrypt
- Session management with token-based authentication (JWT)
- Client portal access uses separate authentication from main app
- Demo login provides read-only access to sample data
- Password reset functionality with email verification

### 4.14 Stripe Webhook Security
- Webhook endpoint validates Stripe signature
- Invalid signatures are rejected with 400 error
- Webhook events are idempotent (duplicate events ignored)
- Webhook endpoint URL configured in Stripe dashboard
- Test mode webhooks use test signing secret

### 4.15 AI Co-pilot Contextual Processing
- Co-pilot maintains full context of user business state
- Context includes:
  - Business profile and branding
  - All clients with complete details
  - All projects with status and deadlines
  - Financial data and cashflow projections
  - Proposals and invoices with statuses
- Context refreshed on every interaction
- Action commands trigger corresponding API calls
- Generated content validated before presentation
- Quick-action chips prioritized by:
  - Current page context (highest priority)
  - Recent user activity
  - Pending tasks and deadlines
  - Business state urgency (overdue invoices, completed projects)
- Chip relevance score calculated using weighted algorithm
- Maximum 4 chips displayed, refreshed every 30 seconds or on context change

### 4.16 PWA Installation and Offline Support
- PWA install prompt displayed on first visit or after key interaction
- Install prompt includes:
  - Application icon and name
  - Brief description of benefits
  - Install and Dismiss buttons
- Service worker caches critical assets for offline access
- Offline mode displays cached data with stale indicator
- Background sync queues actions when offline
- Push notifications for important events (new proposals, overdue invoices)

### 4.17 Client Portal Access Rules
- Client portal credentials generated on first client creation
- Credentials sent to client email address
- Client can reset password via email verification
- Client session timeout after 30 minutes of inactivity
- Client can only view data associated with their account
- Client cannot access other clients' data
- Client cannot modify business owner settings

## 5. Exception and Boundary Conditions

| Scenario | Handling Method |
|----------|----------------|
| User provides incomplete business description during onboarding | Display helpful prompts and examples; allow proceeding with partial information and editing later in Settings |
| AI Co-pilot fails to generate content | Show error message with retry option; provide manual input alternative; log error for debugging |
| AI Co-pilot receives ambiguous command | Request clarification with suggested interpretations; provide examples of valid commands |
| AI Co-pilot action fails (e.g., proposal creation) | Show error toast with specific reason; offer retry or manual creation option |
| Quick-action chip becomes irrelevant during display | Chip fades out and is replaced with next relevant suggestion |
| Network connection lost during data save | Queue changes locally; sync when connection restored; show offline indicator with sync status |
| Supabase connection fails | Display error toast; retry automatically with exponential backoff; show cached data with stale indicator |
| Drag and drop operation interrupted | Return card to original position with animation; show error notification |
| Client creation with duplicate email | Show validation error; suggest editing existing client or using different email |
| Project linked to deleted client | Prevent client deletion if projects exist; require reassignment or deletion with cascade warning |
| Proposal sent without client email | Validate email before sending; show error if missing; prevent send action |
| Invoice due date in the past | Show warning but allow creation; automatically mark as Overdue with notification |
| Multiple users editing same record simultaneously | Last-write-wins; show notification of conflict; offer refresh option to view latest data |
| Demo login attempting to modify data | Block write operations; show notification that demo mode is read-only |
| Empty states for lists | Display friendly illustration with call-to-action button and helpful message |
| Form submission with validation errors | Highlight error fields with shake animation; show inline error messages; prevent submission |
| Modal close with unsaved changes | Show confirmation dialog; offer save, discard, or cancel options |
| Real-time update fails to sync | Show error indicator; offer manual refresh; log error for debugging |
| Avatar upload exceeds size limit | Show error message; suggest image compression; limit to 5MB |
| Stripe API call fails | Display user-friendly error message; log error details; offer retry option |
| Stripe Checkout Session creation fails | Show error toast with reason; log error; allow user to retry payment |
| Webhook event processing fails | Log error; return 500 status to trigger Stripe retry; alert admin |
| Payment webhook received for unknown invoice | Log warning; return 200 to prevent retry; alert admin for investigation |
| Duplicate webhook event received | Detect duplicate using event ID; skip processing; return 200 |
| User cancels Stripe checkout | Redirect to cancel page; invoice remains in Sent status; allow retry with same checkout link |
| Payment succeeds but webhook fails to update database | Stripe retry mechanism handles webhook delivery; manual reconciliation available in admin panel |
| Package creation fails to create Stripe Price | Show error message; prevent package save; log Stripe error details; offer retry |
| User attempts to delete package with active subscriptions | Show warning with subscription count; prevent deletion; suggest deactivating instead |
| Stripe test card declined | Show payment failed message on checkout; redirect to cancel page; allow retry with different card |
| Invoice amount is zero or negative | Validation error prevents save; show inline error message with shake animation |
| Package price is zero | Allow save (free package); skip Stripe Price creation; mark as free in UI |
| Email service unavailable | Show error notification; queue email for retry; log failure; notify admin |
| Email delivery fails | Retry up to 3 times with exponential backoff; show failure notification; log error details |
| Client email address invalid | Validate email format before sending; show error message; prevent send action |
| Email template rendering fails | Use fallback plain text template; log error; notify admin |
| Send email confirmation modal cancelled | No email sent; proposal/invoice status unchanged; show cancellation confirmation |
| Google Calendar sync fails | Show error notification; offer manual retry; log error details; display last successful sync time |
| Google Calendar OAuth fails | Show authentication error; offer reconnection option; provide troubleshooting link |
| Calendar event creation fails | Show error notification; allow retry; log error; suggest manual creation |
| Project deadline updated while calendar open | Real-time sync updates calendar view automatically with smooth animation |
| Google Calendar disconnected | Stop sync; retain local events; show disconnected status; offer reconnection |
| PWA install prompt dismissed | Store dismissal in local storage; show again after 7 days or on user request |
| Service worker update available | Show update notification; offer reload option; auto-reload after user inactivity |
| Offline action queued | Show queued indicator; display sync status; retry when connection restored |
| Client portal login fails | Show error message; offer password reset option; limit login attempts to prevent brute force |
| Client portal session expired | Redirect to login page; show session expired message; preserve intended destination |
| Client attempts to access unauthorized data | Show access denied message; log security event; redirect to dashboard |
| Animation performance issues on low-end devices | Detect device capabilities; reduce animation complexity; disable non-essential animations |
| Large dataset rendering (100+ items) | Implement virtual scrolling; paginate results; show loading indicators |
| AI Co-pilot context too large | Summarize older context; prioritize recent and relevant data; maintain core business profile |
| Quick-action chip execution fails | Show error toast; log failure; remove failed chip; suggest alternative action |

## 6. Acceptance Criteria

1. User can complete conversational onboarding by describing their business and see generated preview cards within 3 seconds
2. Launch My Business OS button successfully creates business profile and navigates to dashboard with confetti animation
3. Dashboard displays all required widgets: cashflow chart, projects Kanban, tasks, and statistics cards with smooth loading animations
4. Dashboard displays revenue statistics including Stripe payment data with animated counters
5. Left sidebar navigation is present on all pages and correctly highlights active page with emerald green accent
6. Navigation sidebar includes Packages and Calendar menu items with icons
7. AI Co-pilot button is accessible from all pages with pulse animation and opens chat interface with smooth slide-in
8. AI Co-pilot displays 4 contextual quick-action suggestion chips based on current page and business state
9. Quick-action chips update dynamically when context changes (e.g., page navigation, completed action)
10. AI Co-pilot can execute commands like Create proposal for [Client Name] and generate complete proposal content
11. AI Co-pilot can execute Generate invoice for [Project Name] and auto-fill all invoice details
12. AI Co-pilot can execute Forecast cashflow for next 3 months and display detailed projections
13. AI Co-pilot maintains full context of business profile, clients, projects, finances, proposals, and invoices
14. AI Co-pilot provides action buttons for generated content (Save Proposal, Send Email, Create Invoice)
15. AI Co-pilot conversation history is preserved and collapsible
16. Clients page displays grid of client cards with all specified information and hover lift effects
17. Add New Client button opens modal with all required fields and smooth fade-in animation
18. Client create modal saves data to Supabase and updates list view in real-time with success animation
19. Client edit modal pre-fills existing data and updates on save with checkmark animation
20. Client delete action shows confirmation and removes from database
21. Client list shows empty state with illustration when no clients exist
22. Projects Kanban board displays four columns: To Do, In Progress, Review, Done with smooth animations
23. Project cards can be dragged between columns with physics-based animations and drop zone highlighting
24. Project status updates automatically when card is dropped in new column with optimistic UI update
25. Add New Project button opens modal with client dropdown populated from database
26. Project create modal saves data to Supabase and adds card to appropriate column with confetti animation
27. Project edit modal pre-fills existing data and updates on save
28. Project delete action shows confirmation and removes from database
29. Kanban columns show empty state when no projects exist in that status
30. Real-time updates reflect project changes across all connected clients with smooth animations
31. Project deadlines automatically appear on Calendar page with color coding
32. Packages page displays grid of package cards with pricing information and hover effects
33. Add New Package button opens modal with all required fields
34. Package create modal validates that at least one price type is provided
35. Package create modal successfully creates Stripe Price objects via API
36. Package create modal saves data including Stripe Price IDs to Supabase
37. Package edit modal pre-fills existing data and updates on save
38. Package delete action shows confirmation and prevents deletion if active subscriptions exist
39. Package list shows empty state with illustration when no packages exist
40. Calendar page displays monthly view with day, week, and month options and smooth view transitions
41. Calendar shows project deadlines with project name and client name with color coding
42. Calendar allows creation of custom events (meetings, tasks) with modal popup
43. Calendar event creation modal saves data to Supabase
44. Calendar events are color-coded by type
45. Calendar syncs project deadline changes in real-time with smooth animations
46. Google Calendar connection option available in Settings
47. Google Calendar OAuth flow completes successfully with popup window
48. Google Calendar events sync to Forgefly calendar
49. Forgefly events sync to Google Calendar (if two-way sync enabled)
50. Calendar sync status indicator shows connection state and last sync time
51. Manual sync trigger button refreshes calendar data with loading spinner
52. Proposals page lists all proposals with correct status badges and sorting options
53. Create New Proposal button opens generator with client and project selection
54. Proposal builder displays split view with editor and live preview with real-time updates
55. Proposal content saves to Supabase as rich text
56. Send Proposal button opens email confirmation modal with preview
57. Email confirmation modal displays client email and proposal preview
58. Confirming email send changes proposal status to Sent with animation
59. Proposal email is delivered to client email address
60. Proposal email uses dark theme with emerald green accents
61. Proposal email includes business branding and proposal link to client portal
62. Sent proposal is locked from editing
63. Proposal list shows empty state with illustration when no proposals exist
64. Invoices page lists all invoices with status badges and linked client/project
65. Create New Invoice button opens modal with all required fields
66. Invoice create modal saves data to Supabase and updates list view with success animation
67. Invoice status automatically changes to Overdue when due date passes with notification
68. Send Invoice button opens email confirmation modal with preview
69. Email confirmation modal displays client email and invoice preview
70. Confirming email send changes invoice status to Sent with animation
71. Invoice email is delivered to client email address
72. Invoice email uses dark theme with emerald green accents
73. Invoice email includes invoice details and payment link to client portal
74. Mark as Paid action changes status to Paid and updates financial dashboard with animation
75. Invoice list shows empty state with illustration when no invoices exist
76. Invoice view page displays Pay with Stripe button when status is Sent or Overdue with emerald green styling
77. Pay with Stripe button creates Stripe Checkout Session successfully with loading spinner
78. Stripe Checkout Session redirects to Stripe-hosted payment page
79. Stripe checkout page displays invoice details and secure payment form
80. Stripe checkout page shows test mode indicator
81. Successful payment redirects to Checkout Success Page
82. Checkout Success Page displays payment confirmation and details with confetti animation
83. Successful payment triggers webhook event to application
84. Webhook handler validates Stripe signature correctly
85. Webhook handler updates invoice status to Paid
86. Webhook handler updates payment status to Paid
87. Webhook handler creates payment record in database with all required fields
88. Payment record includes transaction ID, amount, timestamp, and references
89. Cancelled payment redirects to Checkout Cancel Page
90. Checkout Cancel Page displays cancellation message and retry option
91. Invoice status remains unchanged after payment cancellation
92. Dashboard cashflow chart includes Stripe payment data with gradient fills
93. Dashboard statistics cards display total Stripe revenue with animated counters
94. Finances page displays payment history with Stripe transactions
95. Payment history shows transaction details including date, amount, and client
96. All modals include success animations on save (checkmark or confetti)
97. All forms include validation with inline error messages and shake animations
98. All delete actions require confirmation dialog
99. Finances page displays cashflow chart and simulator with functional sliders and real-time updates
100. Cashflow simulator updates chart in real-time as sliders are adjusted with smooth transitions
101. Automations page displays list of automations with working toggle switches
102. Settings page allows editing of business profile and user account information
103. Settings page displays Stripe configuration section with connection status
104. Settings page shows Stripe connection status and test mode indicator
105. Settings page includes email configuration section
106. Settings page includes Google Calendar connection toggle
107. Client portal view displays branded interface with client-specific information
108. Client portal dashboard shows overview cards with statistics
109. Client portal projects view lists all client projects with status badges
110. Client portal proposals view lists all proposals with accept/reject actions
111. Client portal invoices view lists all invoices with Pay with Stripe buttons
112. Client portal payment page displays secure Stripe payment form
113. Client portal has separate authentication from main app
114. Client portal is fully responsive on mobile devices
115. Authentication system supports both demo login and email signup
116. All pages are fully responsive on desktop and mobile devices
117. Application uses specified color scheme: #0A1428, #10B981, #F59E0B
118. Dark mode is applied by default across entire application
119. All interactions include smooth micro-animations and loading states
120. Page transitions use fade and slide animations
121. Hover effects include scale and glow transformations
122. Loading states use skeleton screens and progress indicators
123. Success actions trigger confetti or checkmark animations
124. Demo data is populated for a freelance graphic designer with realistic information
125. Application functions as a Progressive Web App with offline capability indicators
126. PWA install prompt is displayed on first visit or after key interaction
127. Service worker caches critical assets for offline access
128. Offline mode displays cached data with stale indicator
129. Background sync queues actions when offline
130. Push notifications work for important events (new proposals, overdue invoices)
131. Real-time subscriptions work correctly for all CRUD operations
132. Supabase connection errors display appropriate error messages
133. Optimistic UI updates provide immediate feedback before server confirmation
134. Stripe API errors display user-friendly error messages
135. Webhook endpoint is production-ready with proper error handling
136. Duplicate webhook events are detected and ignored
137. All Stripe operations use test mode API keys
138. Payment processing is secure and follows Stripe best practices
139. Email service integration is configured and functional
140. Email templates render correctly with dark theme and branding
141. Email delivery failures trigger retry mechanism
142. Email sending status is tracked and displayed to user
143. Application feels polished and premium with consistent design language
144. All animations are smooth and performant (60fps)
145. Application is ready for hackathon demo with complete payment and email flow
146. Application demonstrates $10k-winning quality with attention to detail and user experience

## 7. Out of Scope for Current Release

- Multi-user team collaboration features
- Advanced reporting and analytics beyond basic dashboards
- Third-party integrations with external tools (accounting software, CRM systems) beyond Google Calendar
- Mobile native applications for iOS and Android
- Multi-language support
- Custom domain for client portals
- Advanced automation workflows with conditional logic branches
- Time tracking functionality
- Expense receipt scanning and OCR
- Tax calculation and filing assistance
- Video conferencing integration
- Contract e-signature functionality
- Email marketing campaigns
- Social media management tools
- White-label reselling capabilities
- Bulk import/export of clients, projects, proposals, or invoices
- Advanced permission and role management
- Audit logs and activity history
- Custom fields for clients, projects, proposals, or invoices
- Multi-currency support
- Stripe production mode deployment
- Stripe subscription management UI for clients
- Refund processing interface
- Dispute handling workflow
- Advanced Stripe features (coupons, discounts, trials)
- Stripe Connect for marketplace functionality
- Payment method management for saved cards
- Automatic invoice generation from subscriptions
- Dunning management for failed payments
- Revenue recognition and accrual accounting
- Email bounce handling and suppression lists
- Email open and click tracking
- A/B testing for email templates
- SMS notifications
- Calendar sync with other providers (Outlook, Apple Calendar)
- Recurring calendar events
- Calendar sharing with team members
- Meeting scheduling links (Calendly-style)
- Video call integration in calendar events
- AI Co-pilot voice output (text-to-speech)
- AI Co-pilot learning from user feedback
- AI Co-pilot custom training on user data
- AI Co-pilot integration with external AI models
- Advanced AI Co-pilot analytics and insights
- Client portal customization by clients
- Client portal white-labeling
- Client portal mobile app