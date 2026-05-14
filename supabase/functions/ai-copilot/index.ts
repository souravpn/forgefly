import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UserContext {
  profile: any;
  clients: any[];
  projects: any[];
  proposals: any[];
  invoices: any[];
  subscription: any;
  currentPage?: string;
}

function buildSystemPrompt(context: UserContext): string {
  const { profile, clients, projects, proposals, invoices, subscription } = context;
  
  return `You are Forgefly AI Copilot, an intelligent business assistant for ${profile?.username || 'the user'}.

BUSINESS CONTEXT:
- User: ${profile?.username || 'Unknown'}
- Subscription: ${subscription?.tier || 'freelancer'} tier (${subscription?.status || 'active'})
- Clients: ${clients.length} total
- Active Projects: ${projects.filter((p: any) => p.status === 'in_progress').length}
- Pending Proposals: ${proposals.filter((p: any) => p.status === 'pending').length}
- Unpaid Invoices: ${invoices.filter((i: any) => i.payment_status === 'unpaid').length}

AVAILABLE CLIENTS:
${clients.slice(0, 10).map((c: any) => `- ${c.name} (${c.email || 'no email'})`).join('\n')}

ACTIVE PROJECTS:
${projects.filter((p: any) => p.status === 'in_progress').slice(0, 5).map((p: any) => `- ${p.name} (Client: ${p.client?.name || 'Unknown'})`).join('\n')}

CAPABILITIES:
You can help with:
1. Creating proposals for clients
2. Generating invoices for projects
3. Showing financial forecasts and analytics
4. Managing clients and projects
5. Upgrading to Agency Mode
6. Navigating the application
7. Answering business questions

RESPONSE FORMAT:
Always respond in JSON format with this structure:
{
  "message": "Your helpful response to the user",
  "action": "action_name" | null,
  "actionData": { /* action-specific data */ } | null,
  "suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"]
}

AVAILABLE ACTIONS:
- "create_proposal": Create a new proposal (requires clientId)
- "create_invoice": Create a new invoice (requires projectId)
- "show_forecast": Show financial forecast
- "upgrade_agency": Open Agency Mode upgrade modal
- "navigate": Navigate to a page (requires path)
- "query_data": Query specific data

IMPORTANT:
- Be concise and helpful
- Always provide actionable suggestions
- Use the user's business context to personalize responses
- If the user asks to create something, return the appropriate action
- If you need more information, ask clarifying questions

Current Page: ${context.currentPage || 'dashboard'}`;
}

async function fetchUserContext(supabaseClient: any, userId: string): Promise<UserContext> {
  // Fetch profile
  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  // Fetch clients
  const { data: clients } = await supabaseClient
    .from('clients')
    .select('id, name, email, company')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  // Fetch projects
  const { data: projects } = await supabaseClient
    .from('projects')
    .select('id, name, status, client:clients(name)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  // Fetch proposals
  const { data: proposals } = await supabaseClient
    .from('proposals')
    .select('id, title, status')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);

  // Fetch invoices
  const { data: invoices } = await supabaseClient
    .from('invoices')
    .select('id, invoice_number, amount, payment_status')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);

  // Fetch subscription
  const { data: subscription } = await supabaseClient
    .from('subscriptions')
    .select('tier, status, billing_cycle')
    .eq('user_id', userId)
    .single();

  return {
    profile,
    clients: clients || [],
    projects: projects || [],
    proposals: proposals || [],
    invoices: invoices || [],
    subscription,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { message, currentPage } = await req.json();

    // Fetch user context
    const context = await fetchUserContext(supabaseClient, user.id);
    context.currentPage = currentPage;

    // Build system prompt with context
    const systemPrompt = buildSystemPrompt(context);

    // Call OpenAI API
    const openaiResponse = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
        ],
        temperature: 0.7,
        max_tokens: 1000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!openaiResponse.ok) {
      const error = await openaiResponse.text();
      console.error('OpenAI API error:', error);
      return new Response(
        JSON.stringify({ error: 'AI service error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openaiData = await openaiResponse.json();
    const aiResponse = JSON.parse(openaiData.choices[0].message.content);

    // Log the interaction
    console.log(`AI Copilot: User ${user.id} asked: "${message}"`);
    console.log(`AI Copilot: Response action: ${aiResponse.action || 'none'}`);

    return new Response(
      JSON.stringify(aiResponse),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in AI Copilot:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        message: "I'm having trouble processing that request. Please try again.",
        suggestions: ["Show my clients", "Create a proposal", "View dashboard"]
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
