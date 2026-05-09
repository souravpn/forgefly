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
      return "I can help you create a proposal! Based on your business profile, I'll generate a professional proposal. Would you like me to create one for a specific client?";
    }
    if (lowerQuery.includes('invoice')) {
      return "I'll help you create an invoice. Please provide the client name and project details, or I can pull from your existing projects.";
    }
    if (lowerQuery.includes('email')) {
      return "I can draft a professional email for you. What's the purpose of the email? (e.g., follow-up, project update, payment reminder)";
    }
    if (lowerQuery.includes('automation')) {
      return "Here are some automation suggestions:\n\n1. Send payment reminders 3 days before invoice due date\n2. Create follow-up tasks when proposals are sent\n3. Notify when projects move to 'Review' stage\n\nWould you like me to set up any of these?";
    }
    if (lowerQuery.includes('cashflow') || lowerQuery.includes('finance')) {
      return "Based on your current data:\n\n• Average monthly income: $8,400\n• Projected next month: $9,200\n• Outstanding invoices: $3,500\n\nWould you like me to create a detailed cashflow forecast?";
    }
    
    return "I'm here to help! I can assist with:\n\n• Generating proposals and contracts\n• Creating invoices\n• Drafting client emails\n• Setting up automations\n• Analyzing your business data\n\nWhat would you like to work on?";
  };

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <Button
          size="lg"
          className="fixed bottom-6 right-6 z-50 rounded-full w-14 h-14 shadow-lg glow-primary"
          onClick={() => setIsOpen(true)}
        >
          <Sparkles className="w-6 h-6" />
        </Button>
      )}

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
