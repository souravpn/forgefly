export const NAV_ITEMS = [
  {
    id: "overview",
    label: "Overview",
    icon: "layout-dashboard",
    route: "/dashboard",
  },
  {
    id: "services",
    label: "Services",
    icon: "package",
    route: "/dashboard/services",
  },
  {
    id: "visibility",
    label: "Visibility",
    icon: "sparkles",
    route: "/dashboard/visibility",
  },
  {
    id: "leads",
    label: "Leads",
    icon: "chart-arrows",
    route: "/dashboard/leads",
  },
  {
    id: "finances",
    label: "Finances",
    icon: "landmark",
    route: "/dashboard/finances",
  },
  {
    id: "project",
    label: "Projects",
    icon: "layers",
    route: "/dashboard/projects",
  },
  {
    id: "market-research",
    label: "Market Research",
    icon: "compass",
    route: "/dashboard/market-research",
  },
  {
    id: "clients",
    label: "Clients",
    icon: "users",
    route: "/dashboard/clients",
  },
  {
    id: "proposals",
    label: "Proposals",
    icon: "file-text",
    route: "/dashboard/proposals",
  },
  {
    id: "brandkit",
    label: "Brand Kit",
    icon: "palette",
    route: "/dashboard/brand",
  },
] as const;

export const MORE_ITEMS = [
  {
    id: "reviews",
    label: "Reviews",
    icon: "star",
    route: "/dashboard/reviews",
  },
  {
    id: "messages",
    label: "Messages",
    icon: "message-square",
    route: "/dashboard/messages",
  },
  {
    id: "calendar",
    label: "Calendar",
    icon: "calendar",
    route: "/dashboard/calendar",
  },
  {
    id: "automations",
    label: "Automations",
    icon: "bolt",
    route: "/dashboard/automations",
  },
  {
    id: "outreach",
    label: "Outreach Kit",
    icon: "send",
    route: "/dashboard/outreach",
  },
  { id: "social", label: "Social", icon: "share2", route: "/dashboard/social" },
  {
    id: "settings",
    label: "Settings",
    icon: "settings",
    route: "/dashboard/settings",
  },
] as const;

export type NavItem = (typeof NAV_ITEMS)[number];
export type MoreItem = (typeof MORE_ITEMS)[number];
export type AnyNavItem = NavItem | MoreItem;
