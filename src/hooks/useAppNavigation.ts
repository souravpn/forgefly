import { useNavigate, useLocation } from 'react-router-dom'
import { NAV_ITEMS, MORE_ITEMS } from '@/config/navigation'

const ALL_ITEMS = [...NAV_ITEMS, ...MORE_ITEMS]

export function useAppNavigation() {
  const navigate = useNavigate()
  const location = useLocation()

  return {
    navigateTo: (route: string) => navigate(route),
    currentRoute: location.pathname,
    isActive: (route: string) => {
      // Exact match for root dashboard to avoid it matching everything
      if (route === '/dashboard') return location.pathname === '/dashboard'
      return location.pathname.startsWith(route)
    },
    activeNavId: ALL_ITEMS.find(item => {
      if (item.route === '/dashboard') return location.pathname === '/dashboard'
      return location.pathname.startsWith(item.route)
    })?.id ?? null,
  }
}
