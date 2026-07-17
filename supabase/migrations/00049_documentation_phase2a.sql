-- Fold the standalone "Proposals" category into "Project", alongside Leads,
-- Services, Finances, and Project — matching the app's real sidebar grouping
-- (see src/components/shell/CLAUDE.md). Re-sequence category_order for the
-- categories that shift as a result.

update documentation_sections set category = 'project', category_label = 'Project', category_order = 2, sort_order = 2
  where slug = 'proposals';

update documentation_sections set category_order = 4 where category = 'client-portal';
update documentation_sections set category_order = 5 where category = 'social-promotions';

insert into documentation_sections (category, category_label, category_order, slug, title, sort_order, body) values

('project', 'Project', 2, 'leads', 'Tracking leads', 0, $body$
Every prospect lives on a kanban board under **Leads** — drag a card between columns as a deal moves: **Prospect → Qualified → Contacted → Proposal Sent → Negotiating → Closed Won**, with a separate **Lost** column for anything that didn't work out.

#### Adding a lead
Click **+** on any column to add one — pick an existing client or create a new one inline, right at whatever stage makes sense. A lead also appears here automatically if someone submits a proposal request through your portal; it lands in **Prospect**.

#### What moves automatically
Almost nothing does — stage changes are yours to make by dragging or editing a card. The one exception: when a client approves a proposal from their portal, that lead jumps straight to **Negotiating** on its own. Sending a proposal does **not** move the card to "Proposal Sent" by itself — you still drag it there if you want the board to reflect it.
$body$),

('project', 'Project', 2, 'services', 'Managing your services', 1, $body$
Your services and pricing live under **Services** — each one has a name, a price (however you want to write it — "$1,200" or "$150/hr" both work), a type (project, retainer, or hourly), a description, and a list of deliverables.

#### Where they come from
The AI fills this in once, from what you described when you generated your business. After that, it's yours to edit — add, remove, or change anything from the same page; nothing regenerates automatically.

#### A quick note
The "services reviewed" step on your Getting Started checklist checks itself off just from spending a few seconds on this page — you don't need to click anything specific, just look it over.
$body$),

('project', 'Project', 2, 'finances', 'Finances', 3, $body$
Everything money-related lives under **Finances**, split into seven tabs: **Overview, Income, Invoices, Expenses, Time, Tax, and Export**.

#### Invoices
Send an invoice and your client pays it directly through a secure Stripe checkout — nothing to set up on their end.

#### Expenses
Log an expense manually, or hit **Scan receipt** to let AI read a photo of one and fill in the vendor, amount, and category for you. Mileage and contractor payments have their own sections here too — mileage auto-calculates the deduction from IRS rates, and contractor payments track who you've paid and whether you have a W-9 on file for them.

#### Time
This tab shows time synced in from Toggl, not a built-in stopwatch — connect your Toggl account here to bring entries in. For logging hours directly against a specific project without Toggl, use **Log Time** on the project itself, under **Projects**.

#### Tax
A running estimate of what you can deduct — expenses, mileage, a home-office allowance, and meals (capped at the usual 50%) — kept up to date as you log things elsewhere in Finances.

#### Export
Download your income, expenses, and mileage as CSVs, or have Forgefly email them to you directly.
$body$),

('project', 'Project', 2, 'projects', 'Running projects', 4, $body$
Once you're actually doing the work, track it under **Projects** — status moves through **Lead → In Progress → Review → Completed**, with **Archived** for anything you want out of the active list without deleting it.

#### Creating one
Projects are created by hand, not automatically when a proposal is accepted — once you've won the work, add a project for it yourself so it shows up here.

#### Logging time
Each project card has a **Log Time** button — it's a manual entry (date, hours, a note), not a running clock. If you'd rather track time as you work, connect Toggl instead and it'll show up under Finances → Time.
$body$),

('clientele', 'Clientele', 3, 'clients', 'Managing clients', 0, $body$
Your client list lives under **Clients**, with a status badge on each one (from a prospect just coming in, through active work, to repeat business).

#### Adding a client
Add one manually any time, or Forgefly creates one automatically the moment someone submits a proposal request — either way, they show up in the same list.

#### Sharing files
Open a client's **Files** to share something with them directly — they're notified the moment it's up. This only works once they have a portal set up; if you see "No portal contact found," generate a portal link for them first (sending any proposal or invoice does this automatically).
$body$),

('clientele', 'Clientele', 3, 'messages', 'Messages', 1, $body$
**Messages** is one unified inbox — portal chat and WhatsApp both land here, with WhatsApp messages tagged so you know which channel a reply came in on.

#### Numbers that aren't matched to a client yet
A WhatsApp number that doesn't match an existing client shows up as its own "Unknown number" thread. Click **Save this Lead as Client** to link it — you'll be taken to Leads with the number pre-filled. You can't reply until that's done.

#### What you can't do here
There's no compose button — Messages only shows threads that already have at least one message in them. To start a conversation with someone new, reach out via WhatsApp or their portal directly rather than looking for a "new message" option here.
$body$),

('clientele', 'Clientele', 3, 'reviews', 'Reviews', 2, $body$
**Reviews** shows every review you've collected, including private, lower-rated ones — nothing is hidden from you. Reply to any of them directly from this page.

#### Requesting reviews
You don't send these yourself — Forgefly automatically asks a client for a review 7 days after their invoice is marked paid. There's no manual "send request" button; it's entirely on that schedule.

#### What shows up on your public portfolio
Which reviews appear publicly is decided automatically too, based on rating and an AI pass that picks a good mix of testimonials — there's no toggle here to hand-pick which ones go public. If you want a specific review featured, replying to it doesn't change whether it's shown, only what your reply says.
$body$);
