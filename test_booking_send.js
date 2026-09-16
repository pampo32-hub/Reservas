import dotenv from 'dotenv';
import pg from 'pg';
import { sendViaMetaCloudApi, buildBookingConfirmationText } from './whatsappService.js';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  const res = await pool.query("SELECT key, value FROM reservas_system_settings WHERE key LIKE 'META_%'");
  const creds = {};
  res.rows.forEach(r => creds[r.key] = r.value);
  const token = creds.META_WHATSAPP_TOKEN;
  const phoneId = creds.META_PHONE_NUMBER_ID || '1358707247317897';

  const appointment = {
    id: 'APT-714338',
    clientName: 'Juan Jiménez',
    businessName: 'Barbería Vintage Costa Rica',
    serviceName: 'Corte Clásico & Barba',
    servicePrice: 10000,
    serviceDuration: 45,
    date: '2026-09-16',
    time: '15:30',
    notes: 'Prueba de confirmación en vivo'
  };

  const business = {
    name: 'Barbería Vintage Costa Rica',
    address: 'Centro Comercial Escazú Village',
    city: 'San José, Escazú',
    phone: '+506 2289-0000'
  };

  const text = buildBookingConfirmationText(appointment, business);
  console.log('Sending text message...');
  try {
    const result = await sendViaMetaCloudApi('50671433852', text, { token, phoneNumberId: phoneId });
    console.log('Success sending free text:', result);
  } catch (err) {
    console.log('Free text result:', err.message);
  }

  process.exit(0);
}

run();

