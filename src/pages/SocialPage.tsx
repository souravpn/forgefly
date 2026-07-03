import { Card, CardContent } from '@/components/ui/card';
import { Share2 } from 'lucide-react';

export default function SocialPage() {
  return (
    <div className="space-y-6 md:space-y-8">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-balance mb-1">Social</h1>
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
            <Share2 className="w-8 h-8 text-accent" />
          </div>
          <p className="text-muted-foreground max-w-md text-pretty">
            Coming soon. This is going to keep track of all your social commerce side — including social storefronts, listening, updates, sentiment check, etc.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
