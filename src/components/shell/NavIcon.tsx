import {
  LayoutDashboard,
  Package,
  TrendingUp,
  Receipt,
  Users,
  FileText,
  Palette,
  Calendar,
  Zap,
  Settings,
  Sparkles,
  Inbox,
  MessageSquare,
  Landmark,
  type LucideIcon,
} from 'lucide-react'

const ICON_MAP: Record<string, LucideIcon> = {
  'layout-dashboard': LayoutDashboard,
  'package': Package,
  'chart-arrows': TrendingUp,
  'receipt': Receipt,
  'users': Users,
  'file-text': FileText,
  'palette': Palette,
  'calendar': Calendar,
  'bolt': Zap,
  'settings': Settings,
  'sparkles': Sparkles,
  'inbox': Inbox,
  'message-square': MessageSquare,
  'landmark': Landmark,
}

export function NavIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICON_MAP[name] ?? Settings
  return <Icon className={className} />
}
