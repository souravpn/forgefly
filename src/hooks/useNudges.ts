import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/db/supabase'
import { useAuth } from '@/contexts/AuthContext'

export interface Nudge {
  id: string
  user_id: string
  business_id: string | null
  type: string
  title: string
  body: string
  action_url: string | null
  read: boolean
  created_at: string
}

export interface UseNudgesResult {
  nudges: Nudge[]
  unreadCount: number
  isLoading: boolean
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
  refetch: () => void
}

export function useNudges(): UseNudgesResult {
  const { user } = useAuth()
  const [nudges, setNudges] = useState<Nudge[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetch = useCallback(async () => {
    if (!user) return
    setIsLoading(true)
    const { data } = await supabase
      .from('nudges')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    setNudges(data ?? [])
    setIsLoading(false)
  }, [user])

  useEffect(() => {
    fetch()
  }, [fetch])

  const markRead = useCallback(async (id: string) => {
    await supabase.from('nudges').update({ read: true }).eq('id', id)
    setNudges(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }, [])

  const markAllRead = useCallback(async () => {
    if (!user) return
    await supabase.from('nudges').update({ read: true }).eq('user_id', user.id).eq('read', false)
    setNudges(prev => prev.map(n => ({ ...n, read: true })))
  }, [user])

  return {
    nudges,
    unreadCount: nudges.filter(n => !n.read).length,
    isLoading,
    markRead,
    markAllRead,
    refetch: fetch,
  }
}
