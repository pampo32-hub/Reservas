import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function sendOfficialTemplate() {
  const res = await pool.query("SELECT key, value FROM reservas_system_settings WHERE key LIKE 'META_%'");
  const creds = {};
  res.rows.forEach(r => creds[r.key] = r.value);
  const token = creds.META_WHATSAPP_TOKEN;
  const phoneId = '1305807259289667';
  const wabaId = '1127298519974904';

  // Guardar credenciales de producción en la base de datos
  await pool.query("UPDATE reservas_system_settings SET value = $1, updated_at = NOW() WHERE key = 'META_PHONE_NUMBER_ID'", [phoneId]);
  await pool.query("UPDATE reservas_system_settings SET value = $1, updated_at = NOW() WHERE key = 'META_WABA_ID'", [wabaId]);
  console.log('✅ Base de datos actualizada con Phone ID:', phoneId, 'y WABA ID:', wabaId);

  // Verificar estado del teléfono
  const pRes = await fetch(`https://graph.facebook.com/v20.0/${phoneId}?fields=id,display_phone_number,verified_name,status,quality_rating`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('Estado teléfono oficial:', await pRes.json());

  console.log('🚀 Enviando confirmacion_cita oficial desde +506 7101 5954 a 50671433852...');
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
  console.log('HTTP Status:', sendRes.status);
  console.log('Resultado envío oficial:', JSON.stringify(sendData, null, 2));

  process.exit(0);
}

sendOfficialTemplate();

