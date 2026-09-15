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
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(express.static(__dirname));

// ==========================================
// ENDPOINTS DE AUTENTICACIÓN
// ==========================================

// 1. Login de Dueño de Negocio (Email y Contraseña)
app.post('/api/auth/business/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Debes ingresar correo y contraseña.' });
    }

    const userRes = await pool.query(
      'SELECT * FROM reservas_business_users WHERE LOWER(email) = LOWER($1) AND password = $2',
      [email.trim(), password.trim()]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas. Verifica tu correo y contraseña.' });
    }

    const user = userRes.rows[0];
    const bizRes = await pool.query('SELECT * FROM reservas_businesses WHERE id = $1', [user.business_id]);
    const business = bizRes.rows[0] || null;

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        businessId: user.business_id
      },
      business
    });
  } catch (error) {
    console.error('Error en login negocio:', error);
    res.status(500).json({ error: 'Error en el servidor al autenticar negocio.' });
  }
});

// 2. Registro de Negocio con Usuario y Contraseña
app.post('/api/auth/business/register', async (req, res) => {
  try {
    const { ownerName, email, password, business } = req.body;
    if (!email || !password || !business || !business.name) {
      return res.status(400).json({ error: 'Faltan campos obligatorios para registrar el negocio.' });
    }

    // Verificar si el correo ya existe
    const existing = await pool.query('SELECT id FROM reservas_business_users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Ya existe una cuenta con este correo electrónico.' });
    }

    const newBizId = `biz-${Date.now()}`;
    const newUserId = `usr-${Date.now()}`;
    const schedule = business.schedule || {
      days: [1, 2, 3, 4, 5, 6],
      openTime: '08:00',
      closeTime: '18:00',
      breakStart: '12:00',
      breakEnd: '13:00',
      slotDuration: 30
    };
    const features = business.features || ['Sinpe Móvil', 'Atención Personalizada'];

    // Insertar negocio
    await pool.query(`
      INSERT INTO reservas_businesses (
        id, name, category, category_label, rating, reviews_count,
        price_range, address, city, phone, email, description,
        image, cover_image, schedule, features, is_demo
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    `, [
      newBizId, business.name, business.category, business.categoryLabel || 'Servicios',
      5.0, 0, business.priceRange || '₡₡',
      business.address || '', business.city || '', business.phone || '', email.trim(),
      business.description || '', business.image || '', business.coverImage || '',
      JSON.stringify(schedule), JSON.stringify(features), false
    ]);

    // Insertar usuario del negocio
    await pool.query(`
      INSERT INTO reservas_business_users (id, business_id, name, email, password)
      VALUES ($1, $2, $3, $4, $5)
    `, [newUserId, newBizId, ownerName || business.name, email.trim(), password.trim()]);

    // Insertar primer servicio si existe
    if (business.services && Array.isArray(business.services)) {
      for (const s of business.services) {
        await pool.query(`
          INSERT INTO reservas_services (id, business_id, name, duration, price, description)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [s.id || `srv-${Date.now()}`, newBizId, s.name, s.duration || 30, s.price || 0, s.description || '']);
      }
    }

    res.status(201).json({
      success: true,
      user: {
        id: newUserId,
        name: ownerName || business.name,
        email: email.trim(),
        businessId: newBizId
      },
      business: { id: newBizId, ...business }
    });
  } catch (error) {
    console.error('Error en registro de negocio:', error);
    res.status(500).json({ error: 'Error al registrar negocio y usuario.' });
  }
});

// 3. Login / Registro Rápido de Cliente (Solo Nombre, Teléfono, Correo)
app.post('/api/auth/client/login-or-register', async (req, res) => {
  try {
    const { name, phone, email } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ error: 'Nombre y Teléfono son requeridos.' });
    }

    // Buscar si ya existe por teléfono o correo
    const existing = await pool.query(
      'SELECT * FROM reservas_clients WHERE phone = $1 OR (email = $2 AND email != \'\')',
      [phone.trim(), (email || '').trim()]
    );

    let clientUser;
    if (existing.rows.length > 0) {
      clientUser = existing.rows[0];
      // Actualizar nombre si cambió
      await pool.query('UPDATE reservas_clients SET name = $1, email = $2 WHERE id = $3', [name.trim(), (email || clientUser.email).trim(), clientUser.id]);
      clientUser.name = name.trim();
      clientUser.email = (email || clientUser.email).trim();
    } else {
      const newClientId = `cli-${Date.now()}`;
      await pool.query(`
        INSERT INTO reservas_clients (id, name, phone, email)
        VALUES ($1, $2, $3, $4)
      `, [newClientId, name.trim(), phone.trim(), (email || '').trim()]);

      clientUser = {
        id: newClientId,
        name: name.trim(),
        phone: phone.trim(),
        email: (email || '').trim()
      };
    }

    res.json({ success: true, client: clientUser });
  } catch (error) {
    console.error('Error en login/registro cliente:', error);
    res.status(500).json({ error: 'Error al procesar acceso de cliente.' });
  }
});

// ==========================================
// ENDPOINTS DE NEGOCIOS Y SERVICIOS
// ==========================================

// Obtener todos los negocios
app.get('/api/businesses', async (req, res) => {
  try {
    const bizRes = await pool.query('SELECT * FROM reservas_businesses ORDER BY is_demo DESC, created_at ASC');
    const srvRes = await pool.query('SELECT * FROM reservas_services ORDER BY created_at ASC');

    const businesses = bizRes.rows.map(b => ({
      id: b.id,
      name: b.name,
      category: b.category,
      categoryLabel: b.category_label,
      rating: parseFloat(b.rating),
      reviewsCount: parseInt(b.reviews_count, 10),
      priceRange: b.price_range || '₡₡',
      address: b.address,
      city: b.city,
      phone: b.phone,
      email: b.email,
      description: b.description,
      image: b.image,
      coverImage: b.cover_image,
      schedule: b.schedule,
      features: Array.isArray(b.features) ? b.features : [],
      isDemo: Boolean(b.is_demo),
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

// Obtener un negocio por ID
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
      priceRange: b.price_range || '₡₡',
      address: b.address,
      city: b.city,
      phone: b.phone,
      email: b.email,
      description: b.description,
      image: b.image,
      coverImage: b.cover_image,
      schedule: b.schedule,
      features: Array.isArray(b.features) ? b.features : [],
      isDemo: Boolean(b.is_demo),
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

// Actualizar negocio completo
app.put('/api/businesses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const b = req.body;

    await pool.query(`
      UPDATE reservas_businesses SET
        name = COALESCE($1, name),
        category = COALESCE($2, category),
        category_label = COALESCE($3, category_label),
        city = COALESCE($4, city),
        address = COALESCE($5, address),
        phone = COALESCE($6, phone),
        email = COALESCE($7, email),
        description = COALESCE($8, description),
        image = COALESCE($9, image),
        cover_image = COALESCE($10, cover_image),
        price_range = COALESCE($11, price_range),
        features = COALESCE($12, features),
        schedule = COALESCE($13, schedule)
      WHERE id = $14
    `, [
      b.name, b.category, b.categoryLabel, b.city, b.address,
      b.phone, b.email, b.description, b.image, b.coverImage,
      b.priceRange, b.features ? JSON.stringify(b.features) : null,
      b.schedule ? JSON.stringify(b.schedule) : null, id
    ]);

    res.json({ success: true, message: 'Perfil del negocio actualizado' });
  } catch (error) {
    console.error('Error actualizando negocio:', error);
    res.status(500).json({ error: 'Error al actualizar negocio' });
  }
});

// Actualizar horarios
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

// Agregar servicio a negocio
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

// Actualizar servicio existente
app.put('/api/services/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const s = req.body;

    await pool.query(`
      UPDATE reservas_services SET
        name = COALESCE($1, name),
        duration = COALESCE($2, duration),
        price = COALESCE($3, price),
        description = COALESCE($4, description)
      WHERE id = $5
    `, [s.name, parseInt(s.duration, 10), parseFloat(s.price), s.description, id]);

    res.json({ success: true, message: 'Servicio actualizado' });
  } catch (error) {
    console.error('Error actualizando servicio:', error);
    res.status(500).json({ error: 'Error al actualizar servicio' });
  }
});

// Eliminar servicio
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

// ==========================================
// ENDPOINTS DE CITAS Y RESERVAS
// ==========================================

// Obtener citas de un negocio
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

// Obtener citas de un cliente por teléfono
app.get('/api/clients/:phone/appointments', async (req, res) => {
  try {
    const { phone } = req.params;
    const result = await pool.query('SELECT a.*, b.name as business_name FROM reservas_appointments a LEFT JOIN reservas_businesses b ON a.business_id = b.id WHERE a.client_phone = $1 ORDER BY a.date DESC, a.time ASC', [phone]);

    const appointments = result.rows.map(a => ({
      id: a.id,
      businessId: a.business_id,
      businessName: a.business_name,
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
    console.error('Error consultando citas de cliente:', error);
    res.status(500).json({ error: 'Error al consultar citas' });
  }
});

// Crear nueva reserva
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

    // Registrar o actualizar automáticamente el cliente
    if (a.clientName && a.clientPhone) {
      await pool.query(`
        INSERT INTO reservas_clients (id, name, phone, email)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO NOTHING
      `, [`cli-${Date.now()}`, a.clientName, a.clientPhone, a.clientEmail || '']);
    }

    res.status(201).json({ id: newId, ...a, status: a.status || 'confirmed' });
  } catch (error) {
    console.error('Error creando cita:', error);
    res.status(500).json({ error: 'Error al registrar la reserva' });
  }
});

// Actualizar estado de una cita
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

// Eliminar cita
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
