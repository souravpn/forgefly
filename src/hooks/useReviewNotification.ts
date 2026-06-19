import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/db/supabase';
import { useBusiness } from '@/contexts/CurrentBusinessContext';

export function useReviewNotification() {
  const { business } = useBusiness();
  const navigate = useNavigate();

  useEffect(() => {
    if (!business?.id) return;

    const channel = supabase
      .channel(`reviews:business:${business.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'reviews',
          filter: `business_id=eq.${business.id}`,
        },
        (payload) => {
          const row = payload.new as {
            client_name?: string;
            rating?: number;
          };
          const stars = '★'.repeat(row.rating ?? 5) + '☆'.repeat(5 - (row.rating ?? 5));
          toast.success(`New review from ${row.client_name ?? 'a client'}`, {
            description: stars,
            action: {
              label: 'View',
              onClick: () => navigate('/dashboard/reviews'),
            },
            duration: 8000,
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [business?.id, navigate]);
}
