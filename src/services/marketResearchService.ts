import { supabase } from '@/db/supabase';
import type { MarketResearch, MarketResearchItem, MarketResearchItemStatus } from '@/types/types';

export async function getMarketResearch(): Promise<MarketResearch | null> {
  const { data, error } = await supabase
    .from('market_research')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getMarketResearchItems(marketResearchId: string): Promise<MarketResearchItem[]> {
  const { data, error } = await supabase
    .from('market_research_items')
    .select('*')
    .eq('market_research_id', marketResearchId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function updateMarketResearchItem(
  id: string,
  updates: Partial<{ status: MarketResearchItemStatus; summary: string }>,
): Promise<void> {
  const { error } = await supabase.from('market_research_items').update(updates).eq('id', id);
  if (error) throw error;
}
