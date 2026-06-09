import { createContext, useContext, type ReactNode } from 'react'
import { useCurrentBusiness, type UseCurrentBusinessResult } from '@/hooks/useCurrentBusiness'

const CurrentBusinessContext = createContext<UseCurrentBusinessResult | null>(null)

export function CurrentBusinessProvider({ children }: { children: ReactNode }) {
  const value = useCurrentBusiness()
  return (
    <CurrentBusinessContext.Provider value={value}>
      {children}
    </CurrentBusinessContext.Provider>
  )
}

export function useBusiness(): UseCurrentBusinessResult {
  const ctx = useContext(CurrentBusinessContext)
  if (!ctx) throw new Error('useBusiness must be used inside CurrentBusinessProvider')
  return ctx
}
