import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Package, Palette, FileText, FileSignature, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { OnboardingPreview } from '@/types/types';

export default function OnboardingPage() {
  const [input, setInput] = useState('');
  const [previews, setPreviews] = useState<OnboardingPreview[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleInputChange = (value: string) => {
    setInput(value);
    
    if (value.length > 20) {
      setIsProcessing(true);
      setTimeout(() => {
        const generatedPreviews = parseBusinessDescription(value);
        setPreviews(generatedPreviews);
        setIsProcessing(false);
      }, 800);
    } else {
      setPreviews([]);
    }
  };

  const parseBusinessDescription = (description: string): OnboardingPreview[] => {
    const previews: OnboardingPreview[] = [];

    // Extract service type
    const serviceMatch = description.match(/(?:i'm a|i am a|freelance|work as a)\s+([a-z\s]+?)(?:\s+charging|\s+with|\s+offering|\.)/i);
    const serviceType = serviceMatch ? serviceMatch[1].trim() : 'creative professional';

    // Extract hourly rate
    const rateMatch = description.match(/\$?(\d+)(?:\/hr|\/hour|\s+per hour)/i);
    const hourlyRate = rateMatch ? Number.parseInt(rateMatch[1]) : 100;

    // Extract package count
    const packageMatch = description.match(/(\d+)\s+packages?/i);
    const packageCount = packageMatch ? Number.parseInt(packageMatch[1]) : 3;

    // Generate service packages
    const packages = generatePackages(serviceType, hourlyRate, packageCount);
    previews.push({
      type: 'package',
      title: 'Service Packages',
      content: `${packageCount} packages created`,
      details: { packages },
    });

    // Generate branding
    previews.push({
      type: 'branding',
      title: 'Branding Suggestions',
      content: 'Professional color palette and style guide',
      details: {
        colors: { primary: '#0A1428', accent: '#10B981', highlight: '#F59E0B' },
        style: 'Modern, premium, trustworthy',
      },
    });

    // Generate proposal template
    previews.push({
      type: 'proposal',
      title: 'Proposal Template',
      content: 'Ready-to-use proposal structure',
      details: {
        sections: ['Cover Page', 'About Me', 'Services', 'Pricing', 'Timeline', 'Terms'],
      },
    });

    // Generate contract template
    previews.push({
      type: 'contract',
      title: 'Contract Template',
      content: 'Professional service agreement',
      details: {
        sections: ['Scope of Work', 'Payment Terms', 'Deliverables', 'Rights & Ownership'],
      },
    });

    return previews;
  };

  const generatePackages = (serviceType: string, baseRate: number, count: number) => {
    const packages = [
      {
        name: 'Starter',
        price: baseRate * 5,
        description: `Essential ${serviceType} services for small projects`,
        features: ['5 hours of work', 'Basic deliverables', '1 revision round', 'Email support'],
      },
      {
        name: 'Professional',
        price: baseRate * 10,
        description: `Comprehensive ${serviceType} package for growing businesses`,
        features: ['10 hours of work', 'Premium deliverables', '3 revision rounds', 'Priority support', 'Source files included'],
      },
      {
        name: 'Enterprise',
        price: baseRate * 20,
        description: `Full-service ${serviceType} solution for established companies`,
        features: ['20 hours of work', 'Complete deliverables', 'Unlimited revisions', '24/7 support', 'All source files', 'Ongoing consultation'],
      },
    ];

    return packages.slice(0, count);
  };

  const handleLaunch = async () => {
    if (!user) {
      toast.error('Please log in to continue');
      return;
    }

    setIsLaunching(true);

    try {
      // Create business profile
      const packageDetails = previews.find(p => p.type === 'package')?.details?.packages || [];
      const serviceMatch = input.match(/(?:i'm a|i am a|freelance|work as a)\s+([a-z\s]+?)(?:\s+charging|\s+with|\s+offering|\.)/i);
      const serviceType = serviceMatch ? serviceMatch[1].trim() : 'creative professional';
      const rateMatch = input.match(/\$?(\d+)(?:\/hr|\/hour|\s+per hour)/i);
      const hourlyRate = rateMatch ? Number.parseInt(rateMatch[1]) : 100;

      const { error } = await supabase
        .from('business_profiles')
        .insert({
          user_id: user.id,
          business_name: `${serviceType.charAt(0).toUpperCase() + serviceType.slice(1)} Services`,
          business_description: input,
          service_type: serviceType,
          hourly_rate: hourlyRate,
          branding_colors: { primary: '#0A1428', accent: '#10B981', highlight: '#F59E0B' },
        });

      if (error) throw error;

      toast.success('Your Business OS is ready!', {
        description: 'Welcome to Forgefly',
      });

      setTimeout(() => {
        navigate('/dashboard');
      }, 1000);
    } catch (error) {
      console.error('Error creating business profile:', error);
      toast.error('Failed to create business profile');
      setIsLaunching(false);
    }
  };

  const getPreviewIcon = (type: string) => {
    switch (type) {
      case 'package':
        return Package;
      case 'branding':
        return Palette;
      case 'proposal':
        return FileText;
      case 'contract':
        return FileSignature;
      default:
        return Sparkles;
    }
  };

  return (
    <div className="min-h-screen bg-background p-6 md:p-12">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="w-10 h-10 text-primary" />
            <h1 className="text-5xl font-bold text-foreground">Forgefly</h1>
          </div>
          <p className="text-xl text-muted-foreground mb-2">Forge Your Freedom</p>
          <p className="text-sm text-muted-foreground">
            Describe your business and watch your back office come to life
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-balance">Describe Your Freelance Business</CardTitle>
                <CardDescription>
                  Tell us about your services, pricing, and what makes you unique
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Example: I'm a graphic designer charging $120/hr with 3 packages: Starter ($600), Pro ($1200), and Enterprise ($2400). I specialize in brand identity and digital design for tech startups..."
                  value={input}
                  onChange={(e) => handleInputChange(e.target.value)}
                  className="min-h-[300px] text-base"
                />
                {isProcessing && (
                  <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>AI is analyzing your business...</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {previews.length > 0 && (
              <Button
                size="lg"
                className="w-full text-lg h-14 glow-primary"
                onClick={handleLaunch}
                disabled={isLaunching}
              >
                {isLaunching ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Launching Your Business OS...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Launch My Business OS
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Preview Section */}
          <div className="space-y-4">
            {previews.length > 0 && (
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="secondary" className="text-sm">
                  <Sparkles className="w-3 h-3 mr-1" />
                  AI Generated Preview
                </Badge>
              </div>
            )}

            {previews.map((preview, index) => {
              const Icon = getPreviewIcon(preview.type);
              return (
                <Card
                  key={index}
                  className="animate-in fade-in slide-in-from-right-4"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base text-balance">{preview.title}</CardTitle>
                        <CardDescription className="text-sm">{preview.content}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  {preview.details && preview.type === 'package' && (
                    <CardContent>
                      <div className="space-y-3">
                        {(preview.details.packages as Array<{ name: string; price: number; description: string }>).map((pkg, i) => (
                          <div key={i} className="p-3 rounded-lg bg-muted">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-semibold text-sm">{pkg.name}</span>
                              <span className="text-sm font-bold text-primary">${pkg.price}</span>
                            </div>
                            <p className="text-xs text-muted-foreground text-pretty">{pkg.description}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}

            {previews.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <Sparkles className="w-12 h-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground text-pretty">
                    Start typing to see AI-generated previews of your business setup
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
