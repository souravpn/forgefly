import { useState, useEffect, useRef } from 'react';
import { X, Send, Sparkles, FileText, DollarSign, TrendingUp, Users, Crown, Loader2, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/db/supabase';
import { toast } from 'sonner';
import type { ChatMessage } from '@/types/types';

interface QuickAction {
  icon: LucideIcon;
  label: string;
  query: string;
}

interface AIResponse {
  message: string;
  action?: string;
  actionData?: any;
  suggestions?: string[];
}

interface AICopilotProps {
  onClose: () => void;
}

export function AICopilot({ onClose }: AICopilotProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm your AI Copilot. I have full awareness of your business, clients, projects, and proposals. Ask me anything or try a quick action below!",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    updateQuickActions();
  }, [location.pathname]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const updateQuickActions = () => {
    const path = location.pathname;
    let actions: QuickAction[] = [];

    if (path === '/' || path === '/dashboard') {
      actions = [
        { icon: FileText, label: 'Create Proposal', query: 'Create a proposal for my top client' },
        { icon: DollarSign, label: 'Generate Invoice', query: 'Generate an invoice for a completed project' },
        { icon: TrendingUp, label: 'Show Forecast', query: 'Show me cashflow forecast for next 3 months' },
        { icon: Crown, label: 'Upgrade Agency', query: 'Switch to Agency Mode' },
      ];
    } else if (path === '/clients') {
      actions = [
        { icon: FileText, label: 'New Proposal', query: 'Create a proposal for a client' },
        { icon: DollarSign, label: 'New Invoice', query: 'Generate an invoice' },
        { icon: Users, label: 'Client Insights', query: 'Show me insights about my clients' },
      ];
    } else if (path === '/projects') {
      actions = [
        { icon: FileText, label: 'Project Proposal', query: 'Create proposal for a project' },
        { icon: DollarSign, label: 'Invoice Project', query: 'Create invoice for completed project' },
        { icon: TrendingUp, label: 'Pipeline Value', query: 'Show me my project pipeline value' },
      ];
    } else if (path === '/proposals') {
      actions = [
        { icon: FileText, label: 'New Proposal', query: 'Create a new proposal' },
        { icon: Send, label: 'Send Proposal', query: 'Help me send a proposal to a client' },
      ];
    } else if (path === '/invoices') {
      actions = [
        { icon: DollarSign, label: 'New Invoice', query: 'Create a new invoice' },
        { icon: Send, label: 'Send Invoice', query: 'Help me send an invoice' },
        { icon: TrendingUp, label: 'Revenue Summary', query: 'Show me my revenue summary' },
      ];
    } else if (path === '/finances') {
      actions = [
        { icon: TrendingUp, label: 'Cashflow Forecast', query: 'Forecast my cashflow' },
        { icon: DollarSign, label: 'Revenue Analysis', query: 'Analyze my revenue trends' },
      ];
    } else {
      actions = [
        { icon: FileText, label: 'Create Proposal', query: 'Create a proposal' },
        { icon: DollarSign, label: 'Generate Invoice', query: 'Generate an invoice' },
        { icon: TrendingUp, label: 'Business Insights', query: 'Show me business insights' },
      ];
    }

    setQuickActions(actions.slice(0, 4));
  };

  const handleQuickAction = (query: string) => {
    setInput(query);
    setTimeout(() => handleSend(), 100);
  };

  const handleAction = async (action: string, actionData: any) => {
    switch (action) {
      case 'create_proposal':
        if (actionData?.clientId) {
          navigate(`/proposals?create=true&clientId=${actionData.clientId}`);
          toast.success('Opening proposal creator...');
        } else {
          navigate('/proposals?create=true');
          toast.info('Please select a client for the proposal');
        }
        break;

      case 'create_invoice':
        if (actionData?.projectId) {
          navigate(`/invoices?create=true&projectId=${actionData.projectId}`);
          toast.success('Opening invoice creator...');
        } else {
          navigate('/invoices?create=true');
          toast.info('Please select a project for the invoice');
        }
        break;

      case 'show_forecast':
        navigate('/dashboard/finances');
        toast.success('Showing financial forecast...');
        break;

      case 'upgrade_agency':
        // Trigger upgrade modal (would need to be implemented in parent)
        toast.info('Opening Agency Mode upgrade...');
        navigate('/dashboard?upgrade=true');
        break;

      case 'navigate':
        if (actionData?.path) {
          navigate(actionData.path);
          toast.success(`Navigating to ${actionData.path}...`);
        }
        break;

      case 'open_command_bar':
        toast.info('Use the command bar to update your business OS', { duration: 4000 });
        break;

      default:
        console.log('Unknown action:', action);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      const { data, error } = await supabase.functions.invoke<AIResponse>('ai-gateway', {
        body: {
          mode: 'chat',
          message: input,
          current_page: location.pathname,
        },
      });

      if (error || !data) {
        const errorMsg = await error?.context?.text();
        console.error('AI Copilot error:', errorMsg || error?.message);
        throw new Error('Failed to get AI response');
      }

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message || "I'm not sure how to respond to that.",
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, aiMessage]);

      // Handle action if present
      if (data.action && data.actionData) {
        await handleAction(data.action, data.actionData);
      }

      // Update suggestions
      if (data.suggestions && data.suggestions.length > 0) {
        setSuggestions(data.suggestions);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm having trouble processing that request. Please try again.",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      toast.error('AI Copilot error. Please try again.');
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
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
            <h3 className="font-semibold text-sm">AI Copilot</h3>
            <p className="text-xs text-emerald-600 dark:text-emerald-400">Context-aware assistant</p>
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
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      message.role === 'user'
                        ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg p-3 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                    <span className="text-sm text-muted-foreground">Thinking...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* AI Suggestions */}
          {suggestions.length > 0 && (
            <div className="px-4 py-2 border-t bg-emerald-500/5">
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-2 font-medium">💡 Suggestions:</p>
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
              <p className="text-xs text-muted-foreground mb-2">⚡ Quick actions:</p>
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
