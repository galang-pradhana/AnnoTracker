// Test Supabase Connection
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('=== Supabase Connection Test ===');
console.log(`URL: ${supabaseUrl}`);
console.log(`Key: ${supabaseKey ? supabaseKey.substring(0, 30) + '...' : 'MISSING'}`);
console.log('');

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ ERROR: Environment variables tidak ditemukan!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  try {
    console.log('🔄 Testing connection ke Supabase...');
    
    // Test 1: Basic connection test
    const { data, error } = await supabase
      .from('users')
      .select('count', { count: 'exact', head: true });
    
    if (error) {
      if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
        console.log('⚠️  Tabel "users" tidak ditemukan, tapi koneksi DB berhasil!');
        await testWithSystemTable();
      } else {
        console.error('❌ Error query:', error.message);
        console.error('   Code:', error.code);
        console.error('   Hint:', error.hint || '-');
        await testWithSystemTable();
      }
    } else {
      console.log('✅ Koneksi berhasil! Tabel "users" dapat diakses.');
      console.log(`   Row count: ${data}`);
    }
  } catch (err) {
    console.error('❌ Connection Error:', err.message);
  }
}

async function testWithSystemTable() {
  console.log('\n🔄 Testing dengan health check...');
  try {
    // Try a simple RPC or REST ping
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    
    if (response.ok || response.status === 200) {
      console.log('✅ REST API Supabase dapat diakses! (HTTP ' + response.status + ')');
    } else {
      const text = await response.text();
      console.log(`⚠️  REST API response: HTTP ${response.status}`);
      console.log(`   Body: ${text.substring(0, 200)}`);
    }
  } catch (fetchErr) {
    console.error('❌ Fetch error:', fetchErr.message);
  }
  
  // Also test auth endpoint
  console.log('\n🔄 Testing Auth endpoint...');
  try {
    const authResponse = await fetch(`${supabaseUrl}/auth/v1/health`, {
      headers: {
        'apikey': supabaseKey
      }
    });
    
    if (authResponse.ok) {
      const data = await authResponse.json();
      console.log('✅ Auth service healthy:', JSON.stringify(data));
    } else {
      console.log(`⚠️  Auth health: HTTP ${authResponse.status}`);
    }
  } catch (err) {
    console.error('❌ Auth test error:', err.message);
  }
}

// Test listing tables
async function listTables() {
  console.log('\n🔄 Listing tables yang tersedia...');
  try {
    const { data, error } = await supabase
      .rpc('get_tables')
      .select('*');
    
    if (error) {
      // Try alternative
      const { data: tables, error: tableError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public');
      
      if (tableError) {
        console.log('ℹ️  Tidak bisa list tables via RPC (normal untuk anon key)');
      } else {
        console.log('📋 Tables:', tables?.map(t => t.table_name).join(', '));
      }
    } else {
      console.log('📋 Tables:', data);
    }
  } catch (err) {
    console.log('ℹ️  List tables tidak tersedia (normal untuk anon key)');
  }
}

testConnection()
  .then(() => listTables())
  .then(() => {
    console.log('\n=== Test Selesai ===');
    process.exit(0);
  })
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
