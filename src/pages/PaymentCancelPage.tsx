import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { XCircle, ArrowLeft, CreditCard } from 'lucide-react';

export default function PaymentCancelPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [invoiceId] = useState(searchParams.get('invoice_id'));

  useEffect(() => {
    if (!invoiceId) {
      navigate('/dashboard/invoices');
    }
  }, [invoiceId, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-6 animate-in zoom-in duration-500">
            <XCircle className="w-10 h-10 text-muted-foreground" />
          </div>
          
          <h1 className="text-2xl md:text-3xl font-bold mb-3 text-balance">Payment Cancelled</h1>
          <p className="text-muted-foreground mb-8 text-pretty">
            Your payment was not processed. The invoice remains unpaid and you can try again whenever you're ready.
          </p>

          <div className="flex flex-col gap-3">
            <Button
              size="lg"
              className="w-full glow-accent"
              onClick={() => navigate('/dashboard/invoices')}
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Try Again
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="w-full"
              onClick={() => navigate('/dashboard')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
