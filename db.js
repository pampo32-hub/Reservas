import pg from 'pg';
import dotenv from 'dotenv';
import { INITIAL_BUSINESSES, INITIAL_APPOINTMENTS } from './src/data/initialData.js';

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
        email VARCHAR(150) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log('✅ Tablas verificadas/creadas en Neon PostgreSQL.');

    // Verificar si hay que sembrar datos iniciales
    const bizCheck = await client.query('SELECT COUNT(*) FROM reservas_businesses');
    if (parseInt(bizCheck.rows[0].count, 10) === 0) {
      console.log('🌱 Sembrando datos iniciales en Neon DB...');

      for (const biz of INITIAL_BUSINESSES) {
        await client.query(`
          INSERT INTO reservas_businesses (
            id, name, category, category_label, rating, reviews_count,
            price_range, address, city, phone, email, description,
            image, cover_image, schedule
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        `, [
          biz.id, biz.name, biz.category, biz.categoryLabel, biz.rating, biz.reviewsCount,
          biz.priceRange, biz.address, biz.city, biz.phone, biz.email, biz.description,
          biz.image, biz.coverImage, JSON.stringify(biz.schedule)
        ]);

        for (const srv of biz.services) {
          await client.query(`
            INSERT INTO reservas_services (id, business_id, name, duration, price, description)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [srv.id, biz.id, srv.name, srv.duration, srv.price, srv.description]);
        }
      }

      for (const apt of INITIAL_APPOINTMENTS) {
        await client.query(`
          INSERT INTO reservas_appointments (
            id, business_id, service_id, service_name, service_price,
            service_duration, date, time, client_name, client_phone,
            client_email, notes, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `, [
          apt.id, apt.businessId, apt.serviceId, apt.serviceName, apt.servicePrice,
          apt.serviceDuration, apt.date, apt.time, apt.clientName, apt.clientPhone,
          apt.clientEmail, apt.notes, apt.status
        ]);
      }

    }

    // Asegurar usuarios demo de negocios
    const demoUsers = [
      { id: 'usr-1', businessId: 'biz-1', name: 'Dueño Barbería Vintage', email: 'barberia@demo.cr', password: '123' },
      { id: 'usr-2', businessId: 'biz-2', name: 'Dr. Roberto Salas', email: 'dental@demo.cr', password: '123' },
      { id: 'usr-3', businessId: 'biz-3', name: 'Laura Vargas (Spa)', email: 'spa@demo.cr', password: '123' },
      { id: 'usr-4', businessId: 'biz-4', name: 'Carlos Monge (Taller)', email: 'taller@demo.cr', password: '123' }
    ];

    for (const u of demoUsers) {
      await client.query(`
        INSERT INTO reservas_business_users (id, business_id, name, email, password)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (email) DO NOTHING
      `, [u.id, u.businessId, u.name, u.email, u.password]);
    }
    console.log('✨ Usuarios demo verificados/creados.');

  } catch (error) {
    console.error('❌ Error inicializando base de datos Neon:', error);
  } finally {
    client.release();
  }
}

