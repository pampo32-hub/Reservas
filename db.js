import pg from 'pg';
import dotenv from 'dotenv';
import { INITIAL_BUSINESSES, INITIAL_APPOINTMENTS, INITIAL_CLIENTS } from './src/data/initialData.js';

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
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Añadir columnas si no existen (migración segura)
    await client.query(`
      ALTER TABLE reservas_businesses ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '[]';
      ALTER TABLE reservas_businesses ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE;
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
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      ALTER TABLE reservas_clients ADD COLUMN IF NOT EXISTS password VARCHAR(255);
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

    // Sembrar cuenta Master Developer si no existe
    const devEmail = process.env.DEVELOPER_EMAIL || 'admin@reservas.cr';
    const devPassword = process.env.DEVELOPER_PASSWORD || 'admin123';
    await client.query(`
      INSERT INTO reservas_developer_users (id, name, email, password, role)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password
    `, ['dev-master', 'Master Developer', devEmail, devPassword, 'developer']);

    console.log('✅ Tablas y cuenta Developer verificadas/creadas en Neon PostgreSQL.');

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
          client_email, notes, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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
          status = EXCLUDED.status
      `, [
        apt.id, apt.businessId, apt.serviceId, apt.serviceName, apt.servicePrice,
        apt.serviceDuration, apt.date, apt.time, apt.clientName, apt.clientPhone,
        apt.clientEmail, apt.notes, apt.status
      ]);
    }

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

