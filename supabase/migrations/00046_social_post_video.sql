-- Migration 00046: Reel video generation on the gpt-image-1 promotion path
-- Shotstack turns the AI-generated promo image into a short Ken Burns pan/zoom
-- video for Instagram Reels. video_status tracks the async render lifecycle
-- (submitted by generate-promotion, polled/resolved by check-video-render).

ALTER TABLE social_posts
  ADD COLUMN IF NOT EXISTS video_url           text,
  ADD COLUMN IF NOT EXISTS video_status        text,          -- null | 'rendering' | 'ready' | 'failed'
  ADD COLUMN IF NOT EXISTS shotstack_render_id text;
