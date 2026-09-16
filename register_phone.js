import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function registerNumber(pin = '123456') {
  const res = await pool.query("SELECT key, value FROM reservas_system_settings WHERE key LIKE 'META_%'");
  const creds = {};
  res.rows.forEach(r => creds[r.key] = r.value);
  const token = creds.META_WHATSAPP_TOKEN;
  const phoneId = '1305807259289667';

  console.log(`Intentando registrar número con PIN: ${pin}...`);
  const regRes = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/register`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      pin: pin
    })
  });

  const regData = await regRes.json();
  console.log('Resultado registro:', JSON.stringify(regData, null, 2));

  // Consultar estado nuevamente
  const pRes = await fetch(`https://graph.facebook.com/v20.0/${phoneId}?fields=id,display_phone_number,verified_name,status,code_verification_status`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('Estado actual del teléfono:', JSON.stringify(await pRes.json(), null, 2));

  process.exit(0);
}

registerNumber();

