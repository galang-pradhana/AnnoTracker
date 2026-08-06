import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  console.error("Missing env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseSecretKey);

async function check() {
  console.log("=== CHECKING DATABASE WITH SERVICE ROLE KEY ===");
  
  const { data: clients, error: err1 } = await supabase.from('client_accounts').select('*');
  console.log(`Client Accounts (${clients?.length || 0}):`, clients, err1);

  const { data: tasks, error: err2 } = await supabase.from('task_types').select('*');
  console.log(`Task Types (${tasks?.length || 0}):`, tasks, err2);

  const { data: users, error: err3 } = await supabase.from('users').select('*');
  console.log(`Users (${users?.length || 0}):`, users, err3);

  const { data: sessions, error: err4 } = await supabase.from('work_sessions').select('*');
  console.log(`Work Sessions (${sessions?.length || 0}):`, sessions, err4);
}

check();
