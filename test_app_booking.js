import dotenv from 'dotenv';
import pg from 'pg';
import { sendBookingConfirmationWhatsApp } from './whatsappService.js';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  const appointment = {
    id: 'APT-CR992',
    clientName: 'Juan Jiménez',
    clientPhone: '50671433852',
    businessName: 'Barbería Vintage Costa Rica',
    serviceName: 'Corte Ejecutivo & Barba Completa',
    servicePrice: 12000,
    serviceDuration: 50,
    date: '2026-09-17',
    time: '16:00',
    notes: 'Prueba de confirmación oficial',
    whatsappOptIn: true
  };

  const business = {
    name: 'Barbería Vintage Costa Rica',
    address: 'Avenida Escazú, Local 12',
    city: 'San José, Escazú',
    phone: '+506 2289-5000'
  };

  console.log('Testing full sendBookingConfirmationWhatsApp function...');
  const res = await sendBookingConfirmationWhatsApp(appointment, business, pool);
  console.log('Result:', JSON.stringify(res, null, 2));

  process.exit(0);
}

run();

