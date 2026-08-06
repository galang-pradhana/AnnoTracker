import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  console.error("Missing env vars in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseSecretKey);

// Date helper
function getDatesInRange(startDate, endDate) {
  const dates = [];
  let currentDate = new Date(startDate);
  const lastDate = new Date(endDate);
  while (currentDate <= lastDate) {
    dates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return dates;
}

async function seed() {
  console.log("=== START SEEDING DUMMY DATA ===");

  // 1. Fetch Master Data
  const { data: clients } = await supabase.from('client_accounts').select('id');
  const { data: tasks } = await supabase.from('task_types').select('id');

  if (!clients || clients.length === 0 || !tasks || tasks.length === 0) {
    console.error("Please seed client_accounts and task_types first using seed-db.mjs!");
    process.exit(1);
  }

  console.log(`Fetched ${clients.length} clients and ${tasks.length} task types.`);

  // 2. Fetch or reset Users in Auth and Public
  console.log("Resetting passwords and verifying users...");
  const usersToSeed = [
    { email: "owner@email.com", name: "Owner AnnoTracker", role: "owner" },
    { email: "employee@email.com", name: "Employee AnnoTracker", role: "employee" },
    { email: "test_employee@annotracker.com", name: "Test Employee", role: "employee" }
  ];

  const { data: authUsersList } = await supabase.auth.admin.listUsers();
  const dbUsers = {};

  for (const target of usersToSeed) {
    let authUser = authUsersList.users.find(u => u.email === target.email);
    if (!authUser) {
      console.log(`Creating missing auth user: ${target.email}`);
      const { data: newAuthUser, error: err } = await supabase.auth.admin.createUser({
        email: target.email,
        password: "password123",
        email_confirm: true,
        user_metadata: {
          full_name: target.name,
          role: target.role
        }
      });
      if (err) {
        console.error(`Failed to create ${target.email}:`, err.message);
        continue;
      }
      authUser = newAuthUser.user;
    } else {
      console.log(`Updating password for existing user: ${target.email}`);
      const { error: err } = await supabase.auth.admin.updateUserById(authUser.id, {
        password: "password123"
      });
      if (err) {
        console.error(`Failed to reset password for ${target.email}:`, err.message);
      }
    }
    dbUsers[target.role + "_" + target.email] = authUser.id;
  }

  console.log("User IDs mapped:", dbUsers);

  // 3. Clear existing work sessions for our target employees in the 2-month range
  const startDateStr = "2026-05-29";
  const endDateStr = "2026-07-28";
  
  const employeeIds = [
    dbUsers["employee_employee@email.com"],
    dbUsers["employee_test_employee@annotracker.com"]
  ].filter(Boolean);

  console.log("Clearing old work sessions for target employees in range:", startDateStr, "to", endDateStr);
  const { error: deleteErr } = await supabase
    .from('work_sessions')
    .delete()
    .in('user_id', employeeIds)
    .gte('session_date', startDateStr)
    .lte('session_date', endDateStr);

  if (deleteErr) {
    console.error("Error clearing old sessions:", deleteErr);
  } else {
    console.log("Old sessions cleared successfully.");
  }

  // 4. Generate 2 months of dummy sessions and task entries
  const dates = getDatesInRange(startDateStr, endDateStr);
  console.log(`Generating data for ${dates.length} days...`);

  const sessionsToInsert = [];
  const tasksToInsert = [];

  for (const employeeId of employeeIds) {
    for (const date of dates) {
      // Skip Sundays (0 = Sunday)
      if (date.getDay() === 0) continue;

      const dateStr = date.toISOString().split('T')[0];
      const sessionId = crypto.randomUUID();

      // Create Work Session
      sessionsToInsert.push({
        id: sessionId,
        user_id: employeeId,
        session_date: dateStr,
        proof_type: 'note',
        proof_note: `Annotation sessions completed successfully for ${dateStr}. All tasks verified.`,
        proof_url: null,
        sync_status: 'synced',
        created_at: new Date(date.setHours(18, 0, 0, 0)).toISOString() // Created at 6:00 PM
      });

      // Create 2 to 4 Task Entries per session
      const numTasks = Math.floor(Math.random() * 3) + 2; // 2, 3, or 4 tasks
      for (let order = 1; order <= numTasks; order++) {
        const client = clients[Math.floor(Math.random() * clients.length)];
        const taskType = tasks[Math.floor(Math.random() * tasks.length)];
        
        // Duration: 1 hour to 3 hours (3600 to 10800 seconds)
        const durationSeconds = Math.floor(Math.random() * (10800 - 3600 + 1)) + 3600;

        tasksToInsert.push({
          id: crypto.randomUUID(),
          session_id: sessionId,
          client_account_id: client.id,
          task_type_id: taskType.id,
          duration_seconds: durationSeconds,
          entry_order: order,
          created_at: new Date(date.setHours(9 + order * 2, 0, 0, 0)).toISOString() // Stagger task start times
        });
      }
    }
  }

  console.log(`Inserting ${sessionsToInsert.length} work sessions into DB...`);
  // Insert sessions in chunks of 100 to avoid request size limits
  for (let i = 0; i < sessionsToInsert.length; i += 100) {
    const chunk = sessionsToInsert.slice(i, i + 100);
    const { error } = await supabase.from('work_sessions').insert(chunk);
    if (error) {
      console.error("Error inserting sessions chunk:", error);
      process.exit(1);
    }
  }
  console.log("Sessions inserted successfully.");

  console.log(`Inserting ${tasksToInsert.length} task entries into DB...`);
  for (let i = 0; i < tasksToInsert.length; i += 100) {
    const chunk = tasksToInsert.slice(i, i + 100);
    const { error } = await supabase.from('task_entries').insert(chunk);
    if (error) {
      console.error("Error inserting task entries chunk:", error);
      process.exit(1);
    }
  }
  console.log("Task entries inserted successfully.");

  console.log("=== SEEDING COMPLETED SUCCESSFULLY ===");
}

seed();
