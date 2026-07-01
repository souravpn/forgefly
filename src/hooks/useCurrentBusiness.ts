import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/db/supabase'
import type { ExtractedData } from '@/pages/GeneratedPortalPage'

export interface OnboardingMilestones {
  business_created: boolean
  services_reviewed: boolean
  portfolio_shared: boolean
  prospect_added: boolean
  proposal_sent: boolean
}

export interface Business {
  id: string
  user_id: string
  name: string
  bio: string | null
  slug: string | null
  contact_email: string | null
  contact_phone: string | null
  logo_url: string | null
  extracted_data: ExtractedData
  seed_prompt: string | null
  confidence_map: Record<string, string> | null
  completeness_score: number | null
  onboarding_seen: boolean | null
  onboarding_milestones: OnboardingMilestones | null
  status: 'active' | 'archived'
  created_at: string
  updated_at: string
}

export interface UseCurrentBusinessResult {
  business: Business | null
  extractedData: ExtractedData | null
  isLoading: boolean
  error: string | null
  refetch: () => void
}

async function ensureSlug(biz: Business): Promise<Business> {
  if (biz.slug) return biz
  const base = biz.name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'business'
  const { data: taken } = await supabase
    .from('businesses').select('id').eq('slug', base).neq('id', biz.id).maybeSingle()
  const slug = taken ? `${base}${Date.now()}` : base
  await supabase.from('businesses').update({ slug }).eq('id', biz.id)
  return { ...biz, slug }
}

export function useCurrentBusiness(): UseCurrentBusinessResult {
  const { user } = useAuth()
  const [business, setBusiness] = useState<Business | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBusiness = useCallback(async () => {
    if (!user) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    const { data, error: err } = await supabase
      .from('businesses')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()

    if (err) {
      setError(err.message)
      setIsLoading(false)
      return
    }

    // If no business found, check if there's a pending portal from a pre-login generation
    if (!data) {
      const raw = localStorage.getItem('pending_portal')
      if (raw) {
        try {
          const { extracted_data, prompt, confidence_map, completeness_score } = JSON.parse(raw)
          const identity = (extracted_data as Record<string, any>)?.identity ?? {}
          const businessName = identity.businessName ?? identity.name ?? 'My Business'

          // Use select-then-insert/update to avoid partial-index upsert issues
          const { data: existing } = await supabase
            .from('businesses')
            .select('id')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .maybeSingle()

          let bizId: string | null = null
          const fullPayload = {
            name: businessName, extracted_data,
            confidence_map: confidence_map ?? null,
            completeness_score: completeness_score ?? 0,
          }
          const basePayload = { name: businessName, extracted_data }

          if (existing?.id) {
            const { error } = await supabase.from('businesses').update(fullPayload).eq('id', existing.id)
            if (error?.code === '42703') {
              await supabase.from('businesses').update(basePayload).eq('id', existing.id)
            }
            bizId = existing.id
          } else {
            let { data: inserted, error } = await supabase
              .from('businesses')
              .insert({ user_id: user.id, status: 'active', ...fullPayload })
              .select('id').single()
            if (error?.code === '42703') {
              const retried = await supabase
                .from('businesses')
                .insert({ user_id: user.id, status: 'active', ...basePayload })
                .select('id').single()
              inserted = retried.data
            }
            bizId = inserted?.id ?? null
          }

          if (bizId && prompt) {
            await supabase.from('prompt_sessions').insert({
              user_id: user.id,
              business_id: bizId,
              prompt,
              prompt_type: 'seed',
              extracted_data_snapshot: extracted_data,
            }).then(() => {}) // non-fatal
          }

          localStorage.removeItem('pending_portal')
          // Refetch to get the full row
          const { data: saved } = await supabase
            .from('businesses')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .maybeSingle()
          setBusiness(saved ? await ensureSlug(saved as Business) : saved)
          setError(null)
          setIsLoading(false)
          return
        } catch (e) {
          console.error('Failed to auto-save pending portal:', e)
        }
      }
    }

    setBusiness(data ? await ensureSlug(data as Business) : data)
    setError(null)
    setIsLoading(false)
  }, [user])

  useEffect(() => {
    fetchBusiness()
  }, [fetchBusiness])

  return {
    business,
    extractedData: business?.extracted_data ?? null,
    isLoading,
    error,
    refetch: fetchBusiness,
  }
}
