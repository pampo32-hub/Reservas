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

  console.log('Intentando registrar/verificar plantilla en WABA:', wabaId);

  const templatePayload = {
    name: "confirmacion_cita",
    language: "es",
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text: "Hola {{1}}, tu reserva en {{2}} ha sido registrada con éxito:\n\n📋 *Detalles del Turno:*\n✨ *Servicio:* {{3}}\n📅 *Fecha:* {{4}}\n⏰ *Hora:* {{5}}\n💰 *Total en Local:* {{6}}\n📍 *Dirección:* {{7}}\n🔖 *Código de Reserva:* #{{8}}\n\n¡Gracias por reservar con Reservas CR!",
        example: {
          body_text: [
            [
              "Juan Jiménez",
              "Barbería Vintage Costa Rica",
              "Corte Clásico & Barba",
              "16/09/2026",
              "3:30 PM",
              "₡10.000",
              "San José, Escazú",
              "APT-714338"
            ]
          ]
        }
      }
    ]
  };

  const createRes = await fetch(`https://graph.facebook.com/v20.0/${wabaId}/message_templates`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(templatePayload)
  });

  const createData = await createRes.json();
  console.log('Respuesta creación plantilla:', JSON.stringify(createData, null, 2));

  // Consultar todas las plantillas ahora
  const tRes = await fetch(`https://graph.facebook.com/v20.0/${wabaId}/message_templates`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const tData = await tRes.json();
  console.log('\nPlantillas actuales en WABA:');
  if (tData.data) {
    tData.data.forEach(t => console.log(`- ${t.name} (${t.language}) -> ${t.status}`));
  }

  process.exit(0);
}

run();

