import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const res = await pool.query("SELECT key, value FROM reservas_system_settings WHERE key LIKE 'META_%'");
const creds = {};
res.rows.forEach(r => creds[r.key] = r.value);
const token = creds.META_WHATSAPP_TOKEN;
const wabaId = creds.META_WABA_ID || '1435218878598380';
const phoneId = creds.META_PHONE_NUMBER_ID || '1358707247317897';

console.log('Fetching templates from WABA ID:', wabaId);

// 1. Consultar plantillas registradas en la WABA
const response = await fetch(`https://graph.facebook.com/v20.0/${wabaId}/message_templates`, {
  headers: { 'Authorization': `Bearer ${token}` }
});

const data = await response.json();
console.log('Templates en Meta WABA:');
if (data.data) {
  data.data.forEach(t => {
    console.log(`- Nombre: "${t.name}", Idioma: "${t.language}", Estado: "${t.status}", Categoria: "${t.category}"`);
  });
} else {
  console.log('Error o respuesta vacia:', JSON.stringify(data, null, 2));
}

// 2. Probar con los idiomas es_LA, es_ES, es_CR si la plantilla existe
if (data.data && data.data.length > 0) {
  const approved = data.data.find(t => t.status === 'APPROVED');
  if (approved) {
    console.log(`\n🚀 Enviando prueba con la plantilla aprobada: "${approved.name}" (Idioma: "${approved.language}")...`);
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
          name: approved.name,
          language: { code: approved.language },
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
    console.log('Status envío:', sendRes.status);
    console.log('Resultado envío:', JSON.stringify(sendData, null, 2));
  }
}

process.exit(0);

