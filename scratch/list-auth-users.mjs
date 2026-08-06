import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

const supabase = createClient(supabaseUrl, supabaseSecretKey);

async function run() {
  const { data: users, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error("Error listing users:", error);
    return;
  }
  console.log("=== AUTH USERS ===");
  users.users.forEach(u => {
    console.log(`ID: ${u.id} | Email: ${u.email} | Name: ${u.user_metadata?.full_name} | Role: ${u.user_metadata?.role}`);
  });
}

run();
