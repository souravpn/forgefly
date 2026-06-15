import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const HAIKU = 'claude-haiku-4-5-20251001';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are a reply classifier and response drafter for a freelancer outreach tool.

Given a reply from a prospective client, you must:
1. Classify the intent precisely
2. Draft the ideal response for the freelancer to send

Output ONLY valid JSON. No preamble, no markdown fences.

{
  "intent": "soft_defer" | "hard_no" | "interested" | "wants_material" | "objection" | "auto_reply",
  "timing_signal": "this_quarter" | "next_quarter" | "specific_date" | "no_timeline" | null,
  "tone": "warm" | "neutral" | "cold",
  "confidence": "high" | "medium" | "low",
  "recommended_pipeline_action": "pause_with_reminder" | "close_lost" | "advance_to_contacted" | "send_material" | "address_objection",
  "reminder_weeks": number | null,
  "classification_reasoning": "one sentence explaining the call",
  "draft_response": "the full response text the freelancer should send — no [placeholder] except [Your name]",
  "draft_subject": "email subject if this warrants an email reply, else null",
  "user_facing_label": "short label shown above the draft, e.g. 'Q3 hold — keep warm, don't push'"
}

Classification rules:
- soft_defer: they want to wait, timing is bad, but door is open — set reminder_weeks to 8–12
- hard_no: clear rejection, no reopening signal
- interested: they want to learn more, move forward, or schedule a call
- wants_material: they ask for a portfolio, deck, pricing, or more info
- objection: they raise a concern that needs addressing before moving on
- auto_reply: out-of-office, vacation, or clearly automated response — no action needed

CRITICAL: A reply about timing ("late this quarter", "not now", "maybe next year") is ALWAYS soft_defer, NOT interested.
A warm tone does NOT mean interested — read the actual decision signal, not the pleasantries.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json() as {
      reply_text: string;
      freelancer_name: string;
      freelancer_services: string[];
      company_name: string;
      current_step: string;
      step_copy_summary: string;
    };

    if (!body.reply_text) {
      return new Response(JSON.stringify({ error: 'reply_text required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userContent = `Freelancer context:
- Name: ${body.freelancer_name ?? 'the freelancer'}
- Services: ${(body.freelancer_services ?? []).join(', ')}
- Target company: ${body.company_name ?? 'the company'}
- Outreach step they replied to: ${body.current_step ?? 'initial contact'} (${body.step_copy_summary ?? ''})

Reply received:
"${body.reply_text}"`;

    const res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY!,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: HAIKU,
        max_tokens: 600,
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
      }),
    });

    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
    const aiData = await res.json();
    const raw = aiData.content[0]?.text ?? '{}';

    let result: unknown;
    try {
      result = JSON.parse(raw.replace(/```(?:json)?\n?/g, '').replace(/```/g, '').trim());
    } catch {
      throw new Error('Failed to parse Anthropic response as JSON');
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('handle-reply-intent error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
