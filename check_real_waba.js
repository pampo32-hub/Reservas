import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  const res = await pool.query("SELECT key, value FROM reservas_system_settings WHERE key LIKE 'META_%'");
  const creds = {};
  res.rows.forEach(r => creds[r.key] = r.value);
  const token = creds.META_WHATSAPP_TOKEN;
  const wabaId = '1127298519974904';

  console.log(`Checking WABA ID: ${wabaId}...`);

  // 1. Templates
  try {
    const r1 = await fetch(`https://graph.facebook.com/v20.0/${wabaId}/message_templates`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data1 = await r1.json();
    console.log('Templates in WABA:', JSON.stringify(data1, null, 2));
  } catch (e) {
    console.error('Error r1:', e.message);
  }

  // 2. Phone numbers in this WABA
  try {
    const r2 = await fetch(`https://graph.facebook.com/v20.0/${wabaId}/phone_numbers`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data2 = await r2.json();
    console.log('Phone numbers in WABA:', JSON.stringify(data2, null, 2));
  } catch (e) {
    console.error('Error r2:', e.message);
  }

  process.exit(0);
}

run();

