import dotenv from 'dotenv';
dotenv.config();
import { pool } from '../db.js';

async function check() {
  const res = await pool.query("SELECT id, email, password FROM reservas_business_users WHERE email = 'info@dentalart.cr'");
  console.log('RESULT:', JSON.stringify(res.rows, null, 2));
  await pool.end();
}
check().catch(console.error);
