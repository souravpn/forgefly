import { Link, useLocation } from "react-router-dom";
import {
  Home,
  Users,
  Briefcase,
  DollarSign,
  Calendar,
  FileText,
  Zap,
  Settings,
  LogOut,
  Menu,
  Package,
  Receipt,
  ChevronsLeft,
  ChevronsRight,
  Sun,
  Moon,
  Building2,
  HelpCircle,
  Bug,
  ChevronDown,
  Crown,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState, useRef, useEffect } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { UpgradeModal } from "@/components/common/UpgradeModal";

const navigation = [
  { name: "Home", href: "/dashboard", icon: Home },
  { name: "Clients", href: "/clients", icon: Users },
  { name: "Projects", href: "/projects", icon: Briefcase },
  { name: "Packages", href: "/packages", icon: Package },
  { name: "Finances", href: "/finances", icon: DollarSign },
  { name: "Calendar", href: "/calendar", icon: Calendar },
  { name: "Proposals", href: "/proposals", icon: FileText },
  { name: "Invoices", href: "/invoices", icon: Receipt },
  { name: "Automations", href: "/automations", icon: Zap },
  { name: "Settings", href: "/settings", icon: Settings },
];

function SidebarContent({
  onNavigate,
  isCollapsed,
  onToggleCollapse,
}: {
  onNavigate?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const location = useLocation();
  const { profile, signOut, isAgency, refreshSubscription } = useAuth();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check theme
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
      .matches
      ? "dark"
      : "light";
    const initialTheme = savedTheme || systemTheme;
    setTheme(initialTheme);
  }, []);

  useEffect(() => {
    // Check for upgrade success
    const params = new URLSearchParams(window.location.search);
    if (params.get("upgrade") === "success") {
      refreshSubscription();
      // Remove query param
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [refreshSubscription]);

  useEffect(() => {
    // Close menu when clicking outside
    function handleClickOutside(event: MouseEvent) {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }
    }

    if (isUserMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isUserMenuOpen]);

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/login";
  };

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  const handleUpgradeClick = () => {
    setIsUserMenuOpen(false);
    setShowUpgradeModal(true);
  };

  return (
    <>
      <div className="flex flex-col h-full bg-sidebar">
        <div
          className={`p-6 border-b border-sidebar-border ${isCollapsed ? "px-3" : ""}`}
        >
          <Link
            to="/dashboard"
            onClick={onNavigate}
            className={`flex items-center ${isCollapsed ? "justify-center" : "gap-3"}`}
          >
            <img
              src="/public/forgefly-icon.png"
              alt="Forgefly Logo"
              className="w-10 h-10 rounded-lg shrink-0"
            />
            {!isCollapsed && (
              <div>
                <h1 className="text-2xl font-bold text-sidebar-foreground">
                  Forgefly
                </h1>
                <p className="text-xs text-sidebar-foreground/60">
                  Forge Your Freedom
                </p>
              </div>
            )}
          </Link>
        </div>

        <nav
          className={`flex-1 ${isCollapsed ? "p-2" : "p-4"} space-y-1 overflow-y-auto`}
        >
          <TooltipProvider delayDuration={0}>
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              const linkContent = (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={onNavigate}
                  className={`flex items-center ${isCollapsed ? "justify-center px-3 py-3" : "gap-3 px-4 py-3"} rounded-lg transition-colors ${
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                  }`}
                >
                  <item.icon className="w-5 h-5 shrink-0" />
                  {!isCollapsed && (
                    <span className="text-sm font-medium">{item.name}</span>
                  )}
                </Link>
              );

              if (isCollapsed) {
                return (
                  <Tooltip key={item.name}>
                    <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                    <TooltipContent side="right">
                      <p>{item.name}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return linkContent;
            })}
          </TooltipProvider>
        </nav>

        <div className={`${isCollapsed ? "p-2" : "p-4"} space-y-2`}>
          {/* Collapse Toggle Button - Only show on desktop */}
          {onToggleCollapse && (
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    className={`w-full ${isCollapsed ? "justify-center px-3" : "justify-start"} text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground`}
                    onClick={onToggleCollapse}
                  >
                    {isCollapsed ? (
                      <ChevronsRight className="w-4 h-4" />
                    ) : (
                      <ChevronsLeft className="w-4 h-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                {isCollapsed && (
                  <TooltipContent side="right">
                    <p>Expand</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          )}

          {/* User Menu */}
          <div className="relative" ref={userMenuRef}>
            {!isCollapsed ? (
              <>
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-sidebar-accent transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white font-semibold text-sm shrink-0 shadow-lg">
                    {profile?.username?.charAt(0).toUpperCase() || "U"}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-sidebar-foreground truncate">
                        {profile?.username || "User"}
                      </p>
                      {isAgency && (
                        <Badge className="bg-gradient-to-r from-emerald-500 to-amber-500 text-white text-xs px-1.5 py-0 h-5">
                          <Crown className="w-3 h-3 mr-0.5" />
                          Agency
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-sidebar-foreground/60 truncate">
                      {profile?.email || profile?.role || "user"}
                    </p>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-sidebar-foreground/60 transition-transform ${isUserMenuOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {/* Dropdown Menu */}
                {isUserMenuOpen && (
                  <div className="absolute bottom-full left-0 right-0 mb-2 bg-sidebar/95 backdrop-blur-xl border border-emerald-500/20 rounded-lg shadow-2xl overflow-hidden animate-in slide-in-from-bottom-2 duration-200">
                    <div className="p-2 space-y-1">
                      {/* Theme Toggle */}
                      <div className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-sidebar-accent transition-colors">
                        <div className="flex items-center gap-3">
                          {theme === "dark" ? (
                            <Moon className="w-4 h-4 text-sidebar-foreground" />
                          ) : (
                            <Sun className="w-4 h-4 text-sidebar-foreground" />
                          )}
                          <span className="text-sm text-sidebar-foreground">
                            {theme === "dark" ? "Dark Mode" : "Light Mode"}
                          </span>
                        </div>
                        <Switch
                          checked={theme === "dark"}
                          onCheckedChange={toggleTheme}
                          className="data-[state=checked]:bg-emerald-500"
                        />
                      </div>

                      <Separator className="my-1 bg-sidebar-border" />

                      {/* Agency Mode / Upgrade */}
                      {!isAgency ? (
                        <button
                          onClick={handleUpgradeClick}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-sidebar-accent transition-colors text-left"
                        >
                          <Crown className="w-4 h-4 text-amber-400" />
                          <span className="text-sm text-sidebar-foreground">
                            Switch to Agency Mode
                          </span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-3 px-3 py-2">
                          <Crown className="w-4 h-4 text-emerald-400" />
                          <span className="text-sm text-emerald-400 font-medium">
                            Agency Mode Active
                          </span>
                        </div>
                      )}

                      {/* Help & Feedback */}
                      <button className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-sidebar-accent transition-colors text-left">
                        <HelpCircle className="w-4 h-4 text-sidebar-foreground" />
                        <span className="text-sm text-sidebar-foreground">
                          Help & Feedback
                        </span>
                      </button>

                      {/* Report a Bug */}
                      <button className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-sidebar-accent transition-colors text-left">
                        <Bug className="w-4 h-4 text-sidebar-foreground" />
                        <span className="text-sm text-sidebar-foreground">
                          Report a Bug
                        </span>
                      </button>

                      <Separator className="my-1 bg-sidebar-border" />

                      {/* Sign Out */}
                      <button
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-destructive/10 text-sidebar-foreground hover:text-destructive transition-colors text-left"
                      >
                        <LogOut className="w-4 h-4" />
                        <span className="text-sm font-medium">Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                        className="w-full flex justify-center py-2 relative"
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white font-semibold text-sm shadow-lg">
                          {profile?.username?.charAt(0).toUpperCase() || "U"}
                        </div>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>{profile?.username || "User"}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {/* Dropdown Menu for Collapsed State */}
                {isUserMenuOpen && (
                  <div className="absolute bottom-full left-full ml-2 mb-2 w-64 bg-sidebar/95 backdrop-blur-xl border border-emerald-500/20 rounded-lg shadow-2xl overflow-hidden animate-in slide-in-from-left-2 duration-200 z-50">
                    <div className="p-2 space-y-1">
                      {/* User Info Header */}
                      <div className="px-3 py-2 border-b border-sidebar-border">
                        <p className="text-sm font-semibold text-sidebar-foreground truncate">
                          {profile?.username || "User"}
                        </p>
                        <p className="text-xs text-sidebar-foreground/60 truncate">
                          {profile?.email || profile?.role || "user"}
                        </p>
                      </div>

                      {/* Theme Toggle */}
                      <div className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-sidebar-accent transition-colors">
                        <div className="flex items-center gap-3">
                          {theme === "dark" ? (
                            <Moon className="w-4 h-4 text-sidebar-foreground" />
                          ) : (
                            <Sun className="w-4 h-4 text-sidebar-foreground" />
                          )}
                          <span className="text-sm text-sidebar-foreground">
                            {theme === "dark" ? "Dark Mode" : "Light Mode"}
                          </span>
                        </div>
                        <Switch
                          checked={theme === "dark"}
                          onCheckedChange={toggleTheme}
                          className="data-[state=checked]:bg-emerald-500"
                        />
                      </div>

                      <Separator className="my-1 bg-sidebar-border" />

                      {/* Agency Mode / Upgrade */}
                      {!isAgency ? (
                        <button
                          onClick={handleUpgradeClick}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-sidebar-accent transition-colors text-left"
                        >
                          <Crown className="w-4 h-4 text-amber-400" />
                          <span className="text-sm text-sidebar-foreground">
                            Switch to Agency Mode
                          </span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-3 px-3 py-2">
                          <Crown className="w-4 h-4 text-emerald-400" />
                          <span className="text-sm text-emerald-400 font-medium">
                            Agency Mode Active
                          </span>
                        </div>
                      )}

                      {/* Help & Feedback */}
                      <button className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-sidebar-accent transition-colors text-left">
                        <HelpCircle className="w-4 h-4 text-sidebar-foreground" />
                        <span className="text-sm text-sidebar-foreground">
                          Help & Feedback
                        </span>
                      </button>

                      {/* Report a Bug */}
                      <button className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-sidebar-accent transition-colors text-left">
                        <Bug className="w-4 h-4 text-sidebar-foreground" />
                        <span className="text-sm text-sidebar-foreground">
                          Report a Bug
                        </span>
                      </button>

                      <Separator className="my-1 bg-sidebar-border" />

                      {/* Sign Out */}
                      <button
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-destructive/10 text-sidebar-foreground hover:text-destructive transition-colors text-left"
                      >
                        <LogOut className="w-4 h-4" />
                        <span className="text-sm font-medium">Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <UpgradeModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
      />
    </>
  );
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <>
      {/* Mobile menu button - Top Right */}
      <div className="md:hidden fixed top-4 right-4 z-40">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="bg-card">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64 bg-sidebar">
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop sidebar - Collapsible */}
      <aside
        className={`hidden md:flex flex-col ${isCollapsed ? "w-16" : "w-64"} h-screen shrink-0 border-r border-sidebar-border transition-all duration-300`}
      >
        <SidebarContent
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        />
      </aside>
    </>
  );
}
