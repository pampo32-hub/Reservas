import pg from 'pg';
import dotenv from 'dotenv';
import { INITIAL_BUSINESSES, INITIAL_APPOINTMENTS, INITIAL_CLIENTS, INITIAL_STAFF } from './src/data/initialData.js';

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Inicializar tablas y datos iniciales en Neon PostgreSQL
export async function initDatabase() {
  const client = await pool.connect();
  try {
    console.log('🔗 Conectando a Neon PostgreSQL...');

    // 1. Crear tabla de negocios
    await client.query(`
      CREATE TABLE IF NOT EXISTS reservas_businesses (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        category_label VARCHAR(100),
        rating NUMERIC(3,2) DEFAULT 5.0,
        reviews_count INT DEFAULT 0,
        price_range VARCHAR(10) DEFAULT '₡₡',
        address TEXT,
        city VARCHAR(100),
        phone VARCHAR(50),
        email VARCHAR(150),
        description TEXT,
        image TEXT,
        cover_image TEXT,
        schedule JSONB NOT NULL,
        features JSONB DEFAULT '[]',
        is_demo BOOLEAN DEFAULT FALSE,
        is_hidden BOOLEAN DEFAULT FALSE,
        is_blocked BOOLEAN DEFAULT FALSE,
        block_reason TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Añadir columnas si no existen (migración segura)
    await client.query(`
      ALTER TABLE reservas_businesses ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '[]';
      ALTER TABLE reservas_businesses ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE;
      ALTER TABLE reservas_businesses ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;
      ALTER TABLE reservas_businesses ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE;
      ALTER TABLE reservas_businesses ADD COLUMN IF NOT EXISTS block_reason TEXT DEFAULT '';
      ALTER TABLE reservas_businesses ADD COLUMN IF NOT EXISTS plan VARCHAR(50) DEFAULT 'basic';
      ALTER TABLE reservas_businesses ADD COLUMN IF NOT EXISTS plan_price_usd NUMERIC(10,2) DEFAULT 8.00;
      ALTER TABLE reservas_businesses ADD COLUMN IF NOT EXISTS monthly_booking_limit INT DEFAULT 150;
      ALTER TABLE reservas_businesses ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}';
      ALTER TABLE reservas_businesses ADD COLUMN IF NOT EXISTS auto_confirm_appointments BOOLEAN DEFAULT TRUE;
      ALTER TABLE reservas_businesses ADD COLUMN IF NOT EXISTS paypal_subscription_id VARCHAR(100) DEFAULT NULL;
      ALTER TABLE reservas_businesses ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'trial';
      ALTER TABLE reservas_businesses ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'none';
      ALTER TABLE reservas_businesses ADD COLUMN IF NOT EXISTS subscription_updated_at TIMESTAMP DEFAULT NOW();
    `);

    // 2. Crear tabla de servicios
    await client.query(`
      CREATE TABLE IF NOT EXISTS reservas_services (
        id VARCHAR(50) PRIMARY KEY,
        business_id VARCHAR(50) REFERENCES reservas_businesses(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        duration INT NOT NULL,
        price NUMERIC(10,2) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 3. Crear tabla de citas / reservas
    await client.query(`
      CREATE TABLE IF NOT EXISTS reservas_appointments (
        id VARCHAR(50) PRIMARY KEY,
        business_id VARCHAR(50) REFERENCES reservas_businesses(id) ON DELETE CASCADE,
        service_id VARCHAR(50),
        service_name VARCHAR(255),
        service_price NUMERIC(10,2),
        service_duration INT,
        date VARCHAR(20) NOT NULL,
        time VARCHAR(10) NOT NULL,
        client_name VARCHAR(255) NOT NULL,
        client_phone VARCHAR(50) NOT NULL,
        client_email VARCHAR(150),
        notes TEXT,
        status VARCHAR(50) DEFAULT 'confirmed',
        whatsapp_opt_in BOOLEAN DEFAULT TRUE,
        staff_id VARCHAR(50) DEFAULT NULL,
        staff_name VARCHAR(255) DEFAULT NULL,
        review_email_sent_at TIMESTAMP DEFAULT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      ALTER TABLE reservas_appointments ADD COLUMN IF NOT EXISTS whatsapp_opt_in BOOLEAN DEFAULT TRUE;
      ALTER TABLE reservas_appointments ADD COLUMN IF NOT EXISTS review_email_sent_at TIMESTAMP DEFAULT NULL;
      ALTER TABLE reservas_appointments ADD COLUMN IF NOT EXISTS staff_id VARCHAR(50) DEFAULT NULL;
      ALTER TABLE reservas_appointments ADD COLUMN IF NOT EXISTS staff_name VARCHAR(255) DEFAULT NULL;
    `);

    // 3.0. Crear tabla de equipo y colaboradores/especialistas del negocio
    await client.query(`
      CREATE TABLE IF NOT EXISTS reservas_staff (
        id VARCHAR(50) PRIMARY KEY,
        business_id VARCHAR(50) REFERENCES reservas_businesses(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        role_title VARCHAR(150) DEFAULT 'Especialista',
        avatar_url TEXT DEFAULT '',
        phone VARCHAR(50) DEFAULT '',
        services JSONB DEFAULT '["all"]',
        schedule JSONB DEFAULT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 3.1. Crear tabla de reseñas y calificaciones verificadas
    await client.query(`
      CREATE TABLE IF NOT EXISTS reservas_reviews (
        id VARCHAR(50) PRIMARY KEY,
        business_id VARCHAR(50) REFERENCES reservas_businesses(id) ON DELETE CASCADE,
        appointment_id VARCHAR(50) UNIQUE,
        client_name VARCHAR(255) NOT NULL,
        client_phone VARCHAR(50),
        client_email VARCHAR(150),
        service_name VARCHAR(255),
        rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 4. Crear tabla de usuarios dueños de negocio
    await client.query(`
      CREATE TABLE IF NOT EXISTS reservas_business_users (
        id VARCHAR(50) PRIMARY KEY,
        business_id VARCHAR(50) REFERENCES reservas_businesses(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 5. Crear tabla de clientes registrados
    await client.query(`
      CREATE TABLE IF NOT EXISTS reservas_clients (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        email VARCHAR(150),
        password VARCHAR(255),
        whatsapp_opt_in BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      ALTER TABLE reservas_clients ADD COLUMN IF NOT EXISTS password VARCHAR(255);
      ALTER TABLE reservas_clients ADD COLUMN IF NOT EXISTS whatsapp_opt_in BOOLEAN DEFAULT TRUE;
      ALTER TABLE reservas_clients ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE;
      ALTER TABLE reservas_clients ADD COLUMN IF NOT EXISTS block_reason TEXT DEFAULT '';
    `);

    console.log('✅ Tablas verificadas/creadas en Neon PostgreSQL.');
    // 6. Crear tabla de SuperAdmin / Developer
    await client.query(`
      CREATE TABLE IF NOT EXISTS reservas_developer_users (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'developer',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 7. Crear tabla de alertas de categorías personalizadas creadas por comercios
    await client.query(`
      CREATE TABLE IF NOT EXISTS reservas_custom_category_alerts (
        id VARCHAR(50) PRIMARY KEY,
        business_id VARCHAR(50),
        business_name VARCHAR(255) NOT NULL,
        category_id VARCHAR(100) NOT NULL,
        category_name VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'unread',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 8. Crear tabla de configuraciones del sistema (WhatsApp, Meta API, etc.)
    await client.query(`
      CREATE TABLE IF NOT EXISTS reservas_system_settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 9. Crear tabla de franjas horarias bloqueadas por comercios
    await client.query(`
      CREATE TABLE IF NOT EXISTS reservas_blocked_slots (
        id VARCHAR(64) PRIMARY KEY,
        business_id VARCHAR(50) REFERENCES reservas_businesses(id) ON DELETE CASCADE,
        date VARCHAR(20) NOT NULL,
        time VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(business_id, date, time)
      );
    `);

    // 10. Crear tabla de pre-registros de comercios (Leads de prelanzamiento)
    await client.query(`
      CREATE TABLE IF NOT EXISTS reservas_pre_registrations (
        id VARCHAR(64) PRIMARY KEY,
        business_name VARCHAR(255) NOT NULL,
        contact_name VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        category VARCHAR(100) NOT NULL,
        city VARCHAR(100),
        plan_interest VARCHAR(50) DEFAULT 'pro',
        notes TEXT,
        is_blocked BOOLEAN DEFAULT FALSE,
        block_reason TEXT DEFAULT '',
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      ALTER TABLE reservas_pre_registrations ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE;
      ALTER TABLE reservas_pre_registrations ADD COLUMN IF NOT EXISTS block_reason TEXT DEFAULT '';
      ALTER TABLE reservas_pre_registrations ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';
    `);

    // 11. Crear tabla de códigos de restablecimiento de contraseña
    await client.query(`
      CREATE TABLE IF NOT EXISTS reservas_password_resets (
        id VARCHAR(64) PRIMARY KEY,
        email VARCHAR(150) NOT NULL,
        code VARCHAR(10) NOT NULL,
        user_type VARCHAR(50) NOT NULL,
        user_id VARCHAR(50),
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Sembrar cuenta Master Developer si no existe
    const devEmail = process.env.DEVELOPER_EMAIL || 'admin@reservas.cr';
    const devPassword = process.env.DEVELOPER_PASSWORD || 'admin123';
    await client.query(`
      INSERT INTO reservas_developer_users (id, name, email, password, role)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password
    `, ['dev-master', 'Master Developer', devEmail, devPassword, 'developer']);

    console.log('✅ Tablas y cuenta Developer verificadas/creadas en Neon PostgreSQL.');
    // Sembrar configuraciones iniciales de PayPal
    const initialPayPalSettings = [
      ['paypal_client_id', process.env.PAYPAL_CLIENT_ID || 'BAAsEQDC0BKe7tSW6HzeTRQaXGSaWDvD2WkilEkv31h9Ttq2K2phZ8RGMOp9SyNN-sM0wuAnBVMVPr7YHo'],
      ['paypal_client_secret', process.env.PAYPAL_CLIENT_SECRET || 'ECkYk7RbWEG2ok9w2Kx5SCGPHwnFegU4I8y3Jv-e-YXWR8wx6jYwXFCBSSMeICkmO2rTVFLAwDXmW6P6'],
      ['paypal_env', process.env.PAYPAL_ENV || 'live'],
      ['paypal_plan_test_id', 'P-8U675044DY030573GNKVATZQ'],
      ['paypal_plan_basic_id', 'P-2J419336TA519012VNKU75PY'],
      ['paypal_plan_pro_id', 'P-3ER02078XB861273LNKU75QA'],
      ['paypal_plan_unlimited_id', 'P-8VC868094T599031CNKU75QA']
    ];
    for (const [key, val] of initialPayPalSettings) {
      await client.query(`
        INSERT INTO reservas_system_settings (key, value, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (key) DO NOTHING
      `, [key, val]);
    }

    console.log('✅ Tablas, cuenta Developer y ajustes de PayPal verificados en Neon PostgreSQL.');

    // Sembrar o actualizar todos los comercios demo (32 negocios en 16 categorías)
    console.log('🌱 Verificando/sembrando catálogo completo de comercios iniciales...');

    for (const biz of INITIAL_BUSINESSES) {
      await client.query(`
        INSERT INTO reservas_businesses (
          id, name, category, category_label, rating, reviews_count,
          price_range, address, city, phone, email, description,
          image, cover_image, schedule, features, is_demo
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          category = EXCLUDED.category,
          category_label = EXCLUDED.category_label,
          image = EXCLUDED.image,
          cover_image = EXCLUDED.cover_image,
          city = EXCLUDED.city,
          address = EXCLUDED.address,
          phone = EXCLUDED.phone,
          email = EXCLUDED.email,
          description = EXCLUDED.description,
          features = EXCLUDED.features,
          schedule = EXCLUDED.schedule,
          is_demo = EXCLUDED.is_demo
      `, [
        biz.id, biz.name, biz.category, biz.categoryLabel, biz.rating, biz.reviewsCount,
        biz.priceRange, biz.address, biz.city, biz.phone, biz.email, biz.description,
        biz.image, biz.coverImage, JSON.stringify(biz.schedule), JSON.stringify(biz.features || []), Boolean(biz.isDemo)
      ]);

      if (biz.services && Array.isArray(biz.services)) {
        for (const srv of biz.services) {
          await client.query(`
            INSERT INTO reservas_services (id, business_id, name, duration, price, description)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              duration = EXCLUDED.duration,
              price = EXCLUDED.price,
              description = EXCLUDED.description
          `, [srv.id, biz.id, srv.name, srv.duration, srv.price, srv.description]);
        }
      }
    }

    // Sembrar o actualizar citas iniciales
    for (const apt of INITIAL_APPOINTMENTS) {
      await client.query(`
        INSERT INTO reservas_appointments (
          id, business_id, service_id, service_name, service_price,
          service_duration, date, time, client_name, client_phone,
          client_email, notes, status, whatsapp_opt_in
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (id) DO UPDATE SET
          business_id = EXCLUDED.business_id,
          service_id = EXCLUDED.service_id,
          service_name = EXCLUDED.service_name,
          service_price = EXCLUDED.service_price,
          service_duration = EXCLUDED.service_duration,
          date = EXCLUDED.date,
          time = EXCLUDED.time,
          client_name = EXCLUDED.client_name,
          client_phone = EXCLUDED.client_phone,
          client_email = EXCLUDED.client_email,
          notes = EXCLUDED.notes,
          status = EXCLUDED.status,
          whatsapp_opt_in = EXCLUDED.whatsapp_opt_in
      `, [
        apt.id, apt.businessId, apt.serviceId, apt.serviceName, apt.servicePrice,
        apt.serviceDuration, apt.date, apt.time, apt.clientName, apt.clientPhone,
        apt.clientEmail, apt.notes, apt.status, apt.whatsappOptIn !== false
      ]);
    }

    // Sembrar o actualizar personal / especialistas iniciales de ejemplo
    if (INITIAL_STAFF && Array.isArray(INITIAL_STAFF)) {
      for (const st of INITIAL_STAFF) {
        await client.query(`
          INSERT INTO reservas_staff (
            id, business_id, name, role_title, avatar_url, phone, services, schedule, is_active
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (id) DO UPDATE SET
            business_id = EXCLUDED.business_id,
            name = EXCLUDED.name,
            role_title = EXCLUDED.role_title,
            avatar_url = EXCLUDED.avatar_url,
            phone = EXCLUDED.phone,
            services = EXCLUDED.services,
            schedule = EXCLUDED.schedule,
            is_active = EXCLUDED.is_active
        `, [
          st.id,
          st.businessId,
          st.name,
          st.roleTitle || 'Especialista',
          st.avatarUrl || '',
          st.phone || '',
          JSON.stringify(st.services || ['all']),
          st.schedule ? JSON.stringify(st.schedule) : null,
          st.isActive !== false
        ]);
      }
      console.log('✨ Especialistas demo sembrados/actualizados en base de datos.');
    }

    // Asegurar planes adecuados para los negocios demo con equipo
    await client.query(`
      UPDATE reservas_businesses
      SET plan = 'pro', monthly_booking_limit = 300, plan_price_usd = 18.00
      WHERE id IN ('biz-1', 'biz-2', 'biz-3') AND (plan IS NULL OR plan = 'basic');
    `);

    // Asegurar usuarios demo de negocios
    const demoUsers = [
      { id: 'usr-1', businessId: 'biz-1', name: 'Dueño Barbería Vintage', email: 'barberia@demo.cr', password: '123' },
      { id: 'usr-1b', businessId: 'biz-1', name: 'Barbería Vintage Contacto', email: 'contacto@barberiavintage.cr', password: '123' },
      { id: 'usr-2', businessId: 'biz-2', name: 'Dueña Studio GLAM', email: 'glam@demo.cr', password: '123' },
      { id: 'usr-3', businessId: 'biz-3', name: 'Dr. Roberto Salas', email: 'dental@demo.cr', password: '123' },
      { id: 'usr-4', businessId: 'biz-4', name: 'Carlos Monge (Taller)', email: 'taller@demo.cr', password: '123' },
      { id: 'usr-7', businessId: 'biz-7', name: 'Laura Vargas (Spa)', email: 'spa@demo.cr', password: '123' }
    ];

    for (const u of demoUsers) {
      const existingUser = await client.query('SELECT id FROM reservas_business_users WHERE id = $1 OR email = $2', [u.id, u.email]);
      if (existingUser.rows.length === 0) {
        await client.query(`
          INSERT INTO reservas_business_users (id, business_id, name, email, password)
          VALUES ($1, $2, $3, $4, $5)
        `, [u.id, u.businessId, u.name, u.email, u.password]);
      } else {
        await client.query(`
          UPDATE reservas_business_users
          SET business_id = $2, name = $3, email = $4, password = $5
          WHERE id = $1 OR email = $4
        `, [u.id, u.businessId, u.name, u.email, u.password]);
      }
    }
    console.log('✨ Usuarios demo verificados/creados.');

    // Asegurar perfiles demo de Clientes
    for (const c of INITIAL_CLIENTS) {
      const existingClient = await client.query('SELECT id FROM reservas_clients WHERE id = $1 OR email = $2 OR phone = $3', [c.id, c.email, c.phone]);
      if (existingClient.rows.length === 0) {
        await client.query(`
          INSERT INTO reservas_clients (id, name, phone, email, password)
          VALUES ($1, $2, $3, $4, $5)
        `, [c.id, c.name, c.phone, c.email, c.password]);
      } else {
        await client.query(`
          UPDATE reservas_clients
          SET name = $2, phone = $3, email = $4, password = $5
          WHERE id = $1 OR email = $4 OR phone = $3
        `, [c.id, c.name, c.phone, c.email, c.password]);
      }
    }
    console.log('✨ Usuarios de negocios y perfiles de clientes demo verificados/creados.');
    console.log('✨ Base de datos poblada exitosamente con 32 comercios en 16 categorías.');

  } catch (error) {
    console.error('❌ Error inicializando base de datos Neon:', error);
  } finally {
    client.release();
  }
}

