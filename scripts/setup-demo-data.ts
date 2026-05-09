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
const SUPABASE_ANON_KEY = envVars.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = envVars.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function setupDemoData() {
  console.log('🚀 Setting up demo data...');

  // Create demo user
  const demoUsername = 'demo';
  const demoPassword = 'demo123';
  const demoEmail = `${demoUsername}@miaoda.com`;

  console.log('Creating demo user...');
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: demoEmail,
    password: demoPassword,
  });

  if (authError) {
    console.error('Error creating demo user:', authError);
    return;
  }

  const userId = authData.user?.id;
  if (!userId) {
    console.error('No user ID returned');
    return;
  }

  console.log('✅ Demo user created:', demoUsername);

  // Wait for trigger to create profile
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Create business profile
  console.log('Creating business profile...');
  const { error: businessError } = await supabaseAdmin
    .from('business_profiles')
    .insert({
      user_id: userId,
      business_name: 'Creative Design Studio',
      business_description: 'Professional graphic design services specializing in brand identity, digital design, and marketing materials for tech startups and growing businesses.',
      service_type: 'graphic designer',
      hourly_rate: 120,
      branding_colors: { primary: '#0A1428', accent: '#10B981', highlight: '#F59E0B' },
    });

  if (businessError) {
    console.error('Error creating business profile:', businessError);
  } else {
    console.log('✅ Business profile created');
  }

  // Create clients
  console.log('Creating demo clients...');
  const { data: clients, error: clientsError } = await supabaseAdmin
    .from('clients')
    .insert([
      {
        user_id: userId,
        name: 'Sarah Johnson',
        company: 'TechStart Inc',
        email: 'sarah@techstart.com',
        phone: '+1 (555) 123-4567',
        status: 'active',
        total_value: 8400,
        last_interaction: '2026-05-08T10:00:00Z',
        notes: 'Great client, always pays on time. Looking for ongoing design support.',
      },
      {
        user_id: userId,
        name: 'Michael Chen',
        company: 'Design Co',
        email: 'michael@designco.com',
        phone: '+1 (555) 234-5678',
        status: 'active',
        total_value: 5500,
        last_interaction: '2026-05-05T14:30:00Z',
        notes: 'Prefers modern, minimalist designs. Quick decision maker.',
      },
      {
        user_id: userId,
        name: 'Emily Rodriguez',
        company: 'Marketing Pro',
        email: 'emily@marketingpro.com',
        phone: '+1 (555) 345-6789',
        status: 'active',
        total_value: 6200,
        last_interaction: '2026-05-07T16:00:00Z',
        notes: 'Needs regular social media graphics. Monthly retainer client.',
      },
      {
        user_id: userId,
        name: 'David Kim',
        company: 'Startup Labs',
        email: 'david@startuplabs.com',
        phone: '+1 (555) 456-7890',
        status: 'active',
        total_value: 3200,
        last_interaction: '2026-05-06T11:00:00Z',
        notes: 'New startup, budget conscious but quality focused.',
      },
    ])
    .select();

  if (clientsError) {
    console.error('Error creating clients:', clientsError);
  } else {
    console.log('✅ Clients created:', clients?.length);
  }

  // Create projects
  if (clients && clients.length > 0) {
    console.log('Creating demo projects...');
    const { error: projectsError } = await supabaseAdmin
      .from('projects')
      .insert([
        {
          user_id: userId,
          client_id: clients[0].id,
          name: 'Brand Identity Redesign',
          description: 'Complete brand refresh including logo, color palette, and brand guidelines',
          status: 'in_progress',
          value: 3200,
          deadline: '2026-05-25T00:00:00Z',
          progress: 65,
        },
        {
          user_id: userId,
          client_id: clients[0].id,
          name: 'Website Graphics',
          description: 'Hero images and icon set for new website',
          status: 'completed',
          value: 2400,
          deadline: '2026-04-30T00:00:00Z',
          progress: 100,
        },
        {
          user_id: userId,
          client_id: clients[1].id,
          name: 'Marketing Campaign Design',
          description: 'Social media graphics and email templates',
          status: 'review',
          value: 1800,
          deadline: '2026-05-20T00:00:00Z',
          progress: 90,
        },
        {
          user_id: userId,
          client_id: clients[2].id,
          name: 'Product Packaging',
          description: 'Design packaging for new product line',
          status: 'lead',
          value: 4200,
          deadline: '2026-06-15T00:00:00Z',
          progress: 0,
        },
        {
          user_id: userId,
          client_id: clients[3].id,
          name: 'Pitch Deck Design',
          description: 'Investor presentation design',
          status: 'in_progress',
          value: 1500,
          deadline: '2026-05-18T00:00:00Z',
          progress: 40,
        },
      ]);

    if (projectsError) {
      console.error('Error creating projects:', projectsError);
    } else {
      console.log('✅ Projects created');
    }
  }

  // Create tasks
  console.log('Creating demo tasks...');
  const { error: tasksError } = await supabaseAdmin
    .from('tasks')
    .insert([
      {
        user_id: userId,
        title: 'Finalize logo concepts',
        description: 'Present 3 final logo options to client',
        due_date: '2026-05-15T00:00:00Z',
        completed: false,
      },
      {
        user_id: userId,
        title: 'Send invoice to TechStart',
        description: 'Invoice for completed website graphics project',
        due_date: '2026-05-12T00:00:00Z',
        completed: false,
      },
      {
        user_id: userId,
        title: 'Client meeting - Marketing Pro',
        description: 'Discuss Q3 marketing materials',
        due_date: '2026-05-16T00:00:00Z',
        completed: false,
      },
    ]);

  if (tasksError) {
    console.error('Error creating tasks:', tasksError);
  } else {
    console.log('✅ Tasks created');
  }

  // Create invoices
  if (clients && clients.length > 0) {
    console.log('Creating demo invoices...');
    const { error: invoicesError } = await supabaseAdmin
      .from('invoices')
      .insert([
        {
          user_id: userId,
          client_id: clients[0].id,
          invoice_number: 'INV-2026-001',
          status: 'paid',
          amount: 2400,
          due_date: '2026-04-15T00:00:00Z',
          paid_date: '2026-04-14T00:00:00Z',
        },
        {
          user_id: userId,
          client_id: clients[1].id,
          invoice_number: 'INV-2026-002',
          status: 'pending',
          amount: 1800,
          due_date: '2026-05-20T00:00:00Z',
        },
        {
          user_id: userId,
          client_id: clients[2].id,
          invoice_number: 'INV-2026-003',
          status: 'overdue',
          amount: 3200,
          due_date: '2026-04-30T00:00:00Z',
        },
      ]);

    if (invoicesError) {
      console.error('Error creating invoices:', invoicesError);
    } else {
      console.log('✅ Invoices created');
    }
  }

  // Create proposals
  if (clients && clients.length > 0) {
    console.log('Creating demo proposals...');
    const { error: proposalsError } = await supabaseAdmin
      .from('proposals')
      .insert([
        {
          user_id: userId,
          client_id: clients[0].id,
          title: 'Brand Identity Package',
          status: 'accepted',
          value: 3200,
          sent_date: '2026-04-20T00:00:00Z',
        },
        {
          user_id: userId,
          client_id: clients[3].id,
          title: 'Social Media Graphics Package',
          status: 'sent',
          value: 1800,
          sent_date: '2026-05-05T00:00:00Z',
        },
      ]);

    if (proposalsError) {
      console.error('Error creating proposals:', proposalsError);
    } else {
      console.log('✅ Proposals created');
    }
  }

  console.log('\n✨ Demo data setup complete!');
  console.log('\n📝 Demo Account Credentials:');
  console.log('Username:', demoUsername);
  console.log('Password:', demoPassword);
}

setupDemoData().catch(console.error);
