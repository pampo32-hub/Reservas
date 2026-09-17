import dotenv from 'dotenv';
import pg from 'pg';
import { sendBookingConfirmationWhatsApp } from './whatsappService.js';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const newToken = 'EAAPSnnSHjkQBSYsTNZBKiBcMWM7M1j0NmDrsfMEt9U5ZBtlaZCyfZAVpWH9qg6DPyJYBBvC9YUnqgZC0WKH4CKix9beQRseKW0Nx6LJsE8CR3Qq6mt70UUIdYWOjHX9MYltcCtb4KZAuaoovwdvdh0W1XZAD2U6FF2dbUEgUGqc9lCx1zNHEZCDFcId6QKCI8AZDZD';
const phoneId = '1305807259289667';
const wabaId = '1127298519974904';

async function run() {
  console.log('1. Guardando token en PostgreSQL...');
  await pool.query(
    'INSERT INTO reservas_system_settings (key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()',
    ['META_WHATSAPP_TOKEN', newToken]
  );
  console.log('✅ Token guardado.');

  console.log('\n2. Consultando detalles del teléfono...');
  const pRes = await fetch(`https://graph.facebook.com/v20.0/${phoneId}?fields=id,display_phone_number,verified_name,status,quality_rating,name_status`, {
    headers: { Authorization: `Bearer ${newToken}` }
  });
  const pData = await pRes.json();
  console.log('Phone Data:', pData);

  console.log('\n3. Registrando teléfono con PIN 123456...');
  const regRes = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/register`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${newToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      pin: '123456'
    })
  });
  console.log('Register Response:', await regRes.json());

  console.log('\n4. Enviando WhatsApp de prueba a Juan (71433852)...');
  const apt = {
    id: 'APT-LIVE1',
    clientName: 'Juan',
    clientPhone: '50671433852',
    serviceName: 'Prueba Oficial WhatsApp',
    servicePrice: 5000,
    serviceDuration: 30,
    date: '2026-09-16',
    time: '3:00 PM',
    whatsappOptIn: true
  };
  const biz = {
    name: 'Reservas CR Oficial',
    address: 'San José, Costa Rica',
    phone: '+506 7101-5954'
  };

  const sendResult = await sendBookingConfirmationWhatsApp(apt, biz, pool);
  console.log('\n5. Resultado de Envío:', sendResult);

  process.exit(0);
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

