import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Sparkles, Users, Zap, Crown } from 'lucide-react';
import { supabase } from '@/db/supabase';
import { toast } from 'sonner';

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UpgradeModal({ open, onOpenChange }: UpgradeModalProps) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(false);

  const monthlyPrice = 29;
  const yearlyPrice = 290;
  const yearlySavings = monthlyPrice * 12 - yearlyPrice;

  const freelancerFeatures = [
    'Up to 5 active clients',
    'Basic project tracking',
    'AI proposal generation',
    'Invoice management',
    'Financial dashboard',
    'Email support'
  ];

  const agencyFeatures = [
    'Unlimited clients',
    'Advanced project tracking',
    'AI proposal generation',
    'Invoice management',
    'Financial dashboard',
    'Team member management',
    'Advanced proposal templates',
    'Priority support',
    'Custom branding',
    'API access'
  ];

  const handleUpgrade = async () => {
    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please sign in to upgrade');
        return;
      }

      // Call Edge Function to create Stripe checkout session
      const { data, error } = await supabase.functions.invoke('create-subscription-checkout', {
        body: {
          billingCycle,
          successUrl: `${window.location.origin}/dashboard?upgrade=success`,
          cancelUrl: `${window.location.origin}/dashboard?upgrade=cancelled`
        }
      });

      if (error) {
        const errorMsg = await error?.context?.text();
        console.error('Checkout error:', errorMsg || error?.message);
        toast.error('Failed to start checkout. Please try again.');
        return;
      }

      if (data?.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else {
        toast.error('Failed to create checkout session');
      }
    } catch (err) {
      console.error('Upgrade error:', err);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-5xl max-h-[90vh] overflow-y-auto bg-[#0A1428] border-white/10">
        <DialogHeader>
          <DialogTitle className="text-3xl font-bold text-white text-center mb-2">
            Upgrade to Agency Mode
          </DialogTitle>
          <p className="text-gray-400 text-center text-lg">
            Unlock powerful features to scale your business
          </p>
        </DialogHeader>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 my-6">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-6 py-2 rounded-lg font-medium transition-all ${
              billingCycle === 'monthly'
                ? 'bg-emerald-500 text-white'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle('yearly')}
            className={`px-6 py-2 rounded-lg font-medium transition-all relative ${
              billingCycle === 'yearly'
                ? 'bg-emerald-500 text-white'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            Yearly
            <Badge className="absolute -top-2 -right-2 bg-amber-500 text-white text-xs">
              Save ${yearlySavings}
            </Badge>
          </button>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Freelancer Plan */}
          <Card className="bg-white/5 border-white/10 relative">
            <CardContent className="p-8">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-6 h-6 text-blue-400" />
                <h3 className="text-2xl font-bold text-white">Freelancer</h3>
              </div>
              
              <div className="mb-6">
                <div className="text-4xl font-bold text-white mb-2">Free</div>
                <p className="text-gray-400">Perfect for getting started</p>
              </div>

              <div className="space-y-3 mb-8">
                {freelancerFeatures.map((feature, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                    <span className="text-gray-300">{feature}</span>
                  </div>
                ))}
              </div>

              <div className="w-full px-4 py-2 rounded-md border border-white/20 text-white text-center text-sm font-medium opacity-50 cursor-not-allowed">
                Current Plan
              </div>
            </CardContent>
          </Card>

          {/* Agency Plan */}
          <Card className="bg-gradient-to-br from-emerald-500/10 via-amber-500/10 to-emerald-500/10 border-emerald-500/30 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge className="bg-gradient-to-r from-emerald-500 to-amber-500 text-white px-4 py-1 text-sm font-semibold">
                <Crown className="w-4 h-4 mr-1" />
                RECOMMENDED
              </Badge>
            </div>

            <CardContent className="p-8">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-6 h-6 text-emerald-400" />
                <h3 className="text-2xl font-bold text-white">Agency</h3>
              </div>
              
              <div className="mb-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-white">
                    ${billingCycle === 'monthly' ? monthlyPrice : yearlyPrice}
                  </span>
                  <span className="text-gray-400">
                    /{billingCycle === 'monthly' ? 'month' : 'year'}
                  </span>
                </div>
                {billingCycle === 'yearly' && (
                  <p className="text-emerald-400 text-sm mt-1">
                    Save ${yearlySavings}/year
                  </p>
                )}
                <p className="text-gray-400 mt-2">Scale your agency with confidence</p>
              </div>

              <div className="space-y-3 mb-8">
                {agencyFeatures.map((feature, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="text-gray-300">{feature}</span>
                  </div>
                ))}
              </div>

              <Button
                className="w-full bg-gradient-to-r from-emerald-500 to-amber-500 hover:from-emerald-600 hover:to-amber-600 text-white font-semibold"
                onClick={handleUpgrade}
                disabled={loading}
              >
                {loading ? (
                  'Processing...'
                ) : (
                  <>
                    <Zap className="w-5 h-5 mr-2" />
                    Upgrade Now
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Trust Badges */}
        <div className="mt-6 text-center text-sm text-gray-400">
          <p>🔒 Secure payment powered by Stripe • Cancel anytime • 30-day money-back guarantee</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
