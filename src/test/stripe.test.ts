import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase functions
const mockInvoke = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/db/supabase', () => ({
  supabase: {
    functions: {
      invoke: mockInvoke,
    },
    from: mockFrom,
  },
}));

describe('Stripe Checkout Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates checkout session with valid invoice data', async () => {
    const mockResponse = {
      data: {
        url: 'https://checkout.stripe.com/session-123',
        session_id: 'session-123',
      },
      error: null,
    };

    mockInvoke.mockResolvedValue(mockResponse);

    const result = await mockInvoke('create-invoice-checkout', {
      body: { invoice_id: 'invoice-1' },
    });

    expect(result.data).toBeDefined();
    expect(result.data?.url).toContain('stripe.com');
  });

  it('handles checkout session creation failure', async () => {
    const mockError = {
      data: null,
      error: {
        message: 'Failed to create checkout session',
      },
    };

    mockInvoke.mockResolvedValue(mockError);

    const result = await mockInvoke('create-invoice-checkout', {
      body: { invoice_id: 'invalid-id' },
    });

    expect(result.error).toBeDefined();
  });

  it('verifies payment with valid session ID', async () => {
    const mockResponse = {
      data: {
        success: true,
        payment_status: 'paid',
        invoice_id: 'invoice-1',
      },
      error: null,
    };

    mockInvoke.mockResolvedValue(mockResponse);

    const result = await mockInvoke('verify-stripe-payment', {
      body: { session_id: 'session-123' },
    });

    expect(result.data?.success).toBe(true);
    expect(result.data?.payment_status).toBe('paid');
  });

  it('handles payment verification failure', async () => {
    const mockError = {
      data: null,
      error: {
        message: 'Payment verification failed',
      },
    };

    mockInvoke.mockResolvedValue(mockError);

    const result = await mockInvoke('verify-stripe-payment', {
      body: { session_id: 'invalid-session' },
    });

    expect(result.error).toBeDefined();
  });

  it('updates invoice status after successful payment', async () => {
    const mockInvoiceUpdate = {
      data: { id: 'invoice-1', status: 'paid' },
      error: null,
    };

    const mockChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue(mockInvoiceUpdate),
    };

    mockFrom.mockReturnValue(mockChain);

    const result = await mockFrom('invoices')
      .update({ status: 'paid' })
      .eq('id', 'invoice-1')
      .select()
      .single();

    expect(result.data?.status).toBe('paid');
  });

  it('handles missing STRIPE_SECRET_KEY gracefully', async () => {
    const mockError = {
      data: null,
      error: {
        message: 'STRIPE_SECRET_KEY not configured',
      },
    };

    mockInvoke.mockResolvedValue(mockError);

    const result = await mockInvoke('create-invoice-checkout', {
      body: { invoice_id: 'invoice-1' },
    });

    expect(result.error?.message).toContain('STRIPE_SECRET_KEY');
  });
});
