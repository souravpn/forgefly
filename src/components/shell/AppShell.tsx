import { useState, useRef, useCallback, type ReactNode } from "react";
import { X, Sparkles, Send, GripVertical } from "lucide-react";
import { AppSidebar } from "./AppSidebar";
import { MobileTopBar } from "./MobileTopBar";
import { BusinessBand } from "./BusinessBand";
import { MobileFooterNav } from "./MobileFooterNav";
import { MobileMoreSheet } from "./MobileMoreSheet";
import { AICopilot } from "@/components/layouts/AICopilot";
import { CurrentBusinessProvider } from "@/contexts/CurrentBusinessContext";
import { useBusiness } from "@/contexts/CurrentBusinessContext";
import { useReviewNotification } from "@/hooks/useReviewNotification";
import { useNudges } from "@/hooks/useNudges";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { CommandBar } from "./CommandBar";
import NoBusinessPage from "@/pages/NoBusinessPage";

type PanelType = "copilot" | "upgrade";

const PANEL_MIN_WIDTH = 320;
const PANEL_MAX_WIDTH = 720;
const PANEL_DEFAULT_WIDTH = 380;

function UpgradePanel({ onClose }: { onClose: () => void }) {
  const { business, extractedData, refetch } = useBusiness();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Update OS</h3>
            <p className="text-xs text-muted-foreground">
              Describe a change — AI updates your profile
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Command bar content fills the rest */}
      <div className="flex-1 overflow-y-auto">
        <CommandBar
          onClose={onClose}
          business={business}
          extractedData={extractedData}
          refetch={refetch}
        />
      </div>
    </div>
  );
}

function AppShellContent({ children }: { children: ReactNode }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [panelType, setPanelType] = useState<PanelType | null>(null);
  const [panelWidth, setPanelWidth] = useState(PANEL_DEFAULT_WIDTH);
  const isResizingRef = useRef(false);
  const contentColumnRef = useRef<HTMLDivElement>(null);
  const { business, extractedData, isLoading } = useBusiness();
  const nudges = useNudges();
  useReviewNotification();

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    const columnRight =
      contentColumnRef.current?.getBoundingClientRect().right ??
      window.innerWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingRef.current) return;
      const newWidth = columnRight - moveEvent.clientX - 8;
      setPanelWidth(
        Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, newWidth)),
      );
    };

    const onMouseUp = () => {
      isResizingRef.current = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, []);

  if (!isLoading && !business) {
    return <NoBusinessPage />;
  }

  function openPanel(type: PanelType) {
    setPanelType((prev) => (prev === type ? null : type));
  }

  function closePanel() {
    setPanelType(null);
  }

  const secondaryColor = extractedData?.brand?.secondaryColor;

  return (
    <div
      className={cn(
        "flex h-screen p-2 gap-2",
        !secondaryColor && "bg-muted/60",
      )}
      style={secondaryColor ? { backgroundColor: secondaryColor } : undefined}
    >
      {/* Desktop sidebar */}
      <AppSidebar
        nudges={nudges}
        isCopilotOpen={panelType === "copilot"}
        onOpenCopilot={() => openPanel("copilot")}
      />

      {/* Content column */}
      <div
        ref={contentColumnRef}
        className="flex-1 flex flex-col min-w-0 overflow-hidden rounded-2xl bg-background/30 backdrop-blur-md border border-border/40 shadow-lg relative"
      >
        {/* Mobile top bar */}
        <MobileTopBar onMenuOpen={() => setMoreOpen(true)} nudges={nudges} />

        {/* Header band with AI Copilot + Update OS buttons */}
        <BusinessBand activePanel={panelType} onOpenPanel={openPanel} />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          <div className="px-4 md:px-6 py-4 md:py-6">{children}</div>
        </main>

        {/* Right-side panel overlay (copilot or upgrade), resizable via drag handle */}
        {panelType && (
          <div
            className="absolute right-2 top-[48px] bottom-2 z-40 flex"
            style={{ width: panelWidth }}
          >
            {/* Resize handle */}
            <div
              onMouseDown={handleResizeStart}
              className="group relative w-1.5 shrink-0 cursor-col-resize flex items-center justify-center"
            >
              <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border group-hover:bg-primary/50 transition-colors" />
              <div className="z-10 flex h-8 w-3 items-center justify-center rounded-sm border bg-border group-hover:border-primary/50 transition-colors">
                <GripVertical className="h-2.5 w-2.5" />
              </div>
            </div>

            <div
              className={cn(
                "flex-1 min-w-0 flex flex-col",
                "bg-background border border-border/40 shadow-2xl rounded-xl overflow-hidden",
              )}
            >
              {panelType === "copilot" ? (
                <AICopilot onClose={closePanel} />
              ) : (
                <UpgradePanel onClose={closePanel} />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mobile overlays */}
      <MobileFooterNav
        onMoreOpen={() => setMoreOpen(true)}
        isMoreOpen={moreOpen}
      />
      <MobileMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <CurrentBusinessProvider>
      <AppShellContent>{children}</AppShellContent>
    </CurrentBusinessProvider>
  );
}
