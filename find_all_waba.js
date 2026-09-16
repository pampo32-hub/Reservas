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

  // Let's test different endpoints to find other WABAs
  const testUrls = [
    'https://graph.facebook.com/v20.0/1076002931838532/whatsapp_business_accounts',
    'https://graph.facebook.com/v20.0/me/accounts',
    'https://graph.facebook.com/v20.0/122215071740576681/whatsapp_business_accounts',
    'https://graph.facebook.com/v20.0/me/adaccounts'
  ];

  for (const u of testUrls) {
    console.log(`Checking ${u}...`);
    try {
      const r = await fetch(u, { headers: { Authorization: `Bearer ${token}` } });
      console.log('Result:', await r.json());
    } catch (e) {
      console.error('Error:', e.message);
    }
  }

  process.exit(0);
}

run();

