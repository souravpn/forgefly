-- Note the /dashboard/requests redirect on the existing Proposals section —
-- there's no standalone Requests page anymore, it's a filtered view of
-- Proposals now.
update documentation_sections
  set body = body || $extra$

#### Proposal requests
If a client submits a request through your portal, it shows up here too — filter by origin **Requested** to find them. There's no separate Requests page anymore; requests and proposals live in one place.
$extra$
  where slug = 'proposals';

insert into documentation_sections (category, category_label, category_order, slug, title, sort_order, body) values

('tools', 'Tools', 6, 'calendar', 'Calendar', 0, $body$
Calendar shows what's actually on your plate — add your own events (meetings, tasks, deadlines) with **+**, and Forgefly folds in two more automatically: every project's deadline and every unpaid invoice's due date show up alongside your own entries, colored red once they're overdue.

#### A quick note
Those auto-added deadline and invoice entries are read-only here — you can't edit or delete them from Calendar itself, only from the project or invoice they came from. Clicking one just tells you where to go to make the change.

#### What's not here
Calendar doesn't currently show proposal expirations, even though those do show up in your Dashboard's Upcoming list — if you're tracking a proposal deadline, check the Dashboard or Proposals directly.
$body$),

('tools', 'Tools', 6, 'visibility', 'Visibility', 1, $body$
Visibility builds you a channel playbook — not a generic "grow your audience" checklist, but copy-paste-ready content tailored to how your specific type of business actually gets found.

#### Getting started
Pick (or confirm) a persona for your business the first time you visit — choose a preset, or describe it yourself and Forgefly figures out the closest fit. That decides which channels show up and in what order.

#### Building your kit
Hit **Build my kit** and Forgefly generates real copy for each channel — a LinkedIn headline and post templates, an Instagram bio, Google Business copy, and more — each with its own **Copy** button and a note on exactly where in that platform to paste it. **Regenerate** any time, or **Switch your playbook** if your persona doesn't feel right anymore.

#### Why you might land here first
If you sign up straight from a generated business preview, Forgefly takes you here first rather than the Dashboard — deciding where you'll actually be found is the natural first move.
$body$),

('tools', 'Tools', 6, 'automations', 'Automations', 2, $body$
Automations run quiet background checks and surface anything worth your attention as an in-app alert — nothing here is ever sent to a client, it's for you only.

#### What you can toggle
Four checks are switchable from this page: an overdue-invoice reminder, a stale-pipeline alert when a lead's gone quiet, a nudge if a proposal has sat in draft too long, and an alert for a new proposal request that hasn't been actioned. Hit **Run check now** to check immediately instead of waiting for the daily pass.

#### What runs whether you toggle it or not
A few other checks run in the background regardless of anything on this page — quarterly estimated-tax reminders, an end-of-project insight comparing your rate to recent projects, and a heads-up when a contractor payment crosses the IRS 1099 threshold. There's no toggle for these yet; they're always on.
$body$),

('tools', 'Tools', 6, 'brand-kit', 'Brand Kit', 3, $body$
Brand Kit holds your visual identity — colors, fonts, tone, keywords, your icon and cover image — everything that makes your public pages and generated content look like *your* business.

#### Not your portfolio
Work samples and your public URL editor live on the separate **Portfolio** page, not here — Brand Kit is identity only. Both ultimately feed the same public page, but they're edited in different places.

#### Sharing your link
Copy your public link from the QR code section at the bottom of this page — that's specifically what marks "Share your portfolio" done on your Getting Started checklist. Copying the same link from the Portfolio page's own share button doesn't trigger that checkmark, only Brand Kit's does.
$body$),

('tools', 'Tools', 6, 'outreach-kit', 'Outreach Kit', 4, $body$
Outreach Kit researches a prospect and drafts everything you'd need to reach out cold — a connection note, a LinkedIn DM, a cold email, and a follow-up, each ready to copy and send yourself. Forgefly doesn't send these for you.

#### Researching one company
Use **Research a Company** to look up a single target by name — Forgefly researches them and builds your outreach copy in a few steps.

#### Finding targets to research
**Research Outreach** starts from a brainstormed list of the kinds of companies that might be a fit for you — it's a starting point to research from, not a verified list of real leads.

#### Turning a target into a lead
**Add to pipeline** turns a researched company into a real card on your Leads board, landing in Prospect — from there it's tracked the same as any other lead.
$body$),

('account', 'Account', 7, 'settings', 'Settings', 0, $body$
Settings has five tabs: **Business Profile**, **Account**, **Payments**, **Finances**, and **AI History**.

#### Your plan
Upgrade or manage your subscription from **Account** — it shows your current tier, status, and next billing date.

#### WhatsApp needs your phone number first
Set your contact phone under **Business Profile**. WhatsApp connect is blocked without it — worth knowing since the field itself is labeled optional; fill it in ahead of time if you're planning to connect WhatsApp.

#### Deleting your account
Also under **Account** — request a confirmation code (sent to your email only, not SMS), enter it, and your account is deleted immediately. This can't be undone.
$body$);
