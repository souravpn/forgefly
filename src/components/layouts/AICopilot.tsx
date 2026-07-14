import {
  ArrowLeft,
  ArrowRight,
  Check,
  Crown,
  DollarSign,
  FileText,
  Loader2,
  type LucideIcon,
  Mic,
  MicOff,
  Send,
  Sparkles,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { type FreedaKpiResult, resolveFreedaKpi } from "@/config/freedaKpiCatalog";
import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "@/contexts/CurrentBusinessContext";
import { supabase } from "@/db/supabase";
import { useVoiceDictation } from "@/hooks/useVoiceDictation";
import { applyBusinessDiff, buildDiffLines, type PendingDiff } from "@/lib/businessDiff";
import { cn } from "@/lib/utils";
import { loadOverviewData } from "@/services/dashboardService";
import type { ActionProposal, ActionRecipient, ActionSendResult, ChatMessage } from "@/types/types";

interface QuickAction {
  icon: LucideIcon;
  label: string;
  query: string;
}

interface FreedaResponse {
  kind?: "update" | "query" | "action" | "support" | "off_topic";
  matched?: boolean;
  kpi_id?: string;
  message?: string;
  action?: string;
  actionData?: any;
  suggestions?: string[];
  // "update" kind — same shape handleExtract already returns
  extracted_data?: Record<string, unknown>;
  sections_updated?: string[];
  // "action" kind — same shape handleActionPropose already returns
  recipients?: ActionRecipient[];
  message_draft?: string;
  note?: string;
  needs_selection?: boolean;
  candidate_clients?: { id: string; name: string }[];
  unresolved_names?: string[];
}

interface ActionExecuteResponse {
  results?: ActionSendResult[];
  error?: string;
}

interface AICopilotProps {
  onClose: () => void;
}

function actionButtonLabel(action: string): string {
  switch (action) {
    case "create_proposal":
      return "Create proposal";
    case "create_invoice":
      return "Create invoice";
    case "show_forecast":
      return "Show forecast";
    case "upgrade_agency":
      return "Upgrade to Agency";
    default:
      return "Take me there";
  }
}

// Compact markdown rendering for assistant replies — the model reliably
// produces **bold**, numbered/bulleted lists, and paragraphs; default
// react-markdown element sizing reads as article prose, too loose for a
// narrow chat bubble, so every element is remapped to the bubble's own
// text-sm scale with tight spacing instead.
const markdownComponents: Components = {
  p: ({ children }) => <p className="text-sm leading-relaxed mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="text-sm list-disc pl-4 space-y-1 mb-2 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="text-sm list-decimal pl-4 space-y-1 mb-2 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:opacity-80">
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="text-xs bg-black/10 dark:bg-white/10 rounded px-1 py-0.5">{children}</code>
  ),
  h1: ({ children }) => <p className="text-sm font-semibold mb-1">{children}</p>,
  h2: ({ children }) => <p className="text-sm font-semibold mb-1">{children}</p>,
  h3: ({ children }) => <p className="text-sm font-semibold mb-1">{children}</p>,
};

