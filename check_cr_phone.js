import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function checkPhone() {
  const res = await pool.query("SELECT key, value FROM reservas_system_settings WHERE key LIKE 'META_%'");
  const creds = {};
  res.rows.forEach(r => creds[r.key] = r.value);
  const token = creds.META_WHATSAPP_TOKEN;
  const phoneId = '1305807259289667';

  console.log('Consultando estado del número +506 7101 5954 (Reservas CR)...');
  const pRes = await fetch(`https://graph.facebook.com/v20.0/${phoneId}?fields=id,display_phone_number,verified_name,quality_rating,account_mode,status,code_verification_status`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('Detalles del teléfono:', JSON.stringify(await pRes.json(), null, 2));

  process.exit(0);
}

checkPhone();

