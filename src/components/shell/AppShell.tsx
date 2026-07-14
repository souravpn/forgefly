import { GripVertical } from "lucide-react";
import { type ReactNode, useCallback, useRef, useState } from "react";
import { AICopilot } from "@/components/layouts/AICopilot";
import { CurrentBusinessProvider, useBusiness } from "@/contexts/CurrentBusinessContext";
import { useNudges } from "@/hooks/useNudges";
import { useReviewNotification } from "@/hooks/useReviewNotification";
import { cn } from "@/lib/utils";
import NoBusinessPage from "@/pages/NoBusinessPage";
import { AppSidebar } from "./AppSidebar";
import { MobileFooterNav } from "./MobileFooterNav";
import { MobileMoreSheet } from "./MobileMoreSheet";
import { MobileTopBar } from "./MobileTopBar";

const PANEL_MIN_WIDTH = 320;
const PANEL_MAX_WIDTH = 1000;
const PANEL_DEFAULT_WIDTH = 665; // 1.75x the old 380px default

function AppShellContent({ children }: { children: ReactNode }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
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

  function toggleCopilot() {
    setCopilotOpen((prev) => !prev);
  }

  function closeCopilot() {
    setCopilotOpen(false);
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
        isCopilotOpen={copilotOpen}
        onOpenCopilot={toggleCopilot}
      />

      {/* Content column */}
      <div
        ref={contentColumnRef}
        className="flex-1 flex flex-col min-w-0 overflow-hidden rounded-2xl bg-background/30 backdrop-blur-md border border-border/40 shadow-lg relative"
      >
        {/* Mobile top bar */}
        <MobileTopBar onMenuOpen={() => setMoreOpen(true)} nudges={nudges} />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          <div className="px-4 md:px-6 py-4 md:py-6">{children}</div>
        </main>

        {/* Right-side Freeda panel — single surface for everything (update
            business data, ask questions, propose actions), resizable via
            drag handle */}
        {copilotOpen && (
          <div
            className="absolute right-2 top-2 bottom-2 z-40 flex"
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
              <AICopilot onClose={closeCopilot} />
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
