import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { useBusiness } from '@/contexts/CurrentBusinessContext';
import { supabase } from '@/db/supabase';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Review {
  id: string;
  client_name: string;
  rating: number;
  comment: string | null;
  freelancer_reply: string | null;
  replied_at: string | null;
  submitted_at: string;
  portal_eligible: boolean;
  ai_selected: boolean;
}

type StarFilter = 0 | 1 | 2 | 3 | 4 | 5; // 0 = All

// ── Helpers ───────────────────────────────────────────────────────────────────

function StarRow({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const px = size === 'md' ? 'w-5 h-5' : 'w-4 h-4';
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          className={px}
          viewBox="0 0 20 20"
          fill={i <= rating ? '#F59E0B' : 'none'}
          stroke={i <= rating ? '#F59E0B' : '#d1d5db'}
          strokeWidth="1"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ── Review card ───────────────────────────────────────────────────────────────

function ReviewCard({
  review,
  onReplyPosted,
}: {
  review: Review;
  onReplyPosted: (id: string, reply: string) => void;
}) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState(review.freelancer_reply ?? '');
  const [saving, setSaving] = useState(false);

  const hasReply = !!review.freelancer_reply;
  const isOnPortal = review.ai_selected && review.portal_eligible;
  const isNotPublic = !review.portal_eligible; // rating < 3

  async function postReply() {
    if (!replyText.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from('reviews')
      .update({
        freelancer_reply: replyText.trim(),
        replied_at: new Date().toISOString(),
      })
      .eq('id', review.id);

    if (error) {
      toast.error('Failed to save reply');
    } else {
      onReplyPosted(review.id, replyText.trim());
      setReplyOpen(false);
      toast.success('Reply posted');
    }
    setSaving(false);
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5 space-y-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <StarRow rating={review.rating} />
              <span className="text-sm font-medium">{review.client_name}</span>
              <span className="text-xs text-muted-foreground">
                {formatDate(review.submitted_at)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {isOnPortal && (
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 bg-emerald-50 text-emerald-700 border border-emerald-200"
                >
                  ✓ On portal
                </Badge>
              )}
              {isNotPublic && (
                <span className="text-[11px] text-muted-foreground">
                  Not public · rating below threshold
                </span>
              )}
              {!isOnPortal && !isNotPublic && (
                <span className="text-[11px] text-muted-foreground">
                  Eligible · not selected
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Comment */}
        {review.comment && (
          <p className="text-sm text-foreground leading-relaxed">
            "{review.comment}"
          </p>
        )}

        {/* Existing reply */}
        {hasReply && !replyOpen && (
          <div className="border-t pt-3 space-y-1">
            <p className="text-xs text-muted-foreground">
              ↳ Your reply · {review.replied_at ? formatDate(review.replied_at) : ''}
            </p>
            <p className="text-sm text-muted-foreground">"{review.freelancer_reply}"</p>
            <button
              type="button"
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
              onClick={() => {
                setReplyText(review.freelancer_reply ?? '');
                setReplyOpen(true);
              }}
            >
              Edit reply
            </button>
          </div>
        )}

        {/* Reply inline editor */}
        {replyOpen ? (
          <div className="border-t pt-3 space-y-2">
            <Textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write a genuine reply in your own voice…"
              rows={3}
              className="resize-none text-sm"
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={postReply}
                disabled={saving || !replyText.trim()}
                className="h-7 text-xs"
              >
                {saving ? 'Saving…' : 'Post reply'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => {
                  setReplyOpen(false);
                  setReplyText(review.freelancer_reply ?? '');
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          !hasReply && review.comment && (
            <button
              type="button"
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
              onClick={() => setReplyOpen(true)}
            >
              Reply →
            </button>
          )
        )}
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReviewsPage() {
  const { business, extractedData } = useBusiness();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StarFilter>(0);

  // AI quarterly insight from extracted_data
  const reviewInsight = (
    extractedData as {
      review_insight?: {
        strengths?: string[];
        friction?: string | null;
        suggestion?: string;
        generated_at?: string;
      };
    }
  )?.review_insight;

  useEffect(() => {
    if (!business) return;
    supabase
      .from('reviews')
      .select(
        'id, client_name, rating, comment, freelancer_reply, replied_at, submitted_at, portal_eligible, ai_selected',
      )
      .eq('business_id', business.id)
      .order('submitted_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error('Failed to load reviews');
        else setReviews((data ?? []) as Review[]);
        setLoading(false);
      });
  }, [business?.id]);

  function handleReplyPosted(id: string, reply: string) {
    setReviews((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, freelancer_reply: reply, replied_at: new Date().toISOString() }
          : r,
      ),
    );
  }

  const filtered =
    filter === 0 ? reviews : reviews.filter((r) => r.rating === filter);

  const counts = {
    total: reviews.length,
    avg:
      reviews.length > 0
        ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
        : null,
    onPortal: reviews.filter((r) => r.ai_selected && r.portal_eligible).length,
  };

  const FILTER_OPTIONS: { label: string; value: StarFilter }[] = [
    { label: 'All', value: 0 },
    { label: '5★', value: 5 },
    { label: '4★', value: 4 },
    { label: '3★', value: 3 },
    { label: '2★', value: 2 },
    { label: '1★', value: 1 },
  ];

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-balance mb-1">Reviews</h1>
        <p className="text-sm md:text-base text-muted-foreground">
          All client reviews — including private ones below 3 stars
        </p>
      </div>

      {/* Summary strip */}
      {!loading && counts.total > 0 && (
        <div className="flex items-center gap-6 text-sm">
          <div>
            <span className="text-2xl font-bold">{counts.avg ?? '—'}</span>
            <span className="text-muted-foreground ml-1">avg rating</span>
          </div>
          <div className="w-px h-8 bg-border" />
          <div>
            <span className="font-semibold">{counts.total}</span>
            <span className="text-muted-foreground ml-1">
              review{counts.total !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="w-px h-8 bg-border" />
          <div>
            <span className="font-semibold">{counts.onPortal}</span>
            <span className="text-muted-foreground ml-1">on portal</span>
          </div>
        </div>
      )}

      {/* AI quarterly insight card */}
      {reviewInsight && (
        <Card className="border-l-4 border-l-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
                AI Review Insight
              </p>
              {reviewInsight.generated_at && (
                <p className="text-xs text-muted-foreground">
                  {formatDate(reviewInsight.generated_at)}
                </p>
              )}
            </div>
            {reviewInsight.strengths && reviewInsight.strengths.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Strengths</p>
                <div className="flex flex-wrap gap-1.5">
                  {reviewInsight.strengths.map((s) => (
                    <span
                      key={s}
                      className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {reviewInsight.friction && (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Area to watch: </span>
                {reviewInsight.friction}
              </p>
            )}
            {reviewInsight.suggestion && (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Suggestion: </span>
                {reviewInsight.suggestion}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Filter chips */}
      {!loading && counts.total > 0 && (
        <div className="flex gap-2 flex-wrap">
          {FILTER_OPTIONS.map((opt) => {
            const count =
              opt.value === 0
                ? reviews.length
                : reviews.filter((r) => r.rating === opt.value).length;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFilter(opt.value)}
                className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                  filter === opt.value
                    ? 'bg-foreground text-background border-foreground'
                    : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/40'
                }`}
              >
                {opt.label}
                {count > 0 && (
                  <span className="ml-1.5 text-xs opacity-60">{count}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Review list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-xl border bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground text-sm">
          {reviews.length === 0
            ? "No reviews yet. They'll appear here once clients submit them via the review link."
            : 'No reviews matching this filter.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              onReplyPosted={handleReplyPosted}
            />
          ))}
        </div>
      )}
    </div>
  );
}
