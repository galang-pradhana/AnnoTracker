import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  console.error("Missing env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseSecretKey);

async function seed() {
  console.log("Seeding client_accounts...");
  const clients = [
    { name: "syimei", is_active: true },
    { name: "preecha", is_active: true },
    { name: "bjunwen", is_active: true },
    { name: "aatikah", is_active: true },
    { name: "farah", is_active: true },
  ];
  const { data: clientData, error: clientErr } = await supabase
    .from("client_accounts")
    .upsert(clients, { onConflict: "name" })
    .select();
  console.log("Client Accounts:", clientData, clientErr);

  console.log("Seeding task_types...");
  const tasks = [
    { name: "PR", is_active: true },
    { name: "AFM", is_active: true },
    { name: "AFM4", is_active: true },
    { name: "VCG - ADM", is_active: true },
    { name: "TA - Proofreading", is_active: true },
    { name: "Arabic LineTask", is_active: true },
    { name: "Image Bounding Box", is_active: true },
    { name: "Audio Transcription", is_active: true },
  ];
  const { data: taskData, error: taskErr } = await supabase
    .from("task_types")
    .upsert(tasks, { onConflict: "name" })
    .select();
  console.log("Task Types:", taskData, taskErr);

  console.log("Seeding salary_tiers...");
  const tiers = [
    { min_hours: 0.00, max_hours: 8.00, rate_per_hour: 10000, effective_from: new Date().toISOString().split("T")[0] },
    { min_hours: 8.01, max_hours: 10.00, rate_per_hour: 11000, effective_from: new Date().toISOString().split("T")[0] },
    { min_hours: 10.01, max_hours: 12.00, rate_per_hour: 12000, effective_from: new Date().toISOString().split("T")[0] },
  ];
  const { data: tierData, error: tierErr } = await supabase.from("salary_tiers").upsert(tiers).select();
  console.log("Salary Tiers:", tierData, tierErr);
}

seed();
