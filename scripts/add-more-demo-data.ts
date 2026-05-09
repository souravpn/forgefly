import { createClient } from '@supabase/supabase-js';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Load environment variables from .env file
const envPath = path.join(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars: Record<string, string> = {};

envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const value = match[2].trim().replace(/^["']|["']$/g, '');
    envVars[key] = value;
  }
});

const SUPABASE_URL = envVars.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = envVars.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function addMoreDemoData() {
  console.log('🚀 Adding more demo data...');

  // Get demo user
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('username', 'demo')
    .maybeSingle();

  if (!profiles) {
    console.error('Demo user not found');
    return;
  }

  const userId = profiles.id;

  // Add more clients
  console.log('Adding more clients...');
  const { data: newClients, error: clientsError } = await supabaseAdmin
    .from('clients')
    .insert([
      {
        user_id: userId,
        name: 'Jessica Martinez',
        company: 'Growth Ventures',
        email: 'jessica@growthventures.com',
        phone: '+1 (555) 567-8901',
        status: 'active',
        total_value: 4800,
        last_interaction: '2026-05-09T09:00:00Z',
        notes: 'Interested in ongoing design retainer. Very detail-oriented.',
      },
      {
        user_id: userId,
        name: 'Robert Taylor',
        company: 'Tech Innovators',
        email: 'robert@techinnovators.com',
        phone: '+1 (555) 678-9012',
        status: 'active',
        total_value: 7200,
        last_interaction: '2026-05-08T15:30:00Z',
        notes: 'Enterprise client. Needs comprehensive brand overhaul.',
      },
      {
        user_id: userId,
        name: 'Amanda White',
        company: 'Creative Studios',
        email: 'amanda@creativestudios.com',
        phone: '+1 (555) 789-0123',
        status: 'active',
        total_value: 2900,
        last_interaction: '2026-05-07T11:00:00Z',
        notes: 'Freelance art director. Collaborative and easy to work with.',
      },
    ])
    .select();

  if (clientsError) {
    console.error('Error adding clients:', clientsError);
  } else {
    console.log('✅ Added', newClients?.length, 'new clients');
  }

  // Add more projects
  if (newClients && newClients.length > 0) {
    console.log('Adding more projects...');
    const { error: projectsError } = await supabaseAdmin
      .from('projects')
      .insert([
        {
          user_id: userId,
          client_id: newClients[0].id,
          name: 'Social Media Branding',
          description: 'Instagram and LinkedIn visual templates',
          status: 'in_progress',
          value: 2400,
          deadline: '2026-05-28T00:00:00Z',
          progress: 55,
        },
        {
          user_id: userId,
          client_id: newClients[1].id,
          name: 'Corporate Identity System',
          description: 'Complete brand identity including logo, stationery, and guidelines',
          status: 'lead',
          value: 7200,
          deadline: '2026-06-30T00:00:00Z',
          progress: 0,
        },
        {
          user_id: userId,
          client_id: newClients[2].id,
          name: 'Event Poster Design',
          description: 'Series of promotional posters for upcoming event',
          status: 'review',
          value: 1200,
          deadline: '2026-05-22T00:00:00Z',
          progress: 95,
        },
      ]);

    if (projectsError) {
      console.error('Error adding projects:', projectsError);
    } else {
      console.log('✅ Added more projects');
    }
  }

  // Add more tasks
  console.log('Adding more tasks...');
  const { error: tasksError } = await supabaseAdmin
    .from('tasks')
    .insert([
      {
        user_id: userId,
        title: 'Review brand guidelines draft',
        description: 'Go through the brand guidelines document and make final edits',
        due_date: '2026-05-14T00:00:00Z',
        completed: false,
      },
      {
        user_id: userId,
        title: 'Prepare presentation for Growth Ventures',
        description: 'Create slide deck showcasing portfolio and process',
        due_date: '2026-05-17T00:00:00Z',
        completed: false,
      },
      {
        user_id: userId,
        title: 'Update portfolio website',
        description: 'Add recent projects to portfolio',
        due_date: '2026-05-20T00:00:00Z',
        completed: false,
      },
      {
        user_id: userId,
        title: 'Follow up with Tech Innovators',
        description: 'Send project proposal and timeline',
        due_date: '2026-05-13T00:00:00Z',
        completed: false,
      },
    ]);

  if (tasksError) {
    console.error('Error adding tasks:', tasksError);
  } else {
    console.log('✅ Added more tasks');
  }

  // Add calendar events
  console.log('Adding calendar events...');
  const { error: eventsError } = await supabaseAdmin
    .from('calendar_events')
    .insert([
      {
        user_id: userId,
        title: 'Design Review - TechStart',
        description: 'Present brand identity concepts',
        event_type: 'meeting',
        start_time: '2026-05-15T14:00:00Z',
        end_time: '2026-05-15T15:00:00Z',
      },
      {
        user_id: userId,
        title: 'Project Kickoff - Growth Ventures',
        description: 'Initial meeting to discuss project scope',
        event_type: 'meeting',
        start_time: '2026-05-17T10:00:00Z',
        end_time: '2026-05-17T11:30:00Z',
      },
      {
        user_id: userId,
        title: 'Workshop: Advanced Typography',
        description: 'Online workshop on typography best practices',
        event_type: 'workshop',
        start_time: '2026-05-19T13:00:00Z',
        end_time: '2026-05-19T16:00:00Z',
      },
    ]);

  if (eventsError) {
    console.error('Error adding events:', eventsError);
  } else {
    console.log('✅ Added calendar events');
  }

  // Add automations
  console.log('Adding automations...');
  const { error: automationsError } = await supabaseAdmin
    .from('automations')
    .insert([
      {
        user_id: userId,
        name: 'Weekly Progress Report',
        trigger_type: 'schedule',
        action_type: 'send_email',
        config: { frequency: 'weekly', day: 'friday' },
        is_active: true,
      },
      {
        user_id: userId,
        name: 'New Client Welcome',
        trigger_type: 'client_added',
        action_type: 'send_email',
        config: { template: 'welcome' },
        is_active: true,
      },
    ]);

  if (automationsError) {
    console.error('Error adding automations:', automationsError);
  } else {
    console.log('✅ Added automations');
  }

  console.log('\n✨ Additional demo data added successfully!');
}

addMoreDemoData().catch(console.error);
