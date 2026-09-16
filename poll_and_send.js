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

  console.log('Consultando estado de plantilla...');
  const tSearch = await fetch(`https://graph.facebook.com/v20.0/${wabaId}/message_templates?name=confirmacion_cita`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const tData = await tSearch.json();
  const template = tData.data ? tData.data[0] : null;
  console.log('Template status:', template ? `${template.name} (${template.language}) -> ${template.status}` : 'Not found');

  if (template && template.status === 'APPROVED') {
    console.log('🎉 Plantilla APROBADA. Enviando mensaje de prueba a 50671433852...');
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

    const sendJson = await sendRes.json();
    console.log('Status HTTP:', sendRes.status);
    console.log('Resultado envío:', JSON.stringify(sendJson, null, 2));
  } else {
    console.log('La plantilla aún se encuentra en estado:', template ? template.status : 'Desconocido');
  }

  process.exit(0);
}

run();

