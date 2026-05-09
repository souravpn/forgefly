import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar as CalendarIcon } from 'lucide-react';

export default function CalendarPage() {
  const events = [
    { id: '1', title: 'Client Meeting - TechStart', date: '2026-05-15', time: '10:00 AM', type: 'meeting' },
    { id: '2', title: 'Project Deadline - Design Co', date: '2026-05-20', time: 'All Day', type: 'deadline' },
    { id: '3', title: 'Invoice Due - Marketing Pro', date: '2026-05-18', time: 'All Day', type: 'payment' },
    { id: '4', title: 'Follow-up Call - Startup Labs', date: '2026-05-22', time: '2:00 PM', type: 'meeting' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-balance mb-2">Calendar</h1>
        <p className="text-muted-foreground">Manage your schedule and deadlines</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-balance">Upcoming Events</CardTitle>
          <CardDescription>Your schedule for the next 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {events.map((event) => (
              <div key={event.id} className="flex items-center gap-4 p-4 rounded-lg bg-muted">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <CalendarIcon className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-balance">{event.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {new Date(event.date).toLocaleDateString()} • {event.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
