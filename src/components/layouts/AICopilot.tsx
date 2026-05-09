import { useState } from 'react';
import { MessageSquare, X, Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ChatMessage } from '@/types/types';

export function AICopilot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm your AI Co-pilot. I can help you generate proposals, draft emails, create invoices, and answer business questions. What would you like to do?",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

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

    // Simulate AI response
    setTimeout(() => {
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: getAIResponse(input),
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMessage]);
      setIsTyping(false);
    }, 1000);
  };

  const getAIResponse = (query: string): string => {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('proposal')) {
      return "✨ I'll help you create a winning proposal!\n\nHere's what I can generate:\n\n📄 **Professional Proposal Template**\n• Cover page with your branding\n• Service description\n• Detailed pricing breakdown\n• Timeline and deliverables\n• Terms and conditions\n\nWould you like me to:\n1. Create a proposal for TechStart Inc ($3,200 brand identity project)\n2. Generate a custom proposal for a new client\n3. Show you proposal best practices\n\nJust let me know which option!";
    }
    if (lowerQuery.includes('invoice')) {
      return "💰 Let me help you create an invoice!\n\n**Quick Invoice Options:**\n\n1. **TechStart Inc** - Brand Identity Project ($3,200)\n2. **Design Co** - Marketing Campaign ($1,800)\n3. **Custom Invoice** - For a new project\n\nI'll include:\n• Professional invoice number\n• Itemized services\n• Payment terms\n• Your business branding\n\nWhich would you like to create?";
    }
    if (lowerQuery.includes('email')) {
      return "📧 I can draft professional emails for you!\n\n**Email Templates Available:**\n\n1. **Follow-up Email** - After sending a proposal\n   \"Hi [Client], I wanted to follow up on the proposal I sent...\"\n\n2. **Project Update** - Keep clients informed\n   \"Great progress on your project! Here's what we've completed...\"\n\n3. **Payment Reminder** - Gentle nudge for overdue invoices\n   \"Just a friendly reminder about invoice #...\"\n\n4. **Thank You Note** - After project completion\n   \"It was a pleasure working with you on...\"\n\nWhich type would you like me to draft?";
    }
    if (lowerQuery.includes('automation')) {
      return "⚡ Smart Automation Suggestions:\n\n**High-Impact Automations:**\n\n1. **Payment Reminders** 💸\n   • Auto-send 3 days before due date\n   • Follow-up 1 day after overdue\n   • Saves 5+ hours/month\n\n2. **Proposal Follow-ups** 📨\n   • Auto-create task 3 days after sending\n   • Track proposal opens\n   • Increase close rate by 30%\n\n3. **Project Status Updates** 📊\n   • Notify clients when status changes\n   • Auto-generate progress reports\n   • Improve client satisfaction\n\n4. **Welcome Sequence** 👋\n   • Send onboarding email to new clients\n   • Share important documents\n   • Set professional first impression\n\nWhich automation should I set up first?";
    }
    if (lowerQuery.includes('cashflow') || lowerQuery.includes('finance')) {
      return "📊 **Your Financial Snapshot:**\n\n**Current Month:**\n• Revenue: $9,500\n• Expenses: $3,100\n• Net Profit: $6,400 (67% margin)\n\n**Outstanding:**\n• Pending Invoices: $6,500 (4 invoices)\n• Overdue: $3,200 (1 invoice - Marketing Pro)\n\n**Projections:**\n• Next Month: $10,200 (+7.4%)\n• Q2 Total: $28,500\n• Annual Run Rate: $114,000\n\n**Recommendations:**\n1. Follow up on overdue invoice from Marketing Pro\n2. Your profit margin is excellent - consider raising rates\n3. Cash reserves look healthy for 2-3 months\n\nWant me to create a detailed cashflow forecast or help with invoice follow-ups?";
    }
    if (lowerQuery.includes('client') || lowerQuery.includes('crm')) {
      return "👥 **Client Management Insights:**\n\n**Active Clients:** 4\n• TechStart Inc - $8,400 lifetime value\n• Design Co - $5,500 lifetime value\n• Marketing Pro - $6,200 lifetime value\n• Startup Labs - $3,200 lifetime value\n\n**Recommendations:**\n1. **TechStart Inc** - Your top client! Consider upselling additional services\n2. **Marketing Pro** - Overdue invoice needs attention\n3. **Startup Labs** - New client, great opportunity to build relationship\n\n**Next Actions:**\n• Schedule check-in calls with top 2 clients\n• Send project update to Design Co\n• Follow up on Marketing Pro payment\n\nWant me to draft any of these communications?";
    }
    if (lowerQuery.includes('project')) {
      return "🚀 **Project Pipeline Overview:**\n\n**Active Projects:** 5\n\n📍 **Lead Stage:** 1 project\n• Product Packaging - $4,200 (Marketing Pro)\n\n⚙️ **In Progress:** 2 projects\n• Brand Identity Redesign - 65% complete\n• Pitch Deck Design - 40% complete\n\n👀 **Review:** 1 project\n• Marketing Campaign - 90% complete\n\n✅ **Completed:** 1 project\n• Website Graphics - $2,400\n\n**Insights:**\n• Total pipeline value: $11,700\n• Average project: $2,340\n• Completion rate: 20%\n\n**Suggestions:**\n1. Push Marketing Campaign to completion\n2. Follow up on Product Packaging lead\n3. Update clients on in-progress work\n\nNeed help with any specific project?";
    }
    
    return "👋 **Hi! I'm your AI Co-pilot.**\n\nI can help you with:\n\n💼 **Business Operations:**\n• Generate proposals and contracts\n• Create professional invoices\n• Draft client emails\n• Set up smart automations\n\n📊 **Insights & Analytics:**\n• Analyze cashflow and finances\n• Review client relationships\n• Track project progress\n• Forecast revenue\n\n✨ **Quick Actions:**\n• \"Create a proposal for [client]\"\n• \"Draft a follow-up email\"\n• \"Show me my finances\"\n• \"Set up payment reminders\"\n\nWhat would you like to work on?";
  };

  return (
    <>
      {/* Floating button - Always visible */}
      <Button
        size="lg"
        className={`fixed bottom-6 right-6 z-50 rounded-full w-16 h-16 shadow-2xl glow-accent transition-all ${
          isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'
        }`}
        onClick={() => setIsOpen(true)}
      >
        <Sparkles className="w-7 h-7 animate-pulse" />
      </Button>

      {/* Chat panel */}
      {isOpen && (
        <Card className="fixed bottom-6 right-6 z-50 w-96 h-[600px] shadow-2xl flex flex-col">
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">AI Co-pilot</h3>
                <p className="text-xs text-muted-foreground">Always here to help</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
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
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg p-3">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" />
                      <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce delay-100" />
                      <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce delay-200" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="p-4 border-t">
            <div className="flex gap-2">
              <Textarea
                placeholder="Ask me anything..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                className="min-h-[60px] resize-none"
              />
              <Button onClick={handleSend} size="icon" className="shrink-0">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}
    </>
  );
}
