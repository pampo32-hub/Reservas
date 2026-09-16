import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function checkAndSend() {
  const res = await pool.query("SELECT key, value FROM reservas_system_settings WHERE key LIKE 'META_%'");
  const creds = {};
  res.rows.forEach(r => creds[r.key] = r.value);
  const token = creds.META_WHATSAPP_TOKEN;
  const sandboxWaba = '1435218878598380';
  const phoneId = creds.META_PHONE_NUMBER_ID || '1358707247317897';

  console.log(`[${new Date().toLocaleTimeString()}] Consultando estado de confirmacion_cita en Meta...`);
  const tSearch = await fetch(`https://graph.facebook.com/v20.0/${sandboxWaba}/message_templates?name=confirmacion_cita`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const tData = await tSearch.json();
  const template = tData.data?.[0];

  console.log('Estado actual:', template ? `${template.name} (${template.language}) -> ${template.status}` : 'No encontrada');

  if (template && template.status === 'APPROVED') {
    console.log('🎉 ¡PLANTILLA APROBADA POR META! Enviando mensaje oficial a 50671433852...');
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
          language: { code: template.language || 'es' },
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
    console.log('Resultado del envío:', JSON.stringify(sendData, null, 2));
    return true;
  }
  return false;
}

async function run() {
  const isDone = await checkAndSend();
  if (isDone) {
    process.exit(0);
  } else {
    console.log('Aún en revisión por Meta. Volviendo a verificar...');
    process.exit(0);
  }
}

run();

