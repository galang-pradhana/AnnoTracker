import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: clients, error: err1 } = await supabase.from('client_accounts').select('*');
  console.log("Client Accounts in Supabase:", clients, err1);

  const { data: tasks, error: err2 } = await supabase.from('task_types').select('*');
  console.log("Task Types in Supabase:", tasks, err2);

  const { data: users, error: err3 } = await supabase.from('users').select('*');
  console.log("Users in Supabase:", users, err3);
}

check();
