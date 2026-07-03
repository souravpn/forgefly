import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/db/supabase';
import { toast } from 'sonner';

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [sessionId] = useState(searchParams.get('session_id'));
  const [verifying, setVerifying] = useState(true);
  const [verified, setVerified] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      navigate('/dashboard/finances?tab=invoices');
      return;
    }

    verifyPayment();
  }, [sessionId, navigate]);

  async function verifyPayment() {
    try {
      setVerifying(true);
      
      const { data, error: invokeError } = await supabase.functions.invoke('verify-stripe-payment', {
        body: { sessionId },
      });

      if (invokeError) {
        const errorMsg = await invokeError?.context?.text();
        console.error('Payment verification error:', errorMsg || invokeError?.message);
        setError(errorMsg || 'Failed to verify payment');
        toast.error('Payment verification failed');
        return;
      }

      if (data?.data?.verified) {
        setVerified(true);
        setPaymentDetails(data.data);
        toast.success('Payment verified successfully!');
      } else {
        setError('Payment not completed');
        toast.error('Payment was not completed');
      }
    } catch (error) {
      console.error('Error verifying payment:', error);
      setError('Failed to verify payment');
      toast.error('Failed to verify payment');
    } finally {
      setVerifying(false);
    }
  }

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
            </div>
            
            <h1 className="text-2xl md:text-3xl font-bold mb-3 text-balance">Verifying Payment...</h1>
            <p className="text-muted-foreground text-pretty">
              Please wait while we confirm your payment with Stripe.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !verified) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-10 h-10 text-destructive" />
            </div>
            
            <h1 className="text-2xl md:text-3xl font-bold mb-3 text-balance">Payment Verification Failed</h1>
            <p className="text-muted-foreground mb-8 text-pretty">
              {error || 'We could not verify your payment. Please contact support if you were charged.'}
            </p>

            <div className="flex flex-col gap-3">
              <Button
                size="lg"
                className="w-full"
                onClick={() => navigate('/dashboard/finances?tab=invoices')}
              >
                Back to Invoices
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-6 animate-in zoom-in duration-500">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </div>
          
          <h1 className="text-2xl md:text-3xl font-bold mb-3 text-balance">Payment Successful!</h1>
          <p className="text-muted-foreground mb-8 text-pretty">
            Your payment has been processed successfully. The invoice has been marked as paid and you should receive a confirmation email shortly.
          </p>

          {paymentDetails && (
            <div className="bg-muted/50 rounded-lg p-4 mb-6 text-left space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Amount Paid</p>
                <p className="text-lg font-semibold">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: paymentDetails.currency?.toUpperCase() || 'USD',
                  }).format((paymentDetails.amount || 0) / 100)}
                </p>
              </div>
              {paymentDetails.customerEmail && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Receipt Email</p>
                  <p className="text-sm">{paymentDetails.customerEmail}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Transaction ID</p>
                <p className="text-xs font-mono break-all">{sessionId}</p>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <Button
              size="lg"
              className="w-full bg-emerald-500 hover:bg-emerald-600"
              onClick={() => navigate('/dashboard')}
            >
              Go to Dashboard
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="w-full"
              onClick={() => navigate('/dashboard/finances?tab=invoices')}
            >
              View Invoices
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
