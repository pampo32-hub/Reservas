import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, initDatabase } from './db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// --- API ENDPOINTS CON NEON POSTGRESQL ---

// 1. Obtener todos los negocios (con sus servicios incluidos)
app.get('/api/businesses', async (req, res) => {
  try {
    const bizRes = await pool.query('SELECT * FROM reservas_businesses ORDER BY created_at ASC');
    const srvRes = await pool.query('SELECT * FROM reservas_services ORDER BY created_at ASC');

    const businesses = bizRes.rows.map(b => ({
      id: b.id,
      name: b.name,
      category: b.category,
      categoryLabel: b.category_label,
      rating: parseFloat(b.rating),
      reviewsCount: parseInt(b.reviews_count, 10),
      priceRange: b.price_range,
      address: b.address,
      city: b.city,
      phone: b.phone,
      email: b.email,
      description: b.description,
      image: b.image,
      coverImage: b.cover_image,
      schedule: b.schedule,
      services: srvRes.rows
        .filter(s => s.business_id === b.id)
        .map(s => ({
          id: s.id,
          name: s.name,
          duration: s.duration,
          price: parseFloat(s.price),
          description: s.description
        }))
    }));

    res.json(businesses);
  } catch (error) {
    console.error('Error en GET /api/businesses:', error);
    res.status(500).json({ error: 'Error al consultar negocios' });
  }
});

// 2. Obtener un negocio por ID
app.get('/api/businesses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const bizRes = await pool.query('SELECT * FROM reservas_businesses WHERE id = $1', [id]);
    if (bizRes.rows.length === 0) {
      return res.status(404).json({ error: 'Negocio no encontrado' });
    }

    const b = bizRes.rows[0];
    const srvRes = await pool.query('SELECT * FROM reservas_services WHERE business_id = $1 ORDER BY created_at ASC', [id]);

    const business = {
      id: b.id,
      name: b.name,
      category: b.category,
      categoryLabel: b.category_label,
      rating: parseFloat(b.rating),
      reviewsCount: parseInt(b.reviews_count, 10),
      priceRange: b.price_range,
      address: b.address,
      city: b.city,
      phone: b.phone,
      email: b.email,
      description: b.description,
      image: b.image,
      coverImage: b.cover_image,
      schedule: b.schedule,
      services: srvRes.rows.map(s => ({
        id: s.id,
        name: s.name,
        duration: s.duration,
        price: parseFloat(s.price),
        description: s.description
      }))
    };

    res.json(business);
  } catch (error) {
    console.error('Error en GET /api/businesses/:id:', error);
    res.status(500).json({ error: 'Error al consultar negocio' });
  }
});

// 3. Crear o registrar nuevo negocio
app.post('/api/businesses', async (req, res) => {
  try {
    const b = req.body;
    const newId = b.id || `biz-${Date.now()}`;
    const schedule = b.schedule || {
      days: [1, 2, 3, 4, 5, 6],
      openTime: '09:00',
      closeTime: '19:00',
      breakStart: '14:00',
      breakEnd: '15:00',
      slotDuration: 30
    };

    await pool.query(`
      INSERT INTO reservas_businesses (
        id, name, category, category_label, rating, reviews_count,
        price_range, address, city, phone, email, description,
        image, cover_image, schedule
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    `, [
      newId, b.name, b.category, b.categoryLabel || 'Servicios',
      b.rating || 5.0, b.reviewsCount || 0, b.priceRange || '$$',
      b.address || '', b.city || '', b.phone || '', b.email || '',
      b.description || '', b.image || '', b.coverImage || '', JSON.stringify(schedule)
    ]);

    if (b.services && Array.isArray(b.services)) {
      for (const s of b.services) {
        await pool.query(`
          INSERT INTO reservas_services (id, business_id, name, duration, price, description)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [s.id || `srv-${Date.now()}-${Math.random()}`, newId, s.name, s.duration || 30, s.price || 0, s.description || '']);
      }
    }

    res.status(201).json({ id: newId, message: 'Negocio creado con éxito' });
  } catch (error) {
    console.error('Error en POST /api/businesses:', error);
    res.status(500).json({ error: 'Error al registrar negocio' });
  }
});

// 4. Actualizar horarios de un negocio
app.put('/api/businesses/:id/schedule', async (req, res) => {
  try {
    const { id } = req.params;
    const { schedule } = req.body;

    await pool.query('UPDATE reservas_businesses SET schedule = $1 WHERE id = $2', [JSON.stringify(schedule), id]);
    res.json({ success: true, message: 'Horario actualizado' });
  } catch (error) {
    console.error('Error actualizando horarios:', error);
    res.status(500).json({ error: 'Error al actualizar horarios' });
  }
});

// 5. Agregar servicio a un negocio
app.post('/api/businesses/:id/services', async (req, res) => {
  try {
    const { id: businessId } = req.params;
    const s = req.body;
    const newServiceId = `srv-${Date.now()}`;

    await pool.query(`
      INSERT INTO reservas_services (id, business_id, name, duration, price, description)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [newServiceId, businessId, s.name, parseInt(s.duration, 10) || 30, parseFloat(s.price) || 0, s.description || '']);

    res.status(201).json({ id: newServiceId, ...s });
  } catch (error) {
    console.error('Error agregando servicio:', error);
    res.status(500).json({ error: 'Error al crear servicio' });
  }
});

// 6. Eliminar servicio
app.delete('/api/services/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM reservas_services WHERE id = $1', [id]);
    res.json({ success: true, message: 'Servicio eliminado' });
  } catch (error) {
    console.error('Error eliminando servicio:', error);
    res.status(500).json({ error: 'Error al eliminar servicio' });
  }
});

