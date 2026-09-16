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
  const phoneId = creds.META_PHONE_NUMBER_ID || '1358707247317897';

  console.log('Sending hello_world test to 50671433852 with Phone ID:', phoneId);
  const sendRes = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '50671433852',
      type: 'template',
      template: {
        name: 'hello_world',
        language: { code: 'en_US' }
      }
    })
  });

  const sendData = await sendRes.json();
  console.log('Status:', sendRes.status);
  console.log('Result:', JSON.stringify(sendData, null, 2));

  process.exit(0);
}

run();

