import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Mail, Phone, Building2, DollarSign, Calendar, Users } from 'lucide-react';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Client, Project } from '@/types/types';

export default function ClientsPage() {
  const { clientId } = useParams();
  const [clients, setClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientProjects, setClientProjects] = useState<Project[]>([]);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      loadClients();
    }
  }, [user]);

  useEffect(() => {
    if (clientId && clients.length > 0) {
      const client = clients.find(c => c.id === clientId);
      if (client) {
        setSelectedClient(client);
        loadClientProjects(clientId);
      }
    }
  }, [clientId, clients]);

  const loadClients = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (data) {
      setClients(data);
    }
  };

  const loadClientProjects = async (clientId: string) => {
    const { data } = await supabase
      .from('projects')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (data) {
      setClientProjects(data);
    }
  };

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.company?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (selectedClient) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => {
            setSelectedClient(null);
            navigate('/clients');
          }}>
            ← Back to Clients
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-3xl text-balance">{selectedClient.name}</CardTitle>
                {selectedClient.company && (
                  <CardDescription className="text-lg mt-1">{selectedClient.company}</CardDescription>
                )}
              </div>
              <Badge variant={selectedClient.status === 'active' ? 'default' : 'secondary'}>
                {selectedClient.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              {selectedClient.email && (
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{selectedClient.email}</span>
                </div>
              )}
              {selectedClient.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{selectedClient.phone}</span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Total Value: ${selectedClient.total_value.toLocaleString()}</span>
              </div>
              {selectedClient.last_interaction && (
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">
                    Last Contact: {new Date(selectedClient.last_interaction).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>

            {selectedClient.notes && (
              <div>
                <h3 className="font-semibold mb-2">Notes</h3>
                <p className="text-sm text-muted-foreground text-pretty">{selectedClient.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-balance">Project History</CardTitle>
            <CardDescription>All projects with this client</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {clientProjects.map((project) => (
                <div key={project.id} className="p-4 rounded-lg bg-muted">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">{project.name}</h4>
                    <Badge variant="outline">{project.status.replace('_', ' ')}</Badge>
                  </div>
                  {project.description && (
                    <p className="text-sm text-muted-foreground mb-2 text-pretty">{project.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {project.value && <span>Value: ${project.value.toLocaleString()}</span>}
                    {project.deadline && (
                      <span>Deadline: {new Date(project.deadline).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              ))}
              {clientProjects.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8 text-pretty">
                  No projects yet with this client
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-balance mb-2">Clients</h1>
          <p className="text-muted-foreground">Manage your client relationships</p>
        </div>
        <Button onClick={() => {}}>
          <Plus className="w-4 h-4 mr-2" />
          Add Client
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredClients.map((client) => (
          <Card
            key={client.id}
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => {
              setSelectedClient(client);
              navigate(`/clients/${client.id}`);
            }}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg text-balance truncate">{client.name}</CardTitle>
                  {client.company && (
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <Building2 className="w-3 h-3 shrink-0" />
                      <span className="truncate">{client.company}</span>
                    </CardDescription>
                  )}
                </div>
                <Badge variant={client.status === 'active' ? 'default' : 'secondary'} className="shrink-0">
                  {client.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {client.email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="w-3 h-3 shrink-0" />
                    <span className="truncate">{client.email}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total Value</span>
                  <span className="font-semibold">${client.total_value.toLocaleString()}</span>
                </div>
                {client.last_interaction && (
                  <div className="text-xs text-muted-foreground">
                    Last contact: {new Date(client.last_interaction).toLocaleDateString()}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredClients.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground text-pretty">
              {searchQuery ? 'No clients found matching your search' : 'No clients yet. Add your first client to get started!'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
