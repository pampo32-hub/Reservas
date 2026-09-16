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
  const businessId = '1114318144795728';

  console.log(`Checking Business ID ${businessId}...`);

  // 1. Owned WABAs
  try {
    const r1 = await fetch(`https://graph.facebook.com/v20.0/${businessId}/owned_whatsapp_business_accounts`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Owned WABAs:', JSON.stringify(await r1.json(), null, 2));
  } catch (e) {
    console.error('Error r1:', e.message);
  }

  // 2. Client WABAs
  try {
    const r2 = await fetch(`https://graph.facebook.com/v20.0/${businessId}/client_whatsapp_business_accounts`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Client WABAs:', JSON.stringify(await r2.json(), null, 2));
  } catch (e) {
    console.error('Error r2:', e.message);
  }

  // 3. Direct WABA query (in case the business_id itself is also a WABA or business)
  try {
    const r3 = await fetch(`https://graph.facebook.com/v20.0/${businessId}/message_templates`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Templates directly under ID:', JSON.stringify(await r3.json(), null, 2));
  } catch (e) {
    console.error('Error r3:', e.message);
  }

  // 4. Phone numbers under ID
  try {
    const r4 = await fetch(`https://graph.facebook.com/v20.0/${businessId}/phone_numbers`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Phone numbers under ID:', JSON.stringify(await r4.json(), null, 2));
  } catch (e) {
    console.error('Error r4:', e.message);
  }

  process.exit(0);
}

run();

