import { Card, CardContent } from '@/components/ui/card';
import { Layers } from 'lucide-react';

export default function ProjectPage() {
  return (
    <div className="space-y-6 md:space-y-8">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-balance mb-1">Project</h1>
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
            <Layers className="w-8 h-8 text-accent" />
          </div>
          <p className="text-muted-foreground max-w-md text-pretty">
            Coming soon. This will be atomic projects that are part of either a lead, proposal, or standalone.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
