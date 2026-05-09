import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Plus, Zap } from 'lucide-react';

export default function AutomationsPage() {
  const [automations, setAutomations] = useState([
    { id: '1', name: 'Payment Reminder', trigger: 'Invoice overdue by 3 days', action: 'Send email reminder', active: true },
    { id: '2', name: 'Proposal Follow-up', trigger: 'Proposal sent', action: 'Create follow-up task after 3 days', active: true },
    { id: '3', name: 'Project Status Update', trigger: 'Project moves to Review', action: 'Notify client via email', active: false },
    { id: '4', name: 'Welcome Email', trigger: 'New client added', action: 'Send welcome email with onboarding info', active: true },
  ]);

  const toggleAutomation = (id: string) => {
    setAutomations(prev =>
      prev.map(auto =>
        auto.id === id ? { ...auto, active: !auto.active } : auto
      )
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-balance mb-2">Automations</h1>
          <p className="text-muted-foreground">Automate your workflow and save time</p>
        </div>
        <Button onClick={() => {}}>
          <Plus className="w-4 h-4 mr-2" />
          New Automation
        </Button>
      </div>

      <div className="grid gap-4">
        {automations.map((automation) => (
          <Card key={automation.id}>
            <CardContent className="flex items-center justify-between p-6">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${
                  automation.active ? 'bg-primary/10' : 'bg-muted'
                }`}>
                  <Zap className={`w-6 h-6 ${automation.active ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg mb-1 text-balance">{automation.name}</h3>
                  <p className="text-sm text-muted-foreground mb-1">
                    <span className="font-medium">When:</span> {automation.trigger}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium">Then:</span> {automation.action}
                  </p>
                </div>
              </div>
              <Switch
                checked={automation.active}
                onCheckedChange={() => toggleAutomation(automation.id)}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
