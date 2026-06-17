import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const SONNET = 'claude-sonnet-4-6';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ReceiptData = {
  vendor: string | null;
  amount: number | null;
  date: string | null;
  description: string | null;
  suggested_category: string | null;
  confidence: 'high' | 'medium' | 'low';
  notes: string | null;
};

const SYSTEM_PROMPT = `You are a receipt OCR assistant. Extract structured data from receipt images.

Return ONLY a JSON object with these fields (no markdown fences, no extra text):
{
  "vendor": "store or merchant name, or null if unclear",
  "amount": total amount as a number (no currency symbol), or null if unclear,
  "date": "YYYY-MM-DD format, or null if not visible",
  "description": "brief description of what was purchased, or null",
  "suggested_category": one of: software_subscriptions|hardware_equipment|phone_internet|marketing_advertising|professional_development|bank_fees|office_supplies|travel|meals_clients|professional_services|cogs_materials|cogs_packaging|contractor_payments|other,
  "confidence": "high" if most fields are clear, "medium" if some fields are unclear, "low" if the image is hard to read,
  "notes": "any relevant notes like partial receipt, tip included, etc., or null"
}

Category mapping guidance:
- Restaurant, coffee shop, food → meals_clients
- Airlines, hotels, Airbnb, Uber/Lyft for travel → travel
- Amazon, Best Buy, electronics → hardware_equipment
- Adobe, Figma, Notion, SaaS tools → software_subscriptions
- Facebook Ads, Google Ads → marketing_advertising
- Staples, office depot → office_supplies
- Accounting, legal, consulting → professional_services
- Bank, Stripe, PayPal fees → bank_fees`;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json() as { imageBase64?: string; mimeType?: string };

    if (!body.imageBase64 || !body.mimeType) {
      return new Response(JSON.stringify({ error: 'imageBase64 and mimeType are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const validMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validMimeTypes.includes(body.mimeType)) {
      return new Response(JSON.stringify({ error: 'Unsupported image type. Use JPEG, PNG, GIF, or WebP.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY!,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: SONNET,
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: body.mimeType,
                  data: body.imageBase64,
                },
              },
              {
                type: 'text',
                text: 'Extract all receipt data from this image and return the JSON object.',
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Anthropic ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const raw = data.content[0]?.text ?? '';

    let extracted: ReceiptData;
    try {
      extracted = JSON.parse(raw.replace(/```(?:json)?\n?/g, '').replace(/```/g, '').trim());
    } catch {
      throw new Error('Failed to parse receipt data from AI response');
    }

    return new Response(JSON.stringify(extracted), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('extract-receipt error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
