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

  // Actualizar META_WABA_ID en base de datos
  await pool.query("UPDATE reservas_system_settings SET value = '1127298519974904', updated_at = NOW() WHERE key = 'META_WABA_ID'");
  console.log('✅ META_WABA_ID actualizado a 1127298519974904 en BD');

  console.log(`Enviando plantilla confirmacion_cita (Idioma: es) a 50671433852 usando Phone ID: ${phoneId}...`);

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: '50671433852',
    type: 'template',
    template: {
      name: 'confirmacion_cita',
      language: {
        code: 'es'
      },
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
  };

  const sendRes = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const sendData = await sendRes.json();
  console.log('Status HTTP:', sendRes.status);
  console.log('Resultado:', JSON.stringify(sendData, null, 2));

  process.exit(0);
}

run();

