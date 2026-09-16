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
  const newId = '1305807259289667';

  console.log(`--- Checking ID ${newId} ---`);

  // 1. Check as Phone Number ID
  try {
    const pRes = await fetch(`https://graph.facebook.com/v20.0/${newId}?fields=id,display_phone_number,verified_name,quality_rating,account_mode,status`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Phone details:', await pRes.json());
  } catch (e) {
    console.log('Phone check error:', e.message);
  }

  // 2. Check as WABA ID (templates)
  try {
    const tRes = await fetch(`https://graph.facebook.com/v20.0/${newId}/message_templates`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Templates in WABA:', await tRes.json());
  } catch (e) {
    console.log('WABA check error:', e.message);
  }

  // 3. Test sending template confirmacion_cita using this ID as Phone ID
  console.log(`\n--- Probando envío usando Phone ID ${newId} con confirmacion_cita ---`);
  try {
    const sendRes = await fetch(`https://graph.facebook.com/v20.0/${newId}/messages`, {
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
          name: 'confirmacion_cita',
          language: { code: 'es' },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: 'Juan Jiménez' },
                { type: 'text', text: 'Barbería Vintage Costa Rica' },
                { type: 'text', text: 'Corte Clásico & Barba' },
                { type: 'text', text: '16/09/2026' },
                { type: 'text', text: '3:30 PM' },
                { type: 'text', text: '₡10.000' },
                { type: 'text', text: 'San José, Escazú' },
                { type: 'text', text: 'APT-714338' }
              ]
            }
          ]
        }
      })
    });
    const sendData = await sendRes.json();
    console.log('Send Status HTTP:', sendRes.status);
    console.log('Send Result:', JSON.stringify(sendData, null, 2));

    if (sendRes.ok && sendData.messages?.[0]?.id) {
      console.log('🎉 ¡ENVIADO CON ÉXITO! Actualizando BD...');
      await pool.query("UPDATE reservas_system_settings SET value = $1, updated_at = NOW() WHERE key = 'META_PHONE_NUMBER_ID'", [newId]);
    }
  } catch (e) {
    console.log('Send error:', e.message);
  }

  process.exit(0);
}

run();

