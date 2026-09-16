import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function checkDetails() {
  const res = await pool.query("SELECT key, value FROM reservas_system_settings WHERE key LIKE 'META_%'");
  const creds = {};
  res.rows.forEach(r => creds[r.key] = r.value);
  const token = creds.META_WHATSAPP_TOKEN;
  const phoneId = '1305807259289667';
  const wabaId = '1127298519974904';

  console.log('--- Checking WABA Details ---');
  const wRes = await fetch(`https://graph.facebook.com/v20.0/${wabaId}?fields=id,name,currency,timezone_id,account_review_status,business_verification_status,status`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('WABA Details:', await wRes.json());

  console.log('\n--- Checking Phone Details ---');
  const pRes = await fetch(`https://graph.facebook.com/v20.0/${phoneId}?fields=id,display_phone_number,verified_name,status,quality_rating,name_status,messaging_limit_tier,is_official_business_account`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('Phone Details:', await pRes.json());

  process.exit(0);
}

checkDetails();

