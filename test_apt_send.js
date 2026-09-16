import dotenv from 'dotenv';
import pg from 'pg';
import { sendBookingConfirmationWhatsApp } from './whatsappService.js';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  const aptRes = await pool.query("SELECT * FROM reservas_appointments WHERE id = 'apt-906899'");
  const row = aptRes.rows[0];
  console.log('Appointment row:', row);

  // Map to camelCase as expected by whatsappService
  const appointment = {
    id: row.id,
    clientName: row.client_name,
    clientPhone: row.client_phone,
    clientEmail: row.client_email,
    serviceName: row.service_name,
    servicePrice: parseFloat(row.service_price),
    serviceDuration: row.service_duration,
    date: row.date,
    time: row.time,
    notes: row.notes,
    whatsappOptIn: row.whatsapp_opt_in
  };

  const bizRes = await pool.query("SELECT * FROM reservas_businesses WHERE id = $1", [row.business_id]);
  const business = bizRes.rows[0];
  console.log('Business:', business ? business.name : 'none');

  const result = await sendBookingConfirmationWhatsApp(appointment, business, pool);
  console.log('Send Result:', JSON.stringify(result, null, 2));

  process.exit(0);
}

run();

