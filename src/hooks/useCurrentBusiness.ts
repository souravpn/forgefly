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
    } else {
      setBusiness(data)
      setError(null)
    }
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
