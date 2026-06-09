import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/db/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { ExtractedData } from '@/pages/GeneratedPortalPage'

export interface Business {
  id: string
  user_id: string
  name: string
  extracted_data: ExtractedData
  seed_prompt: string | null
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
      const raw = sessionStorage.getItem('pending_portal')
      if (raw) {
        try {
          const { extracted_data, prompt } = JSON.parse(raw)
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
          if (existing?.id) {
            await supabase.from('businesses').update({ name: businessName, extracted_data }).eq('id', existing.id)
            bizId = existing.id
          } else {
            const { data: inserted } = await supabase
              .from('businesses')
              .insert({ user_id: user.id, name: businessName, extracted_data, status: 'active' })
              .select('id')
              .single()
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

          sessionStorage.removeItem('pending_portal')
          // Refetch to get the full row
          const { data: saved } = await supabase
            .from('businesses')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .maybeSingle()
          setBusiness(saved)
          setError(null)
          setIsLoading(false)
          return
        } catch (e) {
          console.error('Failed to auto-save pending portal:', e)
        }
      }
    }

    setBusiness(data)
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
