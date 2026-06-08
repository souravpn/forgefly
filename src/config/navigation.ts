export const NAV_ITEMS = [
  { id: 'overview',    label: 'Overview',    icon: 'layout-dashboard', route: '/dashboard' },
  { id: 'services',    label: 'Services',    icon: 'package',          route: '/dashboard/services' },
  { id: 'pipeline',    label: 'Pipeline',    icon: 'chart-arrows',     route: '/dashboard/pipeline' },
  { id: 'invoices',    label: 'Invoices',    icon: 'receipt',          route: '/dashboard/invoices' },
  { id: 'clients',     label: 'Clients',     icon: 'users',            route: '/dashboard/clients' },
  { id: 'proposals',   label: 'Proposals',   icon: 'file-text',        route: '/dashboard/proposals' },
  { id: 'brandkit',    label: 'Brand Kit',   icon: 'palette',          route: '/dashboard/brand' },
] as const

export const MORE_ITEMS = [
  { id: 'calendar',    label: 'Calendar',    icon: 'calendar',         route: '/dashboard/calendar' },
  { id: 'automations', label: 'Automations', icon: 'bolt',             route: '/dashboard/automations' },
  { id: 'settings',    label: 'Settings',    icon: 'settings',         route: '/dashboard/settings' },
] as const

export type NavItem = (typeof NAV_ITEMS)[number]
export type MoreItem = (typeof MORE_ITEMS)[number]
export type AnyNavItem = NavItem | MoreItem
