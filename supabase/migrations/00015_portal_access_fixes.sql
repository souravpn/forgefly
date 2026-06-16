-- Fix 1: Allow public read of active businesses.
-- The portal page and public portfolio both need to read a freelancer's business
-- without the visitor being the owner. Only "active" businesses are exposed.
create policy "Public can read active businesses"
  on businesses for select
  using (status = 'active');

-- Fix 2: Allow authenticated users to read engagement_access rows for their engagement.
-- Needed so ClientPortalPage can check if the logged-in user has portal access.
create policy "Users can read their own engagement access"
  on engagement_access for select
  using (
    client_user_id = auth.uid()
    or client_email = auth.email()
  );
