import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { pool } from '../db.js';

dotenv.config();

export async function restoreBusinessFromFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Archivo no encontrado: ${filePath}`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(filePath, 'utf8');
  const backup = JSON.parse(rawData);

  const business = backup.business;
  const services = backup.services || [];
  const appointments = backup.appointments || [];
  const staff = backup.staff || [];
  const reviews = backup.reviews || [];
  const blockedSlots = backup.blocked_slots || [];

  if (!business || !business.id) {
    console.error('❌ El archivo JSON no contiene información válida de un negocio.');
    process.exit(1);
  }

  console.log(`🔄 Iniciando restauración para el comercio: "${business.name}" (${business.id})...`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Restaurar / Actualizar Negocio
    await client.query(`
      INSERT INTO reservas_businesses (
        id, name, category, category_label, rating, reviews_count, price_range,
        address, city, phone, email, description, image, cover_image, schedule,
        features, is_demo, is_hidden, is_blocked, block_reason, is_verified,
        plan, plan_price_usd, monthly_booking_limit, auto_confirm_appointments,
        slug, portfolio, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21,
        $22, $23, $24, $25,
        $26, $27, $28
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        category = EXCLUDED.category,
        category_label = EXCLUDED.category_label,
        rating = EXCLUDED.rating,
        reviews_count = EXCLUDED.reviews_count,
        address = EXCLUDED.address,
        city = EXCLUDED.city,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        description = EXCLUDED.description,
        schedule = EXCLUDED.schedule,
        features = EXCLUDED.features,
        plan = EXCLUDED.plan,
        slug = EXCLUDED.slug;
    `, [
      business.id, business.name, business.category, business.category_label, business.rating || 5.0,
      business.reviews_count || 0, business.price_range || '₡₡', business.address, business.city,
      business.phone, business.email, business.description, business.image, business.cover_image,
      JSON.stringify(business.schedule || {}), JSON.stringify(business.features || []),
      business.is_demo || false, business.is_hidden || false, business.is_blocked || false,
      business.block_reason || '', business.is_verified || false, business.plan || 'basic',
      business.plan_price_usd || 8.0, business.monthly_booking_limit || 150,
      business.auto_confirm_appointments !== false, business.slug || null,
      JSON.stringify(business.portfolio || []), business.created_at || new Date()
    ]);
    console.log('  ✅ Perfil de negocio restaurado.');

    // 2. Restaurar Servicios
    for (const s of services) {
      await client.query(`
        INSERT INTO reservas_services (id, business_id, name, duration, price, description, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          duration = EXCLUDED.duration,
          price = EXCLUDED.price,
          description = EXCLUDED.description;
      `, [s.id, business.id, s.name, s.duration, s.price, s.description, s.created_at || new Date()]);
    }
    console.log(`  ✅ ${services.length} servicios restaurados.`);

    // 3. Restaurar Colaboradores / Especialistas
    for (const st of staff) {
      await client.query(`
        INSERT INTO reservas_staff (id, business_id, name, role_title, avatar_url, phone, services, schedule, is_active, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          role_title = EXCLUDED.role_title,
          phone = EXCLUDED.phone,
          is_active = EXCLUDED.is_active;
      `, [st.id, business.id, st.name, st.role_title, st.avatar_url, st.phone, JSON.stringify(st.services || ['all']), JSON.stringify(st.schedule || null), st.is_active !== false, st.created_at || new Date()]);
    }
    console.log(`  ✅ ${staff.length} colaboradores restaurados.`);

    // 4. Restaurar Citas
    for (const a of appointments) {
      await client.query(`
        INSERT INTO reservas_appointments (
          id, business_id, service_id, service_name, service_price, service_duration,
          date, time, client_name, client_phone, client_email, notes, status,
          whatsapp_opt_in, staff_id, staff_name, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12, $13,
          $14, $15, $16, $17
        )
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          date = EXCLUDED.date,
          time = EXCLUDED.time,
          notes = EXCLUDED.notes;
      `, [
        a.id, business.id, a.service_id, a.service_name, a.service_price, a.service_duration,
        a.date, a.time, a.client_name, a.client_phone, a.client_email, a.notes, a.status || 'confirmed',
        a.whatsapp_opt_in !== false, a.staff_id, a.staff_name, a.created_at || new Date()
      ]);
    }
    console.log(`  ✅ ${appointments.length} citas restauradas.`);

    // 5. Restaurar Reseñas
    for (const r of reviews) {
      await client.query(`
        INSERT INTO reservas_reviews (id, business_id, appointment_id, client_name, client_phone, client_email, service_name, rating, comment, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          rating = EXCLUDED.rating,
          comment = EXCLUDED.comment;
      `, [r.id, business.id, r.appointment_id, r.client_name, r.client_phone, r.client_email, r.service_name, r.rating, r.comment, r.created_at || new Date()]);
    }
    console.log(`  ✅ ${reviews.length} reseñas restauradas.`);

    // 6. Restaurar Franjas Bloqueadas
    for (const bl of blockedSlots) {
      await client.query(`
        INSERT INTO reservas_blocked_slots (id, business_id, date, time, created_at)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (business_id, date, time) DO NOTHING;
      `, [bl.id, business.id, bl.date, bl.time, bl.created_at || new Date()]);
    }
    console.log(`  ✅ ${blockedSlots.length} horarios bloqueados restaurados.`);

    await client.query('COMMIT');
    console.log(`\n🎉 Restauración exitosa del comercio "${business.name}" completada sin errores.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error durante la restauración:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

if (process.argv[1] && process.argv[1].endsWith('restore-business.js')) {
  const filePath = process.argv[2];
  if (!filePath) {
    console.log('Uso: node scripts/restore-business.js <ruta-al-archivo-backup.json>');
    process.exit(1);
  }
  restoreBusinessFromFile(filePath);
}
