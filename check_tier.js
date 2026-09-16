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

  // App mode
  const appRes = await fetch('https://graph.facebook.com/v20.0/1076002931838532?fields=id,name,category', {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('App details:', await appRes.json());

  // Phone number status
  const phoneRes = await fetch('https://graph.facebook.com/v20.0/1305807259289667?fields=id,display_phone_number,verified_name,status,quality_rating,throughput,messaging_limit_tier', {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('Phone details:', await phoneRes.json());

  process.exit(0);
}

run();

