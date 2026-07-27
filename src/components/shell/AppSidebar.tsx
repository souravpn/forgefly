import {
  Bell,
  LogOut,
  Settings,
  Sun,
  Moon,
  Globe,
  ExternalLink,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "@/contexts/CurrentBusinessContext";
import { type UseNudgesResult } from "@/hooks/useNudges";
import { useTheme } from "@/contexts/ThemeContext";
import { useAppNavigation } from "@/hooks/useAppNavigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NavIcon } from "./NavIcon";
import { LogTimeWidget } from "@/components/common/LogTimeWidget";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

const MAIN_NAV = [
  {
    id: "overview",
    label: "Overview",
    icon: "layout-dashboard",
    route: "/dashboard",
  },
];

const TOOLS_NAV = [
  {
    id: "calendar",
    label: "Calendar",
    icon: "calendar",
    route: "/dashboard/calendar",
  },
  {
    id: "visibility",
    label: "Visibility",
    icon: "sparkles",
    route: "/dashboard/visibility",
  },
  {
    id: "automations",
    label: "Automations",
    icon: "bolt",
    route: "/dashboard/automations",
  },
  {
    id: "brandkit",
    label: "Brand Kit",
    icon: "palette",
    route: "/dashboard/brand",
  },
  {
    id: "outreach",
    label: "Outreach Kit",
    icon: "send",
    route: "/dashboard/outreach",
  },
];

const CLIENTELE_NAV = [
  {
    id: "clients",
    label: "Clients",
    icon: "users",
    route: "/dashboard/clients",
  },
  {
    id: "messages",
    label: "Messages",
    icon: "message-square",
    route: "/dashboard/messages",
  },
  {
    id: "reviews",
    label: "Reviews",
    icon: "star",
    route: "/dashboard/reviews",
  },
];

const PROJECT_NAV = [
  {
    id: "leads",
    label: "Leads",
    icon: "chart-arrows",
    route: "/dashboard/leads",
  },
  {
    id: "services",
    label: "Services",
    icon: "package",
    route: "/dashboard/services",
  },
  {
    id: "proposals",
    label: "Proposals",
    icon: "file-text",
    route: "/dashboard/proposals",
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
];

const SOCIAL_ITEM = {
  id: "social",
  label: "Social",
  icon: "share2",
  route: "/dashboard/social",
};

type NavEntry = { id: string; label: string; icon: string; route: string };

function NavLink({ item, onClick }: { item: NavEntry; onClick?: () => void }) {
  const { navigateTo, activeNavId } = useAppNavigation();
  const isActive = activeNavId === item.id;
  return (
    <button
      type="button"
      onClick={() => {
        navigateTo(item.route);
        onClick?.();
      }}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-colors text-left",
        isActive
          ? "bg-primary/10 text-primary font-medium"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
      )}
    >
      <NavIcon name={item.icon} className="h-3.5 w-3.5 shrink-0 opacity-70" />
      {item.label}
    </button>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="px-3 pt-3 pb-0.5 text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-widest">
      {label}
    </p>
  );
}

function toSlug(name: string) {
  return name.toLowerCase().replace(/\s+/g, "");
}

interface AppSidebarProps {
  onNavigate?: () => void;
  nudges: UseNudgesResult;
  isCopilotOpen?: boolean;
  onOpenCopilot?: () => void;
}

