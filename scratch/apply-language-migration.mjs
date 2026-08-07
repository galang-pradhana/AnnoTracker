import * as dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const projectRef = url ? url.replace('https://', '').split('.')[0] : '';

async function run() {
  console.log("🚀 Running language migration script for Supabase...");
  console.log(`Project Ref: ${projectRef}`);

  const mgmtUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
  const sql = `
    ALTER TABLE public.client_accounts ADD COLUMN IF NOT EXISTS language TEXT;
    UPDATE public.client_accounts SET language = 'Thailand' WHERE LOWER(name) = 'preecha';
    UPDATE public.client_accounts SET language = 'China' WHERE LOWER(name) = 'syimei';
    UPDATE public.client_accounts SET language = 'China' WHERE LOWER(name) = 'bjunwen';
  `;

  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  if (accessToken) {
    console.log("Executing SQL via Supabase Management API...");
    const res = await fetch(mgmtUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: sql })
    });
    console.log("Management API status:", res.status, await res.text());
  } else {
    console.log("ℹ️ No SUPABASE_ACCESS_TOKEN found. Checking if language column exists via REST API...");
    const supabase = createClient(url, key);
    
    // Try updating directly
    const { data: updateRes, error: updateErr } = await supabase
      .from('client_accounts')
      .update({ language: 'Thailand' })
      .eq('name', 'preecha')
      .select();

    if (updateErr) {
      console.log("⚠️ Direct REST update failed (column may not exist yet in DB):", updateErr.message);
      console.log("\n📋 Please run the following SQL query in your Supabase Dashboard SQL Editor:");
      console.log("--------------------------------------------------");
      console.log(sql);
      console.log("--------------------------------------------------");
    } else {
      console.log("✅ Column 'language' exists and update succeeded:", updateRes);
      
      // Update syimei and bjunwen
      await supabase.from('client_accounts').update({ language: 'China' }).eq('name', 'syimei');
      await supabase.from('client_accounts').update({ language: 'China' }).eq('name', 'bjunwen');
      
      const { data: allAccounts } = await supabase.from('client_accounts').select('*');
      console.log("Updated Client Accounts:", allAccounts);
    }
  }
}

run().catch(console.error);
