import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  console.error("Missing env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function run() {
  console.log("Testing user creation...");
  const email = "test_employee@annotracker.com";
  const password = "password123";

  // First, check if user exists
  const { data: users, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error("Error listing users:", listError);
    return;
  }

  const existingUser = users.users.find(u => u.email === email);
  if (existingUser) {
    console.log("User already exists with ID:", existingUser.id);
    return;
  }

  const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: "Test Employee",
      role: "employee"
    }
  });

  if (createError) {
    console.error("Error creating user:", createError);
  } else {
    console.log("Created user successfully:", newUser.user);
  }
}

run();