export function AICopilot({ onClose }: AICopilotProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { business, extractedData, refetch } = useBusiness();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      role: "assistant",
      content:
        "Hi! I'm Freeda. Ask me anything about your business, or tell me what to update — I have full context on your clients, projects, and proposals.",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [applyingDiffId, setApplyingDiffId] = useState<string | null>(null);
  const { isListening, isSupported: isVoiceSupported, toggleListening } = useVoiceDictation(
    (transcript) => setInput((prev) => (prev.trim() ? `${prev.trim()} ${transcript}` : transcript)),
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    updateQuickActions();
  }, [location.pathname]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const updateQuickActions = () => {
    const path = location.pathname;
    let actions: QuickAction[] = [];

    if (path === "/" || path === "/dashboard") {
      actions = [
        {
          icon: FileText,
          label: "Create Proposal",
          query: "Create a proposal for my top client",
        },
        {
          icon: DollarSign,
          label: "Generate Invoice",
          query: "Generate an invoice for a completed project",
        },
        {
          icon: TrendingUp,
          label: "Show Forecast",
          query: "Show me cashflow forecast for next 3 months",
        },
        {
          icon: Crown,
          label: "Upgrade Agency",
          query: "Switch to Agency Mode",
        },
      ];
    } else if (path === "/clients") {
      actions = [
        {
          icon: FileText,
          label: "New Proposal",
          query: "Create a proposal for a client",
        },
        {
          icon: DollarSign,
          label: "New Invoice",
          query: "Generate an invoice",
        },
        {
          icon: Users,
          label: "Client Insights",
          query: "Show me insights about my clients",
        },
      ];
    } else if (path === "/projects") {
      actions = [
        {
          icon: FileText,
          label: "Project Proposal",
          query: "Create proposal for a project",
        },
        {
          icon: DollarSign,
          label: "Invoice Project",
          query: "Create invoice for completed project",
        },
        {
          icon: TrendingUp,
          label: "Pipeline Value",
          query: "Show me my project pipeline value",
        },
      ];
    } else if (path === "/proposals") {
      actions = [
        {
          icon: FileText,
          label: "New Proposal",
          query: "Create a new proposal",
        },
        {
          icon: Send,
          label: "Send Proposal",
          query: "Help me send a proposal to a client",
        },
      ];
    } else if (path === "/invoices") {
      actions = [
        {
          icon: DollarSign,
          label: "New Invoice",
          query: "Create a new invoice",
        },
        { icon: Send, label: "Send Invoice", query: "Help me send an invoice" },
        {
          icon: TrendingUp,
          label: "Revenue Summary",
          query: "Show me my revenue summary",
        },
      ];
    } else if (path === "/finances") {
      actions = [
        {
          icon: TrendingUp,
          label: "Cashflow Forecast",
          query: "Forecast my cashflow",
        },
        {
          icon: DollarSign,
          label: "Revenue Analysis",
          query: "Analyze my revenue trends",
        },
      ];
    } else {
      actions = [
        {
          icon: FileText,
          label: "Create Proposal",
          query: "Create a proposal",
        },
        {
          icon: DollarSign,
          label: "Generate Invoice",
          query: "Generate an invoice",
        },
        {
          icon: TrendingUp,
          label: "Business Insights",
          query: "Show me business insights",
        },
      ];
    }

    setQuickActions(actions.slice(0, 4));
  };

  const handleQuickAction = (query: string) => {
    setInput(query);
    setTimeout(() => handleSend(), 100);
  };

  const handleApplyDiff = async (messageId: string, diff: PendingDiff) => {
    if (!business) return;
    setApplyingDiffId(messageId);
    try {
      await applyBusinessDiff(business, (extractedData ?? {}) as Record<string, unknown>, diff);
      await refetch();
      toast.success("Business OS updated");
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, diffApplied: true } : m)),
      );
    } catch (err) {
      console.error("Apply diff error:", err);
      toast.error("Failed to apply changes. Please try again.");
    } finally {
      setApplyingDiffId(null);
    }
  };

  const handleDismissDiff = (messageId: string) => {
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, diff: undefined } : m)));
  };

  const toggleCandidate = (messageId: string, clientId: string) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId || !m.actionProposal) return m;
        const current = m.actionProposal.selectedCandidateIds ?? [];
        const next = current.includes(clientId) ? current.filter((id) => id !== clientId) : [...current, clientId];
        return { ...m, actionProposal: { ...m.actionProposal, selectedCandidateIds: next } };
      }),
    );
  };

  const updateActionDraft = (messageId: string, text: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId && m.actionProposal ? { ...m, actionProposal: { ...m.actionProposal, messageDraft: text } } : m)),
    );
  };

  const handleConfirmSelection = async (messageId: string) => {
    const msg = messages.find((m) => m.id === messageId);
    const proposal = msg?.actionProposal;
    if (!proposal?.selectedCandidateIds?.length || !proposal.originalPrompt) return;

    setIsTyping(true);
    try {
      const { data, error } = await supabase.functions.invoke<FreedaResponse>("ai-gateway", {
        body: {
          mode: "freeda",
          prompt: proposal.originalPrompt,
          current_page: location.pathname,
          selected_client_ids: proposal.selectedCandidateIds,
        },
      });
      if (error || !data) throw new Error("Failed to resolve recipients");

      const recipients = data.recipients ?? [];
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                content: recipients.length > 0 ? "Here's who I'd message, and a draft:" : (data.note ?? "There's nobody to message right now."),
                actionProposal: recipients.length > 0 ? { recipients, messageDraft: data.message_draft ?? "" } : undefined,
              }
            : m,
        ),
      );
    } catch (err) {
      console.error("Confirm selection error:", err);
      toast.error("Couldn't resolve those clients. Please try again.");
    } finally {
      setIsTyping(false);
    }
  };

  const handleSendAction = async (messageId: string) => {
    const msg = messages.find((m) => m.id === messageId);
    const proposal = msg?.actionProposal;
    if (!proposal) return;

    setMessages((prev) =>
      prev.map((m) => (m.id === messageId && m.actionProposal ? { ...m, actionProposal: { ...m.actionProposal, sending: true } } : m)),
    );

    try {
      const { data, error } = await supabase.functions.invoke<ActionExecuteResponse>("ai-gateway", {
        body: {
          mode: "freeda_execute_action",
          recipients: proposal.recipients,
          message: proposal.messageDraft,
        },
      });
      if (error || !data || data.error) throw new Error(data?.error || "Failed to send");

      const results = data.results ?? [];
      const sentCount = results.filter((r) => r.sent).length;
      const failedCount = results.length - sentCount;
      if (sentCount > 0) toast.success(`Sent to ${sentCount} client${sentCount === 1 ? "" : "s"}`);
      if (failedCount > 0) toast.error(`${failedCount} message${failedCount === 1 ? "" : "s"} failed to send`);

      setMessages((prev) =>
        prev.map((m) => (m.id === messageId && m.actionProposal ? { ...m, actionProposal: { ...m.actionProposal, sending: false, sendResults: results } } : m)),
      );
    } catch (err) {
      console.error("Send action error:", err);
      toast.error("Failed to send messages. Please try again.");
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId && m.actionProposal ? { ...m, actionProposal: { ...m.actionProposal, sending: false } } : m)),
      );
    }
  };

  // Every real page lives under /dashboard — the model occasionally returns
  // a bare path (e.g. "/clients" or "/proposals?create=true"), which
  // silently hits the catch-all redirect back to "/" instead of the
  // intended page. Normalize rather than trust the model's output verbatim.
  const toDashboardPath = (rawPath: string) =>
    rawPath.startsWith("/dashboard") ? rawPath : `/dashboard${rawPath.startsWith("/") ? "" : "/"}${rawPath}`;

  // Fires only when the user explicitly clicks the "Take me there" button on
  // a message — never automatically, since silently navigating the page out
  // from under someone mid-read is jarring.
  const handleAction = async (action: string, actionData: any) => {
    switch (action) {
      case "create_proposal":
        navigate(toDashboardPath(actionData?.clientId ? `/proposals?create=true&clientId=${actionData.clientId}` : "/proposals?create=true"));
        break;

      case "create_invoice":
        navigate(toDashboardPath(actionData?.projectId ? `/invoices?create=true&projectId=${actionData.projectId}` : "/invoices?create=true"));
        break;

      case "show_forecast":
        navigate("/dashboard/finances");
        break;

      case "upgrade_agency":
        navigate("/dashboard?upgrade=true");
        break;

      case "navigate":
        if (actionData?.path) {
          navigate(toDashboardPath(actionData.path));
        }
        break;

      default:
        console.log("Unknown action:", action);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    try {
      const { data, error } = await supabase.functions.invoke<FreedaResponse>(
        "ai-gateway",
        {
          body: {
            mode: "freeda",
            prompt: input,
            current_page: location.pathname,
          },
        },
      );

      if (error || !data) {
        const errorMsg = await error?.context?.text();
        console.error("AI Copilot error:", errorMsg || error?.message);
        throw new Error("Failed to get AI response");
      }

      if (data.kind === "update") {
        const mergedData = data.extracted_data ?? {};
        const sections = data.sections_updated ?? [];
        const lines = buildDiffLines((extractedData ?? {}) as Record<string, unknown>, mergedData, sections);

        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content:
              lines.length > 0
                ? "Here's what I'll change:"
                : "I didn't find a concrete change to make from that — try rephrasing?",
            timestamp: new Date().toISOString(),
            diff: lines.length > 0 ? { mergedData, sections, lines } : undefined,
          },
        ]);
        return;
      }

      if (data.kind === "action") {
        if (data.needs_selection) {
          setMessages((prev) => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              role: "assistant",
              content: data.note ?? "I wasn't sure exactly who this should go to — pick the clients below.",
              timestamp: new Date().toISOString(),
              actionProposal: {
                recipients: [],
                messageDraft: "",
                needsSelection: true,
                candidateClients: data.candidate_clients ?? [],
                selectedCandidateIds: [],
                originalPrompt: input,
              },
            },
          ]);
          return;
        }

        const recipients = data.recipients ?? [];
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content:
              recipients.length > 0
                ? "Here's who I'd message, and a draft:"
                : (data.note ?? "There's nobody to message right now."),
            timestamp: new Date().toISOString(),
            actionProposal:
              recipients.length > 0
                ? {
                    recipients,
                    messageDraft: data.message_draft ?? "",
                    unresolvedNames: data.unresolved_names,
                  }
                : undefined,
          },
        ]);
        return;
      }

      if (data.kind === "query" && data.matched && data.kpi_id) {
        let kpi: FreedaKpiResult | null = null;
        try {
          const overview = await loadOverviewData(user?.id ?? "", business?.id);
          kpi = resolveFreedaKpi(data.kpi_id, overview);
        } catch (err) {
          console.error("Failed to resolve KPI value:", err);
        }

        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: kpi ? `Here's your ${kpi.label.toLowerCase()}:` : "I couldn't pull that up just now — try again in a moment.",
            timestamp: new Date().toISOString(),
            kpi: kpi ?? undefined,
          },
        ]);
        return;
      }

      // support / off_topic / unmatched query — same shape handleChat has
      // always returned. The action, if any, is rendered as a button the
      // user clicks — never fired automatically.
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.message || "I'm not sure how to respond to that.",
        timestamp: new Date().toISOString(),
        suggestedAction: data.action ? { action: data.action, actionData: data.actionData } : undefined,
      };

      setMessages((prev) => [...prev, aiMessage]);

      if (data.suggestions && data.suggestions.length > 0) {
        setSuggestions(data.suggestions);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          "I'm having trouble processing that request. Please try again.",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      toast.error("AI Copilot error. Please try again.");
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-emerald-500/10 to-transparent shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Ask Freeda</h3>
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              Context-aware Assistant
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`rounded-lg p-3 ${message.role === "user" ? "max-w-[80%]" : "max-w-[94%]"} ${
                  message.role === "user"
                    ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white"
                    : "bg-muted text-foreground"
                }`}
              >
                {message.role === "assistant" ? (
                  <ReactMarkdown components={markdownComponents}>{message.content}</ReactMarkdown>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                )}

                {message.suggestedAction && (
                  <button
                    type="button"
                    onClick={() => handleAction(message.suggestedAction!.action, message.suggestedAction!.actionData)}
                    className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline pt-2"
                  >
                    {actionButtonLabel(message.suggestedAction.action)}
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}

                {message.kpi && (
                  <div className="mt-2 rounded-lg border border-border bg-background/70 p-3 space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {message.kpi.label}
                    </p>

                    {message.kpi.kind === "stat" && (
                      <div>
                        <p className="text-xl font-bold">{message.kpi.value}</p>
                        {message.kpi.sublabel && (
                          <p className="text-xs text-muted-foreground mt-0.5">{message.kpi.sublabel}</p>
                        )}
                      </div>
                    )}

                    {message.kpi.kind === "stat-group" && (
                      <div className="flex gap-4">
                        {message.kpi.stats.map((s, i) => (
                          <div key={i}>
                            <p className="text-lg font-bold">{s.value}</p>
                            <p className="text-[10px] text-muted-foreground">{s.caption}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {message.kpi.kind === "list" && (
                      message.kpi.items.length === 0 ? (
                        <p className="text-xs text-muted-foreground">{message.kpi.emptyMessage}</p>
                      ) : (
                        <div className="space-y-1.5">
                          {message.kpi.items.slice(0, 5).map((item, i) => (
                            <div key={i} className="flex items-center justify-between gap-2 text-xs">
                              <span className="font-medium truncate">{item.label}</span>
                              {item.sublabel && (
                                <span className="text-muted-foreground shrink-0">{item.sublabel}</span>
                              )}
                            </div>
                          ))}
                          {message.kpi.items.length > 5 && (
                            <p className="text-[10px] text-muted-foreground">
                              +{message.kpi.items.length - 5} more
                            </p>
                          )}
                        </div>
                      )
                    )}

                    <button
                      type="button"
                      onClick={() => navigate(message.kpi!.route)}
                      className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline pt-1"
                    >
                      {message.kpi.routeLabel}
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {message.diff && (
                  <div className="mt-2 rounded-lg border border-border bg-background/70 p-3 space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Review changes
                    </p>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {message.diff.lines.map((line, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          <span
                            className={cn(
                              "font-mono font-bold w-3 shrink-0",
                              line.type === "+" ? "text-emerald-500" : "text-amber-500",
                            )}
                          >
                            {line.type}
                          </span>
                          <span className="text-muted-foreground w-28 shrink-0">{line.label}</span>
                          {line.detail && <span className="text-foreground/90">{line.detail}</span>}
                        </div>
                      ))}
                    </div>
                    {message.diffApplied ? (
                      <p className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 pt-1">
                        <Check className="w-3 h-3" />
                        Applied to all tabs
                      </p>
                    ) : (
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 gap-1"
                          onClick={() => handleDismissDiff(message.id)}
                          disabled={applyingDiffId === message.id}
                        >
                          <ArrowLeft className="w-3 h-3" />
                          Dismiss
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 gap-1 bg-emerald-500 hover:bg-emerald-600 text-white"
                          onClick={() => handleApplyDiff(message.id, message.diff!)}
                          disabled={applyingDiffId === message.id}
                        >
                          <Check className="w-3 h-3" />
                          {applyingDiffId === message.id ? "Applying…" : "Apply to all tabs"}
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {message.actionProposal?.needsSelection && (
                  <div className="mt-2 rounded-lg border border-border bg-background/70 p-3 space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Select clients
                    </p>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {(message.actionProposal.candidateClients ?? []).map((c) => {
                        const checked = message.actionProposal!.selectedCandidateIds?.includes(c.id) ?? false;
                        return (
                          <label key={c.id} className="flex items-center gap-2 text-xs cursor-pointer py-0.5">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleCandidate(message.id, c.id)}
                              className="accent-emerald-500"
                            />
                            <span className="truncate">{c.name}</span>
                          </label>
                        );
                      })}
                    </div>
                    <Button
                      size="sm"
                      className="w-full bg-emerald-500 hover:bg-emerald-600 text-white"
                      disabled={!message.actionProposal.selectedCandidateIds?.length || isTyping}
                      onClick={() => handleConfirmSelection(message.id)}
                    >
                      Confirm {message.actionProposal.selectedCandidateIds?.length || ""} selected
                    </Button>
                  </div>
                )}

                {message.actionProposal && !message.actionProposal.needsSelection && (
                  <div className="mt-2 rounded-lg border border-border bg-background/70 p-3 space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {message.actionProposal.recipients.length} recipient
                      {message.actionProposal.recipients.length === 1 ? "" : "s"}
                    </p>
                    <div className="space-y-1.5">
                      {message.actionProposal.recipients.map((r, i) => (
                        <div key={i} className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-medium truncate">{r.name}</span>
                          {r.invoice_number && (
                            <span className="text-muted-foreground shrink-0">
                              {r.invoice_number} · ${(r.amount ?? 0).toLocaleString()}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                    {message.actionProposal.unresolvedNames && message.actionProposal.unresolvedNames.length > 0 && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400">
                        Couldn't find: {message.actionProposal.unresolvedNames.join(", ")}
                      </p>
                    )}

                    {message.actionProposal.sendResults ? (
                      <div className="space-y-1">
                        {message.actionProposal.sendResults.map((r, i) => (
                          <div key={i} className="flex items-center justify-between gap-2 text-xs">
                            <span className={cn("font-medium truncate", !r.sent && "text-muted-foreground")}>{r.name}</span>
                            <span className={r.sent ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>
                              {r.sent ? "✓ Sent" : r.reason || "Failed"}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <>
                        <Textarea
                          value={message.actionProposal.messageDraft}
                          onChange={(e) => updateActionDraft(message.id, e.target.value)}
                          disabled={message.actionProposal.sending}
                          className="text-xs bg-muted border-none resize-none min-h-[70px]"
                        />
                        <Button
                          size="sm"
                          className="w-full bg-emerald-500 hover:bg-emerald-600 text-white"
                          disabled={message.actionProposal.sending || !message.actionProposal.messageDraft.trim()}
                          onClick={() => handleSendAction(message.id)}
                        >
                          {message.actionProposal.sending
                            ? "Sending…"
                            : `Send to ${message.actionProposal.recipients.length} client${message.actionProposal.recipients.length === 1 ? "" : "s"}`}
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg p-3 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                <span className="text-sm text-muted-foreground">
                  Thinking...
                </span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* AI Suggestions */}
      {suggestions.length > 0 && (
        <div className="px-4 py-2 border-t bg-emerald-500/5">
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-2 font-medium">
            💡 Suggestions:
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion, index) => (
              <Badge
                key={index}
                variant="outline"
                className="cursor-pointer hover:bg-emerald-500/10 hover:border-emerald-500 transition-colors px-3 py-1.5 text-xs"
                onClick={() => {
                  setInput(suggestion);
                  setTimeout(() => handleSend(), 100);
                }}
              >
                {suggestion}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Quick Action Chips */}
      {quickActions.length > 0 && (
        <div className="px-4 py-2 border-t bg-muted/30">
          <p className="text-xs text-muted-foreground mb-2">
            ⚡ Quick actions:
          </p>
          <div className="flex flex-wrap gap-2">
            {quickActions.map((action, index) => {
              const IconComponent = action.icon;
              return (
                <Badge
                  key={index}
                  variant="secondary"
                  className="cursor-pointer hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors px-3 py-1.5"
                  onClick={() => handleQuickAction(action.query)}
                >
                  <IconComponent className="w-3 h-3 mr-1.5" />
                  {action.label}
                </Badge>
              );
            })}
          </div>
        </div>
      )}

      <div className="p-4 border-t shrink-0">
        <div className="flex gap-2">
          <Textarea
            placeholder="Ask me anything… (Shift+Enter for new line)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            disabled={isTyping}
            className="min-h-[60px] resize-none"
          />
          {isVoiceSupported && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={toggleListening}
              className={cn(
                "shrink-0",
                isListening && "bg-destructive/10 border-destructive text-destructive animate-pulse",
              )}
              aria-label={isListening ? "Stop voice dictation" : "Start voice dictation"}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>
          )}
          <Button
            onClick={handleSend}
            size="icon"
            className="shrink-0 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
            disabled={isTyping || !input.trim()}
          >
            {isTyping ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Powered by Claude with full business context
        </p>
      </div>
    </>
  );
}
