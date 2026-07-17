create table documentation_sections (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  category_label text not null,
  category_order int not null default 0,
  slug text not null unique,
  title text not null,
  body text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table documentation_sections enable row level security;

create policy "Public read" on documentation_sections
  for select using (true);

insert into documentation_sections (category, category_label, category_order, slug, title, sort_order, body) values

('getting-started', 'Getting Started', 0, 'generate-your-business', 'Generate your Business OS', 0, $body$
Describe your business in one prompt on the Forgefly landing page — no account needed yet. The AI reads what you wrote and builds a working preview: services with pricing, a brand identity, a sample pipeline, and a portfolio layout, all before you sign up.

#### What happens if you sign up
Signing in (Google) turns the preview into your real, saved business — the exact same data, now backed by your account. Nothing is regenerated; what you saw in the preview is what you get.

#### If you don't sign up
The preview lives in your browser for 24 hours. Come back and sign in within that window and it'll still be there waiting to be saved; after that it expires and you'd need to generate again.
$body$),

('getting-started', 'Getting Started', 0, 'getting-started-checklist', 'The Getting Started checklist', 1, $body$
A small checklist appears near the top of your Dashboard for the first few days after signup, tracking five things:

- Review your services
- Add your first prospect
- Send your first proposal
- Share your portfolio
- Connect a social account

Each item checks itself off automatically the moment you actually do that thing anywhere in Forgefly — there's no separate form to fill out inside the checklist itself, it's just tracking real progress. Click **Go** on any open item to jump straight to the right page.

#### Dismissing it
The **×** collapses the checklist into a small progress pill you can reopen any time. Once all five are done, it disappears on its own — no need to dismiss it.
$body$),

('freeda', 'Freeda (AI Copilot)', 1, 'freeda', 'Talking to Freeda', 0, $body$
Freeda is the AI panel on the right side of every page — open it with **Ask Freeda** in the sidebar. It's one place to type anything: an update to your business, a question about your numbers, or a request to message a client. Freeda figures out which of those you meant and responds accordingly.

#### Updating your business
Tell Freeda something changed — a new price, a new service, a client's new phone number — and it shows you a diff card of exactly what it's about to change. Nothing is saved until you click **Apply**; click **Dismiss** and nothing happens.

#### Asking questions
Ask about your numbers — revenue this month, how many leads you have, which proposal is still unopened — and Freeda answers with the same live data your Dashboard shows, so the number it gives you can never be different from what's on screen. Questions outside that (pricing research, drafting a message, general how-to) get a regular grounded answer instead.

#### Messaging clients
Ask Freeda to message a client — a reminder, a follow-up, anything — and it drafts the message and shows you exactly who it would go to before anything sends. You can edit the draft, and if you named clients ambiguously ("my overdue clients") you'll get a checklist to confirm exactly who's included. Nothing sends until you click **Send to N clients**.

#### What Freeda won't do
Freeda won't delete a client, service, or other record — it'll tell you that plainly and point you to the right page instead of pretending it can. And it only ever shows you Forgefly's own numbers; it doesn't have a way to reach outside your business data.
$body$),

('social-promotions', 'Social & Promotions', 2, 'instagram', 'Connecting Instagram', 0, $body$
Connect your Instagram business account under **Social → Connections**. Forgefly authorizes through Instagram Login (Meta), one connection per business — you don't need a developer account or app of your own.

#### Posting
Drafts are generated (or written from scratch) under the **Compose** tab. Every post needs an attached image before it can be approved — Instagram requires media on every post, text-only posts aren't supported. Once approved, hit Publish to push it live to your connected account.

#### Disconnecting
Disconnecting revokes Forgefly's access but doesn't delete anything already published to Instagram. Reconnect any time from the same Connections screen.
$body$),

('social-promotions', 'Social & Promotions', 2, 'whatsapp', 'Connecting WhatsApp', 1, $body$
Connect a WhatsApp Business number under **Social → Connections**. This uses Facebook Login (Meta) — the number you connect is what your clients will message, and what your own lifecycle notifications get sent from.

#### Reading (inbound messages)
Messages a client sends to your connected number land automatically in your **Messages** hub, matched to the client by phone number when possible. If the number doesn't match an existing contact, it shows up as an "Unknown number" thread — use Save as client to link it. Every WhatsApp-originated message is tagged *via WhatsApp* so it's clear which channel it came in on, alongside portal chat in the same thread.

#### Sending
Forgefly sends WhatsApp notifications automatically for three events: a proposal gets approved, an invoice gets paid, and a file gets shared on the client portal — both you and the client receive a message. If the client hasn't messaged you in the last 24 hours, the reply falls outside WhatsApp's free-form session window and goes out as a pre-approved template message instead of plain text; that's expected, not an error.

#### Your own notifications
Set a contact phone number under **Settings → Business** first — that's where your own copies of the notifications above are sent. WhatsApp connect is blocked until that's filled in.
$body$),

('social-promotions', 'Social & Promotions', 2, 'facebook', 'Connecting Facebook', 2, $body$
Connect your Facebook Page under **Social → Connections** — it uses the same Meta login as Instagram and WhatsApp, so if you've already connected either of those, Facebook is just one more permission grant, not a new setup.

#### If you manage more than one Page
If your Facebook account has multiple Pages, you'll see a one-time picker to choose which one Forgefly connects to. That choice is remembered — you won't be asked again on future posts, only if you disconnect and reconnect.

#### Posting
Facebook photo posts publish in a single step once approved. Reels are supported too and publish as a separate post from the photo — when both are ready, Forgefly publishes the photo first, then the Reel, and if one fails the other still goes through; they don't block each other.
$body$),

('social-promotions', 'Social & Promotions', 2, 'ai-promotions', 'AI-drafted promotions', 3, $body$
Under **Social → Promotions**, Forgefly can generate a ready-to-post photo, caption, and short Reel for your business — start from the **Create** tab, or let a **Featured** promotion generate automatically.

#### Reviewing before it posts
Nothing publishes on its own. Generated promotions land on the **Draft** tab, where each card has three actions: **Edit** the caption and choose which platforms it should go to, **Delete** it, or **Send** to open the publish flow. Publishing walks through each connected platform you selected, posting the photo and then the Reel (if one was generated) for each — one platform failing doesn't stop the others.

#### Reels
Reels are generated automatically alongside the photo for AI-image promotions — a short pan-and-zoom video of the image, not a separate thing you have to ask for. If a promotion doesn't have a Reel, it simply wasn't generated for that one; that's not an error to troubleshoot.
$body$),

('client-portal', 'Client Portal', 3, 'client-portal', 'What your clients see', 0, $body$
Every client gets a private portal link — you don't create it separately, it's generated automatically the first time you send them a proposal or an invoice, and emailed to them directly.

#### What's in it
The portal has tabs for **Proposals**, **Invoices**, **Projects**, **Messages**, and **Files**. Clients can review and approve a proposal with a single click (no signature required), pay an invoice directly through Stripe, see read-only project status, message you directly, and upload files for you to see.

#### What happens when a client approves a proposal
The moment they open it, it's marked "viewed" automatically — you don't have to do anything for that to track. Approving moves it to "Accepted," advances the matching lead to "Negotiating" in your pipeline, and notifies you by WhatsApp (if you have a number on file) and email — no need to keep refreshing to check.

#### Files
If you share a file with a client from their profile or a message thread, Forgefly notifies them their portal has something new. If a client uploads a file to you, it appears on your side — but note that direction doesn't currently trigger a notification back to you, so it's worth checking the Files tab yourself if you're expecting something from them.
$body$),

('proposals', 'Proposals', 4, 'proposals', 'Creating and sending proposals', 0, $body$
Build a proposal from scratch, or ask Freeda / use **Draft with AI** to generate one from a client's info and your services — both land as a normal editable draft, there's no difference in what you can do with it afterward.

#### Sending
Sending emails the client a portal link to review it — there's no separate WhatsApp send for the proposal itself; WhatsApp only comes in later as a notification once they respond. You can resend a proposal that's already gone out (it'll show as "Resend") without resetting anything about its status.

#### Status tracking
A sent proposal moves through **Sent → Viewed → Accepted/Declined** automatically — "Viewed" flips the moment the client opens it in their portal, not something you set. Declining a proposal moves the matching lead to "Lost" in your pipeline; accepting moves it to "Negotiating."

#### A quick note on edits
You can still make changes to a proposal after it's sent — sending again just re-shares the same (possibly updated) proposal without losing its history.
$body$);
