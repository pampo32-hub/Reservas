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
  const wabaId = creds.META_WABA_ID || '1435218878598380';
  const phoneId = creds.META_PHONE_NUMBER_ID || '1358707247317897';

  console.log('--- Phone number details ---');
  const pRes = await fetch(`https://graph.facebook.com/v20.0/${phoneId}?fields=id,display_phone_number,verified_name,quality_rating,account_mode,status`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('Phone details:', await pRes.json());

  console.log('--- Template search confirmacion_cita ---');
  const tSearch = await fetch(`https://graph.facebook.com/v20.0/${wabaId}/message_templates?name=confirmacion_cita`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('Template confirmacion_cita query:', await tSearch.json());

  console.log('--- All templates in WABA ---');
  const allT = await fetch(`https://graph.facebook.com/v20.0/${wabaId}/message_templates?limit=100`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('All templates in WABA:', await allT.json());

  console.log('--- App WhatsApp Accounts ---');
  const appWaba = await fetch(`https://graph.facebook.com/v20.0/1076002931838532?fields=id,name,category`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('App details:', await appWaba.json());

  process.exit(0);
}

run();

