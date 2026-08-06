import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function check() {
  console.log("Checking payroll_records schema...");
  const { data, error } = await supabase.from('payroll_records').select('*').limit(1);
  if (error) {
    console.error("Error querying payroll_records:", error);
    return;
  }
  console.log("Current sample row keys:", data.length > 0 ? Object.keys(data[0]) : "No rows found");

  // Test inserting/upserting a record with proof_url and proof_note
  const testUserId = (await supabase.from('users').select('id').limit(1)).data?.[0]?.id;
  if (!testUserId) {
    console.log("No user found to test");
    return;
  }

  const { data: upsertData, error: upsertErr } = await supabase.from('payroll_records').upsert({
    user_id: testUserId,
    period_start: "2026-08-01",
    period_end: "2026-08-15",
    total_hours: 10,
    base_pay: 100000,
    bonus_pay: 0,
    total_pay: 100000,
    payment_status: "paid",
    paid_at: new Date().toISOString(),
    proof_url: "https://example.com/proof.jpg",
    proof_note: "Test note"
  }, { onConflict: "user_id,period_start,period_end" }).select();

  if (upsertErr) {
    console.error("❌ Upsert Test Failed:", upsertErr);
  } else {
    console.log("✅ Upsert Test Success:", upsertData);
  }
}

check();
