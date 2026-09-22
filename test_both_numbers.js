import dotenv from 'dotenv';
import pg from 'pg';
import { 
  sendBookingConfirmationWhatsApp, 
  sendNewBookingAlertToBusinessWhatsApp 
} from './whatsappService.js';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  const apt = {
    id: 'APT-VERIFICA',
    clientName: 'Cliente Prueba (Juan)',
    clientPhone: '50671433852',
    clientEmail: 'cliente@reservascr.com',
    serviceName: 'Corte de Cabello & Barba',
    servicePrice: 8500,
    serviceDuration: 45,
    date: '2026-09-22',
    time: '3:30 PM',
    whatsappOptIn: true,
    notes: 'Prueba de notificación dual (Cliente + Comercio)'
  };

  const biz = {
    name: 'Salón & Spa Elegance CR',
    address: 'San José, Montes de Oca',
    phone: '50662297240' // Teléfono del negocio para recibir alerta
  };

  console.log('1️⃣ --- ENVIANDO WHATSAPP AL CLIENTE (71433852) ---');
  const resClient = await sendBookingConfirmationWhatsApp(apt, biz, pool);
  console.log('Resultado Cliente:', resClient);

  console.log('\n2️⃣ --- ENVIANDO WHATSAPP AL COMERCIO (62297240) ---');
  const resBiz = await sendNewBookingAlertToBusinessWhatsApp(apt, biz, pool);
  console.log('Resultado Comercio:', resBiz);

  process.exit(0);
}

run();

