import dotenv from 'dotenv';
import pg from 'pg';
import { sendBookingConfirmationWhatsApp } from './whatsappService.js';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  const apt1 = {
    id: 'APT-TEST714',
    clientName: 'Juan Jiménez',
    clientPhone: '50671433852',
    serviceName: 'Corte Clásico',
    servicePrice: 7000,
    serviceDuration: 30,
    date: '2026-09-16',
    time: '4:00 PM',
    whatsappOptIn: true
  };

  const apt2 = {
    id: 'APT-TEST622',
    clientName: 'Juan Carlos',
    clientPhone: '50662297240',
    serviceName: 'Corte Clásico',
    servicePrice: 7000,
    serviceDuration: 30,
    date: '2026-09-16',
    time: '4:00 PM',
    whatsappOptIn: true
  };

  const biz = {
    name: 'Barbería & Estilo Vintage',
    address: 'San José, Escazú',
    phone: '+506 2289-0000'
  };

  console.log('--- Enviando a 71433852 ---');
  const res1 = await sendBookingConfirmationWhatsApp(apt1, biz, pool);
  console.log('Respuesta 71433852:', res1);

  console.log('\n--- Enviando a 62297240 ---');
  const res2 = await sendBookingConfirmationWhatsApp(apt2, biz, pool);
  console.log('Respuesta 62297240:', res2);

  process.exit(0);
}

run();

