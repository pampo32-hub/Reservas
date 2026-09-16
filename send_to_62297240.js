import dotenv from 'dotenv';
import pg from 'pg';
import { sendBookingConfirmationWhatsApp } from './whatsappService.js';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  const appointment = {
    id: 'APT-CR583',
    clientName: 'Juan Carlos',
    clientPhone: '50662297240',
    businessName: 'Studio GLAM Costa Rica',
    serviceName: 'Balayage & Tratamiento Capilar',
    servicePrice: 35000,
    serviceDuration: 120,
    date: '2026-09-18',
    time: '14:00',
    notes: 'Confirmación de cita en vivo',
    whatsappOptIn: true
  };

  const business = {
    name: 'Studio GLAM Costa Rica',
    address: 'Plaza Momentum Lindora, Local 8',
    city: 'Santa Ana, San José',
    phone: '+506 2203-8888'
  };

  console.log('Enviando mensaje de confirmación de ejemplo a +506 6229-7240...');
  const res = await sendBookingConfirmationWhatsApp(appointment, business, pool);
  console.log('Resultado del envío:', JSON.stringify(res, null, 2));

  process.exit(0);
}

run();

