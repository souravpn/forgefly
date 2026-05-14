# AI Copilot - Quick Setup Guide

## 1. Get OpenAI API Key

1. Go to https://platform.openai.com
2. Sign up or log in to your account
3. Navigate to **API Keys** section
4. Click **Create new secret key**
5. Copy the key (starts with `sk-`)
6. **Important**: Keep this key secure!

## 2. Add API Key to Supabase

The system will automatically prompt you to add the `OPENAI_API_KEY` when you first try to use the AI Copilot.

## 3. Test the AI Copilot

### Basic Test:
1. Click the floating emerald button (bottom right corner)
2. AI Copilot panel opens
3. Try a quick action chip (e.g., "Create Proposal")
4. Or type: "Show me my clients"
5. AI responds with your actual business data!

### Advanced Test:
1. Navigate to different pages (Clients, Projects, Proposals, etc.)
2. Notice how quick actions change based on context
3. Try natural language queries:
   - "Create a proposal for [Client Name]"
   - "Generate an invoice for Project X"
   - "Show me my revenue forecast"
   - "Switch to Agency Mode"

## 4. Features to Demo

### Context Awareness:
- AI knows your clients, projects, proposals, invoices
- AI knows your subscription tier
- AI knows which page you're on

### Natural Actions:
- "Create a proposal for TechStart Inc" → Opens proposal creator
- "Generate an invoice" → Opens invoice creator
- "Show cashflow forecast" → Navigates to Finances
- "Switch to Agency Mode" → Opens upgrade modal

### Smart Suggestions:
- After each response, AI provides 3 follow-up suggestions
- Click suggestions to instantly execute them
- Suggestions are contextual to your conversation

### Beautiful UI:
- Emerald gradient floating button
- Smooth animations
- Loading states with spinner
- User messages: Emerald gradient
- AI messages: Muted background
- Quick action chips with icons

## 5. Example Queries

Try these to showcase the AI Copilot:

```
"Show me my business overview"
"Who are my top clients?"
"Create a proposal for [Client Name]"
"Generate an invoice for [Project Name]"
"What's my revenue forecast?"
"Show me unpaid invoices"
"Switch to Agency Mode"
"Take me to the finances page"
"Help me with proposals"
```

## 6. OpenAI Pricing

**GPT-4o Pricing** (as of 2024):
- Input: $5 per 1M tokens
- Output: $15 per 1M tokens

**Typical Usage**:
- Each query: ~500-1000 tokens
- Cost per query: ~$0.01-0.02
- 100 queries: ~$1-2

**Free Tier**:
- OpenAI offers $5 free credits for new accounts
- Perfect for testing and demos!

## 7. Troubleshooting

### "AI service not configured" error:
- OpenAI API key not set
- Add the key in Supabase Edge Function secrets

### "Failed to get AI response" error:
- Check OpenAI API key is valid
- Verify you have credits in your OpenAI account
- Check browser console for detailed errors

### Actions not executing:
- Verify you're logged in
- Check browser console for navigation errors
- Ensure pages exist (e.g., /proposals, /invoices)

### Context not loading:
- Verify Supabase connection
- Check RLS policies allow data access
- Ensure you have some data (clients, projects, etc.)

## 8. Demo Script for Hackathon

### Opening (30 seconds):
1. Click AI Copilot button
2. Say: "This is our AI Copilot - it has full awareness of my business"
3. Type: "Show me my clients"
4. AI lists actual clients from database

### Action Demo (30 seconds):
1. Type: "Create a proposal for [Client Name]"
2. AI opens proposal creator with client pre-selected
3. Show how natural language triggers real actions

### Context Demo (30 seconds):
1. Navigate to Finances page
2. Notice quick actions change
3. Type: "What's my revenue forecast?"
4. AI shows financial insights with actual data

### Upgrade Demo (30 seconds):
1. Type: "Switch to Agency Mode"
2. AI explains benefits
3. Opens upgrade modal
4. Show the premium experience

### Closing (30 seconds):
1. Highlight key features:
   - Full business context
   - Natural language actions
   - Smart suggestions
   - Beautiful UI
2. "This is the future of business automation!"

## 9. Files Modified

- `supabase/functions/ai-copilot/index.ts` - Edge Function with OpenAI integration
- `src/components/layouts/AICopilot.tsx` - Frontend component
- `AI_COPILOT.md` - Comprehensive documentation
- `AI_COPILOT_SETUP.md` - This quick setup guide

## 10. Key Highlights

✅ **Full Business Context**
- Knows your clients, projects, proposals, invoices
- Aware of subscription tier
- Understands current page

✅ **Natural Language Actions**
- Create proposals and invoices
- Navigate pages
- Show forecasts
- Upgrade subscription

✅ **Smart Suggestions**
- Context-aware follow-ups
- Page-specific quick actions
- Clickable for instant execution

✅ **Beautiful UI**
- Emerald gradient design
- Smooth animations
- Loading states
- Premium feel

✅ **Production Ready**
- Error handling
- Loading states
- Null checks
- Lint passing

**Perfect for the Build with MeDo Hackathon!** 🚀✨🤖

---

## Quick Reference

**OpenAI API**: https://platform.openai.com/api-keys
**Model**: GPT-4o
**Cost**: ~$0.01-0.02 per query
**Free Credits**: $5 for new accounts

**Test Query**: "Show me my clients"
**Demo Query**: "Create a proposal for [Client Name]"
**Wow Query**: "What's my revenue forecast?"

**Floating Button**: Bottom right corner (emerald gradient)
**Panel Size**: 96 width x 600px height
**Response Time**: 2-5 seconds

**Magic Moment**: When AI lists actual clients from database! 🎉