export function AppSidebar({
  onNavigate,
  nudges: { nudges, unreadCount, markRead, markAllRead },
  isCopilotOpen = false,
  onOpenCopilot,
}: AppSidebarProps) {
  const { user, profile, signOut } = useAuth();
  const { business, extractedData } = useBusiness();
  const { isDark, toggleTheme } = useTheme();
  const { navigateTo, activeNavId } = useAppNavigation();

  const identity = extractedData?.identity;
  const bizName =
    identity?.businessName ??
    identity?.name ??
    business?.name ??
    profile?.username ??
    "My Business";
  const initials = identity?.initials ?? bizName.slice(0, 2).toUpperCase();
  const tagline = identity?.tagline ?? "Your business OS";
  const businessIconUrl = (
    extractedData as { brand?: { businessIconUrl?: string } } | undefined
  )?.brand?.businessIconUrl;

  const displayName =
    profile?.username ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "";
  const displayEmail = user?.email ?? "";
  const avatarUrl: string | undefined =
    profile?.avatar_url || user?.user_metadata?.avatar_url || undefined;
  const initial = displayName.charAt(0).toUpperCase();

  const slug = profile?.username ?? (business ? toSlug(business.name) : "");

  function handleNudgeClick(nudge: {
    id: string;
    action_url: string | null;
    read: boolean;
  }) {
    if (!nudge.read) markRead(nudge.id);
    if (nudge.action_url) navigateTo(nudge.action_url);
  }

  return (
    <>
      <aside className="hidden md:flex flex-col w-64 bg-sidebar/10 backdrop-blur-md rounded-2xl border border-sidebar-border/40 shadow-lg shrink-0 overflow-hidden">
        {/* Business header */}
        <div className="px-4 py-4 border-b border-sidebar-border shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-lg overflow-hidden flex items-center justify-center shrink-0 select-none bg-primary/10">
              {businessIconUrl ? (
                <img
                  src={businessIconUrl}
                  alt={bizName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-sm font-bold text-primary">
                  {initials}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-none truncate text-sidebar-foreground">
                {bizName}
              </p>
              <p className="text-[11px] text-sidebar-foreground/50 mt-0.5 truncate">
                {tagline}
              </p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0">
          {onOpenCopilot && (
            <div className="px-0.5 py-1 mb-3">
              <button
                type="button"
                onClick={onOpenCopilot}
                className={cn(
                  "w-full flex items-center gap-2 px-3.5 py-2 rounded-md text-sm font-semibold text-left text-white",
                  "bg-gradient-to-r from-fuchsia-500 via-pink-500 to-blue-400",
                  "shadow-[0_0_16px_rgba(236,72,153,0.45)] hover:shadow-[0_0_22px_rgba(236,72,153,0.65)]",
                  "transition-all duration-200 hover:scale-[1.02]",
                  isCopilotOpen && "ring-2 ring-white/50",
                )}
              >
                <span className="relative shrink-0">
                  <MessageSquare className="h-4 w-4" strokeWidth={2.25} />
                  <Sparkles
                    className="h-2.5 w-2.5 absolute -top-1.5 -right-1.5"
                    strokeWidth={2.5}
                  />
                </span>
                Ask Freeda
              </button>
            </div>
          )}

          {MAIN_NAV.map((item) => (
            <NavLink key={item.id} item={item} onClick={onNavigate} />
          ))}

          <div className="px-0.5 py-1">
            <LogTimeWidget />
          </div>

          <SectionLabel label="Tools" />
          {TOOLS_NAV.map((item) => (
            <NavLink key={item.id} item={item} onClick={onNavigate} />
          ))}

          <SectionLabel label="Clientele" />
          {CLIENTELE_NAV.map((item) => (
            <NavLink key={item.id} item={item} onClick={onNavigate} />
          ))}

          <SectionLabel label="Project" />
          {PROJECT_NAV.map((item) => (
            <NavLink key={item.id} item={item} onClick={onNavigate} />
          ))}

          <div className="pt-3 mt-3 border-t border-sidebar-border/60">
            <NavLink
              item={{
                id: "settings",
                label: "Settings",
                icon: "settings",
                route: "/dashboard/settings",
              }}
              onClick={onNavigate}
            />
            {slug && (
              <button
                type="button"
                onClick={() => {
                  navigateTo("/dashboard/portfolio");
                  onNavigate?.();
                }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-colors text-left",
                  activeNavId === null &&
                    location.pathname === "/dashboard/portfolio"
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                )}
              >
                <Globe className="h-3.5 w-3.5 shrink-0 opacity-70" />
                Public Portfolio
              </button>
            )}
            <NavLink item={SOCIAL_ITEM} onClick={onNavigate} />
          </div>
        </nav>

        {/* User footer */}
        <div className="border-t border-sidebar-border p-3 shrink-0">
          <div className="flex items-center gap-1">
            {/* Avatar + name dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 min-w-0 flex-1 rounded-md px-2 py-1.5 hover:bg-sidebar-accent/50 transition-colors text-left"
                >
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarImage src={avatarUrl} alt={displayName} />
                    <AvatarFallback className="text-xs font-medium">
                      {initial}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-xs font-medium leading-none truncate text-sidebar-foreground">
                      {displayName}
                    </p>
                    <p className="text-[10px] text-sidebar-foreground/50 mt-0.5 truncate">
                      {displayEmail}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" className="w-52">
                <DropdownMenuItem
                  onClick={() => navigateTo("/dashboard/settings")}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => signOut()}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Theme toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              {isDark ? (
                <Sun className="h-3.5 w-3.5" />
              ) : (
                <Moon className="h-3.5 w-3.5" />
              )}
            </Button>

            {/* Notifications */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 relative shrink-0"
                  aria-label="Notifications"
                >
                  <Bell className="h-3.5 w-3.5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-destructive text-[9px] font-bold text-white flex items-center justify-center leading-none">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" side="top" className="w-80 p-0">
                <div className="flex items-center justify-between px-3 py-2 border-b">
                  <span className="text-sm font-semibold">Notifications</span>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllRead}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {nudges.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      No notifications yet
                    </p>
                  ) : (
                    nudges.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => handleNudgeClick(n)}
                        className={cn(
                          "w-full text-left px-3 py-2.5 border-b last:border-b-0 hover:bg-muted/50 transition-colors flex items-start gap-2",
                          !n.read ? "bg-primary/5" : "",
                        )}
                      >
                        {!n.read && (
                          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                        )}
                        <div className={!n.read ? "" : "ml-3.5"}>
                          <p className="text-xs font-medium leading-snug">
                            {n.title}
                          </p>
                          <p className="text-xs text-muted-foreground leading-snug mt-0.5 line-clamp-2">
                            {n.body}
                          </p>
                          <p className="text-[10px] text-muted-foreground/60 mt-1">
                            {formatDistanceToNow(new Date(n.created_at), {
                              addSuffix: true,
                            })}
                          </p>
                        </div>
                        {n.action_url && (
                          <ExternalLink className="h-3 w-3 shrink-0 mt-1 text-muted-foreground/40 ml-auto" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </aside>
    </>
  );
}