// 7. Obtener citas de un negocio
app.get('/api/businesses/:id/appointments', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM reservas_appointments WHERE business_id = $1 ORDER BY date DESC, time ASC', [id]);

    const appointments = result.rows.map(a => ({
      id: a.id,
      businessId: a.business_id,
      serviceId: a.service_id,
      serviceName: a.service_name,
      servicePrice: parseFloat(a.service_price),
      serviceDuration: a.service_duration,
      date: a.date,
      time: a.time,
      clientName: a.client_name,
      clientPhone: a.client_phone,
      clientEmail: a.client_email,
      notes: a.notes,
      status: a.status,
      createdAt: a.created_at
    }));

    res.json(appointments);
  } catch (error) {
    console.error('Error consultando citas:', error);
    res.status(500).json({ error: 'Error al consultar citas' });
  }
});

// 8. Crear nueva reserva
app.post('/api/appointments', async (req, res) => {
  try {
    const a = req.body;
    const newId = `apt-${Date.now().toString().slice(-6)}`;

    await pool.query(`
      INSERT INTO reservas_appointments (
        id, business_id, service_id, service_name, service_price,
        service_duration, date, time, client_name, client_phone,
        client_email, notes, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `, [
      newId, a.businessId, a.serviceId, a.serviceName, a.servicePrice,
      a.serviceDuration, a.date, a.time, a.clientName, a.clientPhone,
      a.clientEmail || '', a.notes || '', a.status || 'confirmed'
    ]);

    res.status(201).json({ id: newId, ...a, status: a.status || 'confirmed' });
  } catch (error) {
    console.error('Error creando cita:', error);
    res.status(500).json({ error: 'Error al registrar la reserva' });
  }
});

// 9. Actualizar estado de una cita
app.patch('/api/appointments/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    await pool.query('UPDATE reservas_appointments SET status = $1 WHERE id = $2', [status, id]);
    res.json({ success: true, message: 'Estado actualizado' });
  } catch (error) {
    console.error('Error actualizando estado de cita:', error);
    res.status(500).json({ error: 'Error al actualizar cita' });
  }
});

// 10. Eliminar cita
app.delete('/api/appointments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM reservas_appointments WHERE id = $1', [id]);
    res.json({ success: true, message: 'Cita eliminada' });
  } catch (error) {
    console.error('Error eliminando cita:', error);
    res.status(500).json({ error: 'Error al eliminar cita' });
  }
});

// Iniciar base de datos y servidor
async function startServer() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`🚀 Servidor de Reservas corriendo en http://localhost:${PORT}`);
    console.log(`🐘 Conectado a Neon PostgreSQL`);
  });
}

startServer();

