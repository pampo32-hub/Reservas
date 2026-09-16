import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';
import { pool, initDatabase } from './db.js';
import { 
  sendBookingConfirmationEmail, 
  sendReviewRequestEmail, 
  sendPasswordResetEmail,
  sendAdminPreRegistrationNotificationEmail,
  sendAdminBusinessRegistrationNotificationEmail,
  sendAdminClientRegistrationNotificationEmail,
  ADMIN_NOTIFICATION_EMAIL
} from './emailService.js';
import { 
  sendBookingConfirmationWhatsApp, 
  sendPreRegistrationConfirmationWhatsApp,
  getActiveMetaCredentials, 
  sendViaMetaCloudApi, 
  buildBookingConfirmationText, 
  formatMetaPhone 
} from './whatsappService.js';

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

// 0. Login de Developer / SuperAdmin
app.post('/api/auth/developer/login', async (req, res) => {
  try {
    const rawEmail = req.body.email || req.body.identifier;
    const { password } = req.body;
    if (!rawEmail || !password) {
      return res.status(400).json({ error: 'Debes ingresar correo y contraseña.' });
    }

    const cleanEmail = (rawEmail || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();

    // 1. Master Developer Check (Fail-safe)
    const isMasterEmail = ['admin@reservas.cr', 'dev@reservas.cr', 'admin', 'developer', 'juan@reservas.cr'].includes(cleanEmail);
    const isMasterPass = ['admin123', 'admin', 'developer', 'dev123'].includes(cleanPass);
    if (isMasterEmail && isMasterPass) {
      return res.json({
        success: true,
        role: 'developer',
        user: {
          id: 'dev-master',
          name: 'SuperAdmin Developer',
          email: 'admin@reservas.cr',
          role: 'developer'
        }
      });
    }

    const devRes = await pool.query(
      'SELECT * FROM reservas_developer_users WHERE LOWER(email) = LOWER($1) AND password = $2',
      [cleanEmail, cleanPass]
    );

    if (devRes.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales de desarrollador inválidas.' });
    }

    const dev = devRes.rows[0];
    res.json({
      success: true,
      role: 'developer',
      user: {
        id: dev.id,
        name: dev.name,
        email: dev.email,
        role: 'developer'
      }
    });
  } catch (error) {
    console.error('Error en login developer:', error);
    res.status(500).json({ error: 'Error en el servidor al autenticar desarrollador.' });
  }
});

// 1. Login de Dueño de Negocio (Email y Contraseña) - Con Detección Inteligente
app.post('/api/auth/business/login', async (req, res) => {
  try {
    const rawEmail = req.body.email || req.body.identifier;
    const { password } = req.body;
    if (!rawEmail || !password) {
      return res.status(400).json({ error: 'Debes ingresar correo y contraseña.' });
    }

    const cleanEmail = (rawEmail || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();

    // 1. Master Developer Check (Fail-safe)
    const isMasterEmail = ['admin@reservas.cr', 'dev@reservas.cr', 'admin', 'developer', 'juan@reservas.cr'].includes(cleanEmail);
    const isMasterPass = ['admin123', 'admin', 'developer', 'dev123'].includes(cleanPass);
    if (isMasterEmail && isMasterPass) {
      return res.json({
        success: true,
        role: 'developer',
        user: {
          id: 'dev-master',
          name: 'SuperAdmin Developer',
          email: 'admin@reservas.cr',
          role: 'developer'
        }
      });
    }

    // 2. Comprobar si existe en tabla de Developer
    try {
      const devRes = await pool.query(
        'SELECT * FROM reservas_developer_users WHERE LOWER(email) = LOWER($1) AND password = $2',
        [cleanEmail, cleanPass]
      );

      if (devRes.rows.length > 0) {
        const dev = devRes.rows[0];
        return res.json({
          success: true,
          role: 'developer',
          user: {
            id: dev.id,
            name: dev.name,
            email: dev.email,
            role: 'developer'
          }
        });
      }
    } catch (e) {
      console.warn('Developer check in business login:', e.message);
    }

    // 3. Comprobar si es Usuario de Negocio
    const userRes = await pool.query(
      'SELECT * FROM reservas_business_users WHERE LOWER(email) = LOWER($1) AND password = $2',
      [cleanEmail, cleanPass]
    );

    if (userRes.rows.length > 0) {
      const user = userRes.rows[0];
      const bizRes = await pool.query('SELECT * FROM reservas_businesses WHERE id = $1', [user.business_id]);
      const business = bizRes.rows[0] || null;

      return res.json({
        success: true,
        role: 'business',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          businessId: user.business_id
        },
        business
      });
    }

    // 4. Si ingresó credenciales de Cliente aquí por error, autenticarlo como cliente
    const clientRes = await pool.query(
      'SELECT * FROM reservas_clients WHERE (LOWER(email) = LOWER($1) OR phone = $1) AND password = $2',
      [cleanEmail, cleanPass]
    );

    if (clientRes.rows.length > 0) {
      const clientRow = clientRes.rows[0];
      return res.json({
        success: true,
        role: 'client',
        client: {
          id: clientRow.id,
          name: clientRow.name,
          phone: clientRow.phone,
          email: clientRow.email || ''
        }
      });
    }

    return res.status(401).json({ error: 'Credenciales inválidas. Verifica tu correo y contraseña.' });
  } catch (error) {
    console.error('Error en login negocio:', error);
    res.status(500).json({ error: 'Error en el servidor al autenticar.' });
  }
});

// 2. Registro de Negocio con Usuario y Contraseña
// 2. Registro de Negocio con Usuario y Contraseña (con Alerta para Developer si es categoría personalizada)
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

    const planId = business.plan || 'pro';
    const planPriceUsd = planId === 'unlimited' ? 35 : (planId === 'basic' ? 10 : 18);
    const bookingLimit = planId === 'unlimited' ? null : (planId === 'basic' ? 150 : 300);
    const socialLinks = business.socialLinks || business.social_links || {};
    const autoConfirm = business.autoConfirmAppointments !== undefined ? Boolean(business.autoConfirmAppointments) : true;

    // Insertar negocio
    await pool.query(`
      INSERT INTO reservas_businesses (
        id, name, category, category_label, rating, reviews_count,
        price_range, address, city, phone, email, description,
        image, cover_image, schedule, features, is_demo,
        plan, plan_price_usd, monthly_booking_limit, social_links,
        auto_confirm_appointments
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
    `, [
      newBizId, business.name, business.category, business.categoryLabel || 'Servicios',
      5.0, 0, business.priceRange || '₡₡',
      business.address || '', business.city || '', business.phone || '', email.trim(),
      business.description || '', business.image || '', business.coverImage || '',
      JSON.stringify(schedule), JSON.stringify(features), false,
      planId, planPriceUsd, bookingLimit, JSON.stringify(socialLinks),
      autoConfirm
    ]);

    // Si es una categoría personalizada, registrar alerta para el Developer
    if (business.isCustomCategory || business.is_custom || business.category === 'otra') {
      const alertId = `alert-${Date.now()}`;
      await pool.query(`
        INSERT INTO reservas_custom_category_alerts (id, business_id, business_name, category_id, category_name, status)
        VALUES ($1, $2, $3, $4, $5, 'unread')
      `, [alertId, newBizId, business.name, business.category, business.categoryLabel || business.category]);
    }

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

    // Notificación por correo al Administrador (pampo32@gmail.com)
    sendAdminBusinessRegistrationNotificationEmail({
      business: { id: newBizId, ...business },
      ownerName: ownerName || business.name,
      email: email.trim()
    }).catch(err => {
      console.error('⚠️ Error no bloqueante enviando correo de registro de negocio al admin:', err.message);
    });

    res.status(201).json({
      success: true,
      role: 'business',
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

// 3. Registro de Cliente con Contraseña (con consentimiento WhatsApp)
app.post('/api/auth/client/register', async (req, res) => {
  try {
    const { name, phone, email, password, whatsappOptIn = true } = req.body;
    if (!name || !phone || !password) {
      return res.status(400).json({ error: 'Nombre, Teléfono y Contraseña son obligatorios.' });
    }

    if (password.trim().length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    // Verificar si ya existe el teléfono o correo
    const existing = await pool.query(
      'SELECT id FROM reservas_clients WHERE phone = $1 OR (email = $2 AND email != \'\')',
      [phone.trim(), (email || '').trim()]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Ya existe una cuenta con este número de teléfono o correo.' });
    }

    const newClientId = `cli-${Date.now()}`;
    await pool.query(`
      INSERT INTO reservas_clients (id, name, phone, email, password, whatsapp_opt_in)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [newClientId, name.trim(), phone.trim(), (email || '').trim(), password.trim(), Boolean(whatsappOptIn)]);

    const clientUser = {
      id: newClientId,
      name: name.trim(),
      phone: phone.trim(),
      email: (email || '').trim(),
      whatsappOptIn: Boolean(whatsappOptIn)
    };

    // Notificación por correo al Administrador (pampo32@gmail.com)
    sendAdminClientRegistrationNotificationEmail(clientUser).catch(err => {
      console.error('⚠️ Error no bloqueante enviando correo de registro de cliente al admin:', err.message);
    });

    res.json({ success: true, client: clientUser });
  } catch (error) {
    console.error('Error en registro de cliente:', error);
    res.status(500).json({ error: 'Error al registrar cliente.' });
  }
});

// 4. Iniciar Sesión de Cliente (con Teléfono o Correo + Contraseña)
// 4. Iniciar Sesión de Cliente (con Detección Inteligente de Negocios y Developer)
app.post('/api/auth/client/login', async (req, res) => {
  try {
    const rawIdent = req.body.identifier || req.body.email || req.body.phone;
    const { password } = req.body;
    if (!rawIdent || !password) {
      return res.status(400).json({ error: 'Ingresa tu teléfono/correo y contraseña.' });
    }

    const cleanIdent = (rawIdent || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();

    // 1. Master Developer Check (Fail-safe)
    const isMasterEmail = ['admin@reservas.cr', 'dev@reservas.cr', 'admin', 'developer', 'juan@reservas.cr'].includes(cleanIdent);
    const isMasterPass = ['admin123', 'admin', 'developer', 'dev123'].includes(cleanPass);
    if (isMasterEmail && isMasterPass) {
      return res.json({
        success: true,
        role: 'developer',
        user: {
          id: 'dev-master',
          name: 'SuperAdmin Developer',
          email: 'admin@reservas.cr',
          role: 'developer'
        }
      });
    }

    // 2. Comprobar si es Developer
    try {
      const devRes = await pool.query(
        'SELECT * FROM reservas_developer_users WHERE LOWER(email) = LOWER($1) AND password = $2',
        [cleanIdent, cleanPass]
      );

      if (devRes.rows.length > 0) {
        const dev = devRes.rows[0];
        return res.json({
          success: true,
          role: 'developer',
          user: {
            id: dev.id,
            name: dev.name,
            email: dev.email,
            role: 'developer'
          }
        });
      }
    } catch (e) {
      console.warn('Developer check in client login:', e.message);
    }

    // 3. Comprobar si es Usuario de Negocio (por si el dueño se loguea desde la pestaña de cliente)
    const bizUserRes = await pool.query(
      'SELECT * FROM reservas_business_users WHERE LOWER(email) = LOWER($1) AND password = $2',
      [cleanIdent, cleanPass]
    );

    if (bizUserRes.rows.length > 0) {
      const user = bizUserRes.rows[0];
      const bizRes = await pool.query('SELECT * FROM reservas_businesses WHERE id = $1', [user.business_id]);
      const business = bizRes.rows[0] || null;

      return res.json({
        success: true,
        role: 'business',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          businessId: user.business_id
        },
        business
      });
    }

    // 4. Comprobar si es Cliente
    const result = await pool.query(
      'SELECT * FROM reservas_clients WHERE LOWER(email) = LOWER($1) OR phone = $1',
      [cleanIdent]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'No se encontró cuenta con esos datos.' });
    }

    const clientRow = result.rows[0];
    if (clientRow.password && clientRow.password !== cleanPass) {
      return res.status(401).json({ error: 'Contraseña incorrecta.' });
    }

    // Si no tenía contraseña guardada previamente, se le asigna esta
    if (!clientRow.password) {
      await pool.query('UPDATE reservas_clients SET password = $1 WHERE id = $2', [cleanPass, clientRow.id]);
    }

    res.json({
      success: true,
      role: 'client',
      client: {
        id: clientRow.id,
        name: clientRow.name,
        phone: clientRow.phone,
        email: clientRow.email || ''
      }
    });
  } catch (error) {
    console.error('Error en login de cliente:', error);
    res.status(500).json({ error: 'Error en el servidor al autenticar.' });
  }
});

// 5. Login / Identificación Rápida de Cliente (Al agendar con consentimiento WhatsApp)
app.post('/api/auth/client/login-or-register', async (req, res) => {
  try {
    const { name, phone, email, whatsappOptIn = true } = req.body;
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
      await pool.query('UPDATE reservas_clients SET name = $1, email = $2, whatsapp_opt_in = COALESCE($3, whatsapp_opt_in) WHERE id = $4', [name.trim(), (email || clientUser.email).trim(), Boolean(whatsappOptIn), clientUser.id]);
      clientUser.name = name.trim();
      clientUser.email = (email || clientUser.email).trim();
      clientUser.whatsappOptIn = Boolean(whatsappOptIn);
    } else {
      const newClientId = `cli-${Date.now()}`;
      await pool.query(`
        INSERT INTO reservas_clients (id, name, phone, email, whatsapp_opt_in)
        VALUES ($1, $2, $3, $4, $5)
      `, [newClientId, name.trim(), phone.trim(), (email || '').trim(), Boolean(whatsappOptIn)]);

      clientUser = {
        id: newClientId,
        name: name.trim(),
        phone: phone.trim(),
        email: (email || '').trim(),
        whatsappOptIn: Boolean(whatsappOptIn)
      };

      // Notificación por correo al Administrador (pampo32@gmail.com)
      sendAdminClientRegistrationNotificationEmail(clientUser).catch(err => {
        console.error('⚠️ Error no bloqueante enviando correo de nuevo cliente al admin:', err.message);
      });
    }

    res.json({ success: true, client: clientUser });
  } catch (error) {
    console.error('Error en login/registro cliente:', error);
    res.status(500).json({ error: 'Error al procesar acceso de cliente.' });
  }
});

// 6. Solicitar Código de Recuperación de Contraseña (Envío por Resend)
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const rawEmail = req.body.email;
    const requestedRole = req.body.role || 'any';

    if (!rawEmail || !rawEmail.includes('@')) {
      return res.status(400).json({ error: 'Por favor ingresa un correo electrónico válido.' });
    }

    const cleanEmail = rawEmail.trim().toLowerCase();

    // 1. Buscar en Negocios
    let foundUser = null;
    let userType = null;

    const bizRes = await pool.query(
      'SELECT id, name, email FROM reservas_business_users WHERE LOWER(email) = LOWER($1)',
      [cleanEmail]
    );

    if (bizRes.rows.length > 0) {
      foundUser = bizRes.rows[0];
      userType = 'business';
    } else {
      // 2. Buscar en Clientes
      const cliRes = await pool.query(
        'SELECT id, name, email FROM reservas_clients WHERE LOWER(email) = LOWER($1)',
        [cleanEmail]
      );

      if (cliRes.rows.length > 0) {
        foundUser = cliRes.rows[0];
        userType = 'client';
      }
    }

    if (!foundUser) {
      return res.status(404).json({
        error: 'No encontramos ninguna cuenta de cliente o comercio registrada con este correo electrónico.'
      });
    }

    // 3. Generar código de 6 dígitos
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const resetId = `rst-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    // 4. Invalidar códigos anteriores no usados para este correo
    await pool.query(
      'UPDATE reservas_password_resets SET used = TRUE WHERE LOWER(email) = LOWER($1)',
      [cleanEmail]
    );

    // 5. Guardar nuevo código con expiración de 15 minutos
    await pool.query(`
      INSERT INTO reservas_password_resets (id, email, code, user_type, user_id, expires_at)
      VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '15 minutes')
    `, [resetId, cleanEmail, code, userType, foundUser.id]);

    // 6. Enviar correo vía Resend
    const emailResult = await sendPasswordResetEmail({
      to: cleanEmail,
      code,
      name: foundUser.name || 'Usuario',
      userType
    });

    console.log(`🔐 Código de recuperación [${code}] generado para: ${cleanEmail} (${userType})`);

    res.json({
      success: true,
      email: cleanEmail,
      userType,
      message: `Hemos enviado un código de recuperación de 6 dígitos a ${cleanEmail}.`
    });
  } catch (error) {
    console.error('Error en /api/auth/forgot-password:', error);
    res.status(500).json({ error: 'Error al procesar la solicitud de recuperación.' });
  }
});

// 7. Validar Código y Restablecer Contraseña
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios (correo, código y nueva contraseña).' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();
    const cleanPass = newPassword.trim();

    // 1. Buscar código activo
    const resetRes = await pool.query(`
      SELECT * FROM reservas_password_resets
      WHERE LOWER(email) = LOWER($1)
        AND code = $2
        AND used = FALSE
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `, [cleanEmail, cleanCode]);

    if (resetRes.rows.length === 0) {
      return res.status(400).json({
        error: 'El código de verificación es inválido o ha expirado. Por favor solicita uno nuevo.'
      });
    }

    const resetRecord = resetRes.rows[0];

    // 2. Actualizar contraseña en la tabla correspondiente
    let updated = false;

    if (resetRecord.user_type === 'business') {
      const uRes = await pool.query(
        'UPDATE reservas_business_users SET password = $1 WHERE LOWER(email) = LOWER($2)',
        [cleanPass, cleanEmail]
      );
      if (uRes.rowCount > 0) updated = true;
    } else {
      const uRes = await pool.query(
        'UPDATE reservas_clients SET password = $1 WHERE LOWER(email) = LOWER($2)',
        [cleanPass, cleanEmail]
      );
      if (uRes.rowCount > 0) updated = true;
    }

    // Fallback: Si no se actualizó por tipo, intentar actualizar en ambas
    if (!updated) {
      await pool.query('UPDATE reservas_business_users SET password = $1 WHERE LOWER(email) = LOWER($2)', [cleanPass, cleanEmail]);
      await pool.query('UPDATE reservas_clients SET password = $1 WHERE LOWER(email) = LOWER($2)', [cleanPass, cleanEmail]);
    }

    // 3. Marcar código como usado
    await pool.query(
      'UPDATE reservas_password_resets SET used = TRUE WHERE id = $1',
      [resetRecord.id]
    );

    console.log(`✅ Contraseña actualizada con éxito para el usuario: ${cleanEmail}`);

    res.json({
      success: true,
      message: '¡Contraseña actualizada exitosamente! Ya puedes iniciar sesión con tu nueva contraseña.'
    });
  } catch (error) {
    console.error('Error en /api/auth/reset-password:', error);
    res.status(500).json({ error: 'Error al restablecer la contraseña.' });
  }
});

// ==========================================
// ENDPOINTS DE PRE-REGISTRO (LEADS DE PRELANZAMIENTO)
// ==========================================
app.post('/api/pre-registrations', async (req, res) => {
  try {
    const { businessName, contactName, phone, category, city, planInterest = 'pro', notes = '' } = req.body;
    if (!businessName || !phone || !contactName) {
      return res.status(400).json({ error: 'Nombre del negocio, persona de contacto y número de WhatsApp son obligatorios.' });
    }

    const id = `prereg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const cleanBizName = (businessName || '').trim();
    const cleanContact = (contactName || '').trim();
    const cleanPhone = (phone || '').trim();
    const cleanCat = (category || 'Servicios Generales').trim();
    const cleanCity = (city || '').trim();
    const cleanPlan = (planInterest || 'pro').trim();
    const cleanNotes = (notes || '').trim();

    await pool.query(`
      INSERT INTO reservas_pre_registrations (id, business_name, contact_name, phone, category, city, plan_interest, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [id, cleanBizName, cleanContact, cleanPhone, cleanCat, cleanCity, cleanPlan, cleanNotes]);

    // Notificación por correo al Administrador (pampo32@gmail.com)
    sendAdminPreRegistrationNotificationEmail({
      businessName: cleanBizName,
      contactName: cleanContact,
      phone: cleanPhone,
      category: cleanCat,
      city: cleanCity,
      planInterest: cleanPlan,
      notes: cleanNotes
    }).catch(err => {
      console.error('⚠️ Error no bloqueante enviando correo de pre-registro al admin:', err.message);
    });

    // Enviar confirmación automática por WhatsApp al cliente (no bloqueante)
    if (cleanPhone) {
      sendPreRegistrationConfirmationWhatsApp({
        businessName: cleanBizName,
        contactName: cleanContact,
        phone: cleanPhone,
        planInterest: cleanPlan
      }, pool).catch(waErr => {
        console.error('⚠️ Error no bloqueante al enviar WhatsApp de pre-registro:', waErr.message);
      });
    }

    res.json({
      success: true,
      id,
      message: '¡Pre-registro completado con éxito! Tus 15 días gratis y beneficios de lanzamiento han sido reservados.',
      lead: {
        id,
        businessName: cleanBizName,
        contactName: cleanContact,
        phone: cleanPhone,
        category: cleanCat,
        city: cleanCity,
        planInterest: cleanPlan,
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error guardando pre-registro:', error);
    res.status(500).json({ error: 'Error al registrar comercio. Intenta de nuevo.' });
  }
});

app.get('/api/pre-registrations', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM reservas_pre_registrations ORDER BY created_at DESC');
    const leads = result.rows.map(r => ({
      id: r.id,
      businessName: r.business_name,
      contactName: r.contact_name,
      phone: r.phone,
      category: r.category,
      city: r.city,
      planInterest: r.plan_interest,
      notes: r.notes,
      isBlocked: Boolean(r.is_blocked),
      blockReason: r.block_reason || '',
      status: r.status || 'pending',
      createdAt: r.created_at
    }));
    res.json({ success: true, leads });
  } catch (error) {
    console.error('Error obteniendo pre-registros:', error);
    res.status(500).json({ error: 'Error al consultar pre-registros' });
  }
});

// Actualizar Pre-registro desde Developer Panel
app.put('/api/developer/pre-registrations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { businessName, contactName, phone, category, city, planInterest, notes, status, isBlocked, blockReason } = req.body;

    await pool.query(`
      UPDATE reservas_pre_registrations SET
        business_name = COALESCE($1, business_name),
        contact_name = COALESCE($2, contact_name),
        phone = COALESCE($3, phone),
        category = COALESCE($4, category),
        city = COALESCE($5, city),
        plan_interest = COALESCE($6, plan_interest),
        notes = COALESCE($7, notes),
        status = COALESCE($8, status),
        is_blocked = COALESCE($9, is_blocked),
        block_reason = COALESCE($10, block_reason)
      WHERE id = $11
    `, [
      businessName !== undefined ? businessName.trim() : null,
      contactName !== undefined ? contactName.trim() : null,
      phone !== undefined ? phone.trim() : null,
      category !== undefined ? category.trim() : null,
      city !== undefined ? city.trim() : null,
      planInterest !== undefined ? planInterest.trim() : null,
      notes !== undefined ? notes.trim() : null,
      status !== undefined ? status.trim() : null,
      isBlocked !== undefined ? Boolean(isBlocked) : null,
      blockReason !== undefined ? blockReason.trim() : null,
      id
    ]);

    res.json({ success: true, message: 'Pre-registro actualizado correctamente.' });
  } catch (error) {
    console.error('Error actualizando pre-registro:', error);
    res.status(500).json({ error: 'Error al actualizar pre-registro.' });
  }
});

// Bloquear / Desbloquear / Descartar Pre-registro
app.patch('/api/developer/pre-registrations/:id/block', async (req, res) => {
  try {
    const { id } = req.params;
    const { isBlocked, reason = '' } = req.body;

    await pool.query(`
      UPDATE reservas_pre_registrations SET
        is_blocked = $1,
        block_reason = $2,
        status = $3
      WHERE id = $4
    `, [Boolean(isBlocked), reason.trim(), isBlocked ? 'discarded' : 'pending', id]);

    res.json({ 
      success: true, 
      message: isBlocked ? 'Pre-registro descartado/bloqueado.' : 'Pre-registro reactivado.',
      isBlocked: Boolean(isBlocked),
      blockReason: reason.trim()
    });
  } catch (error) {
    console.error('Error alternando bloqueo de pre-registro:', error);
    res.status(500).json({ error: 'Error al cambiar estado del pre-registro.' });
  }
});

// Eliminar Pre-registro
app.delete('/api/developer/pre-registrations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM reservas_pre_registrations WHERE id = $1', [id]);
    res.json({ success: true, message: 'Pre-registro eliminado definitivamente.' });
  } catch (error) {
    console.error('Error eliminando pre-registro:', error);
    res.status(500).json({ error: 'Error al eliminar pre-registro.' });
  }
});

// ==========================================
// ENDPOINTS DE NEGOCIOS, CATEGORÍAS Y SERVICIOS
// ==========================================

// Obtener todas las categorías
app.get('/api/categories', (req, res) => {
  res.json([
    { id: 'all', name: 'Todas las Categorías', icon: 'fa-store' },
    { id: 'belleza', name: 'Belleza y Barbería', icon: 'fa-scissors' },
    { id: 'salud', name: 'Salud y Medicina', icon: 'fa-user-md' },
    { id: 'dental', name: 'Odontología y Dental', icon: 'fa-tooth' },
    { id: 'spa', name: 'Spa, Masajes y Estética', icon: 'fa-spa' },
    { id: 'fitness', name: 'Fitness y Deporte', icon: 'fa-dumbbell' },
    { id: 'mascotas', name: 'Veterinaria y Mascotas', icon: 'fa-paw' },
    { id: 'autos', name: 'Talleres y Automotriz', icon: 'fa-car' },
    { id: 'gastronomia', name: 'Restaurantes y Gastronomía', icon: 'fa-utensils' },
    { id: 'fotografia', name: 'Fotografía y Eventos', icon: 'fa-camera' },
    { id: 'educacion', name: 'Educación, Cursos y Tutorías', icon: 'fa-graduation-cap' },
    { id: 'profesionales', name: 'Servicios Legales y Contabilidad', icon: 'fa-balance-scale' },
    { id: 'hogar', name: 'Hogar, Reparaciones y Limpieza', icon: 'fa-tools' },
    { id: 'psicologia', name: 'Psicología y Terapia', icon: 'fa-brain' },
    { id: 'tatuajes', name: 'Tatuajes y Piercing', icon: 'fa-palette' },
    { id: 'tecnologia', name: 'Tecnología y Soporte', icon: 'fa-laptop-code' },
    { id: 'otros', name: 'Otros Servicios', icon: 'fa-concierge-bell' }
  ]);
});

// Obtener todas las citas globales
app.get('/api/appointments', async (req, res) => {
  try {
    const result = await pool.query('SELECT a.*, b.name as business_name FROM reservas_appointments a LEFT JOIN reservas_businesses b ON a.business_id = b.id ORDER BY a.date DESC, a.time ASC');
    const appointments = result.rows.map(a => ({
      id: a.id,
      businessId: a.business_id,
      businessName: a.business_name || 'Comercio',
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
      whatsappOptIn: a.whatsapp_opt_in !== false
    }));
    res.json(appointments);
  } catch (error) {
    console.error('Error en GET /api/appointments:', error);
    res.status(500).json({ error: 'Error al obtener citas.' });
  }
});

// Obtener todos los negocios
app.get('/api/businesses', async (req, res) => {
  try {
    const bizRes = await pool.query(`
      SELECT * FROM reservas_businesses 
      ORDER BY is_demo DESC, created_at ASC
    `);
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
      isHidden: Boolean(b.is_hidden),
      isBlocked: Boolean(b.is_blocked),
      blockReason: b.block_reason || '',
      plan: b.plan || 'pro',
      planPriceUsd: b.plan_price_usd ? parseFloat(b.plan_price_usd) : (b.plan === 'unlimited' ? 35 : (b.plan === 'basic' ? 10 : 18)),
      monthlyBookingLimit: b.plan === 'unlimited' ? null : (b.plan === 'pro' ? ((b.monthly_booking_limit && parseInt(b.monthly_booking_limit, 10) > 300) ? parseInt(b.monthly_booking_limit, 10) : 300) : (b.plan === 'basic' ? 150 : (b.monthly_booking_limit !== null && b.monthly_booking_limit !== undefined ? parseInt(b.monthly_booking_limit, 10) : 300))),
      socialLinks: b.social_links || {},
      autoConfirmAppointments: b.auto_confirm_appointments !== false,
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
      isHidden: Boolean(b.is_hidden),
      isBlocked: Boolean(b.is_blocked),
      blockReason: b.block_reason || '',
      plan: b.plan || 'pro',
      planPriceUsd: b.plan_price_usd ? parseFloat(b.plan_price_usd) : (b.plan === 'unlimited' ? 35 : (b.plan === 'basic' ? 10 : 18)),
      monthlyBookingLimit: b.plan === 'unlimited' ? null : (b.plan === 'pro' ? ((b.monthly_booking_limit && parseInt(b.monthly_booking_limit, 10) > 300) ? parseInt(b.monthly_booking_limit, 10) : 300) : (b.plan === 'basic' ? 150 : (b.monthly_booking_limit !== null && b.monthly_booking_limit !== undefined ? parseInt(b.monthly_booking_limit, 10) : 300))),
      socialLinks: b.social_links || {},
      autoConfirmAppointments: b.auto_confirm_appointments !== false,
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

// Actualizar plan de suscripción de un negocio
app.put('/api/businesses/:id/plan', async (req, res) => {
  try {
    const { id } = req.params;
    const { plan, planPriceUsd, monthlyBookingLimit } = req.body;
    
    let priceUsd = 10;
    let limit = 150;
    if (plan === 'unlimited') {
      priceUsd = 35;
      limit = null;
    } else if (plan === 'pro') {
      priceUsd = 18;
      limit = 300;
    } else {
      priceUsd = 10;
      limit = 150;
    }

    const finalPrice = planPriceUsd ? parseFloat(planPriceUsd) : priceUsd;
    const finalLimit = monthlyBookingLimit !== undefined ? monthlyBookingLimit : limit;

    await pool.query(`
      UPDATE reservas_businesses SET
        plan = $1,
        plan_price_usd = $2,
        monthly_booking_limit = $3
      WHERE id = $4
    `, [plan, finalPrice, finalLimit, id]);

    res.json({ success: true, message: 'Plan actualizado correctamente', plan, planPriceUsd: finalPrice, monthlyBookingLimit: finalLimit });
  } catch (error) {
    console.error('Error al actualizar plan:', error);
    res.status(500).json({ error: 'Error al actualizar plan del negocio.' });
  }
});

// Actualizar negocio completo (Modificar datos)
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
        schedule = COALESCE($13, schedule),
        social_links = COALESCE($14, social_links),
        auto_confirm_appointments = COALESCE($15, auto_confirm_appointments),
        plan = COALESCE($16, plan),
        is_blocked = COALESCE($17, is_blocked),
        block_reason = COALESCE($18, block_reason),
        is_hidden = COALESCE($19, is_hidden)
      WHERE id = $20
    `, [
      b.name !== undefined ? b.name : null,
      b.category !== undefined ? b.category : null,
      b.categoryLabel !== undefined ? b.categoryLabel : null,
      b.city !== undefined ? b.city : null,
      b.address !== undefined ? b.address : null,
      b.phone !== undefined ? b.phone : null,
      b.email !== undefined ? b.email : null,
      b.description !== undefined ? b.description : null,
      b.image !== undefined ? b.image : null,
      b.coverImage !== undefined ? b.coverImage : null,
      b.priceRange !== undefined ? b.priceRange : null,
      b.features ? JSON.stringify(b.features) : null,
      b.schedule ? JSON.stringify(b.schedule) : null,
      b.socialLinks ? JSON.stringify(b.socialLinks) : (b.social_links ? JSON.stringify(b.social_links) : null),
      b.autoConfirmAppointments !== undefined ? Boolean(b.autoConfirmAppointments) : null,
      b.plan !== undefined ? b.plan : null,
      b.isBlocked !== undefined ? Boolean(b.isBlocked) : null,
      b.blockReason !== undefined ? b.blockReason : null,
      b.isHidden !== undefined ? Boolean(b.isHidden) : null,
      id
    ]);

    res.json({ success: true, message: 'Perfil del negocio actualizado exitosamente' });
  } catch (error) {
    console.error('Error actualizando negocio:', error);
    res.status(500).json({ error: 'Error al actualizar negocio' });
  }
});

// Actualizar switch de autoconfirmación de citas del negocio
app.put('/api/businesses/:id/auto-confirm', async (req, res) => {
  try {
    const { id } = req.params;
    const { autoConfirmAppointments } = req.body;
    const isAuto = autoConfirmAppointments !== false;

    await pool.query('UPDATE reservas_businesses SET auto_confirm_appointments = $1 WHERE id = $2', [isAuto, id]);
    res.json({ success: true, autoConfirmAppointments: isAuto, message: `Autoconfirmación de citas ${isAuto ? 'activada' : 'desactivada'}` });
  } catch (error) {
    console.error('Error al actualizar autoconfirmación:', error);
    res.status(500).json({ error: 'Error al actualizar configuración de autoconfirmación' });
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

// ==========================================
// RUTAS DE GESTIÓN DE HORARIOS BLOQUEADOS
// ==========================================

// Obtener todos los bloqueos de horarios (o filtrar por businessId y date)
app.get('/api/blocked-slots', async (req, res) => {
  try {
    const { businessId, date } = req.query;
    let query = 'SELECT * FROM reservas_blocked_slots';
    const params = [];
    const conditions = [];

    if (businessId) {
      params.push(businessId);
      conditions.push(`business_id = $${params.length}`);
    }
    if (date) {
      params.push(date);
      conditions.push(`date = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY date ASC, time ASC';

    const result = await pool.query(query, params);
    const slots = result.rows.map(r => ({
      id: r.id,
      businessId: r.business_id,
      date: r.date,
      time: r.time,
      createdAt: r.created_at
    }));
    res.json(slots);
  } catch (error) {
    console.error('Error en GET /api/blocked-slots:', error);
    res.status(500).json({ error: 'Error al obtener horarios bloqueados' });
  }
});

// Obtener bloqueos de un negocio específico
app.get('/api/businesses/:id/blocked-slots', async (req, res) => {
  try {
    const { id } = req.params;
    const { date } = req.query;
    let query = 'SELECT * FROM reservas_blocked_slots WHERE business_id = $1';
    const params = [id];
    if (date) {
      params.push(date);
      query += ' AND date = $2';
    }
    query += ' ORDER BY date ASC, time ASC';
    const result = await pool.query(query, params);
    const slots = result.rows.map(r => ({
      id: r.id,
      businessId: r.business_id,
      date: r.date,
      time: r.time,
      createdAt: r.created_at
    }));
    res.json(slots);
  } catch (error) {
    console.error('Error en GET /api/businesses/:id/blocked-slots:', error);
    res.status(500).json({ error: 'Error al obtener horarios bloqueados' });
  }
});

// Alternar (Toggle) bloqueo de una hora específica (bloquear / liberar)
app.post('/api/businesses/:id/blocked-slots/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    const { date, time } = req.body;
    if (!date || !time) {
      return res.status(400).json({ error: 'Faltan parámetros date y time' });
    }

    const timeToMinutes = (timeStr) => {
      if (!timeStr) return 0;
      let str = String(timeStr).trim().toUpperCase();
      const isPM = str.includes('PM');
      const isAM = str.includes('AM');
      str = str.replace(/[APM\s]/g, '');
      const [hStr, mStr] = str.split(':');
      let h = parseInt(hStr, 10) || 0;
      const m = parseInt(mStr, 10) || 0;
      if (isPM && h < 12) h += 12;
      if (isAM && h === 12) h = 0;
      return h * 60 + m;
    };

    const targetMin = timeToMinutes(time);

    // Consultar todos los bloqueos del negocio en esa fecha
    const allBlockedRes = await pool.query(
      'SELECT * FROM reservas_blocked_slots WHERE business_id = $1 AND date = $2',
      [id, date]
    );

    // Obtener configuración de duración de turnos del comercio
    const bizRes = await pool.query('SELECT schedule FROM reservas_businesses WHERE id = $1', [id]);
    const slotDuration = bizRes.rows[0]?.schedule?.slotDuration || 30;
    const slotEndMin = targetMin + slotDuration;

    // Buscar si hay bloqueos existentes que colisionen con este intervalo
    const matching = allBlockedRes.rows.filter(r => {
      const bm = timeToMinutes(r.time);
      const is15 = (bm % 30 !== 0);
      const bDur = is15 ? 15 : (slotDuration === 15 ? 15 : 30);
      return targetMin < (bm + bDur) && slotEndMin > bm;
    });

    if (matching.length > 0) {
      // Si ya hay bloqueos en este intervalo, liberarlos todos
      const idsToDelete = matching.map(m => m.id);
      await pool.query('DELETE FROM reservas_blocked_slots WHERE id = ANY($1::text[])', [idsToDelete]);
      return res.json({ success: true, action: 'unblocked', date, time, removedIds: idsToDelete });
    } else {
      // Si no estaba bloqueado, insertar el bloqueo
      const slotId = `blk-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      await pool.query(
        'INSERT INTO reservas_blocked_slots (id, business_id, date, time) VALUES ($1, $2, $3, $4)',
        [slotId, id, date, time]
      );
      return res.json({ success: true, action: 'blocked', id: slotId, businessId: id, date, time });
    }
  } catch (error) {
    console.error('Error en POST /api/businesses/:id/blocked-slots/toggle:', error);
    res.status(500).json({ error: 'Error al alternar bloqueo de horario' });
  }
});

// Operaciones masivas: bloquear o liberar un conjunto de horas o todo el día
app.post('/api/businesses/:id/blocked-slots/bulk', async (req, res) => {
  try {
    const { id } = req.params;
    const { date, times, action } = req.body; // action: 'block_all' | 'unblock_all'
    if (!date) {
      return res.status(400).json({ error: 'Falta parámetro date' });
    }

    if (action === 'unblock_all') {
      await pool.query('DELETE FROM reservas_blocked_slots WHERE business_id = $1 AND date = $2', [id, date]);
      return res.json({ success: true, action: 'unblock_all', date });
    }

    if (action === 'block_all' && Array.isArray(times) && times.length > 0) {
      await pool.query('DELETE FROM reservas_blocked_slots WHERE business_id = $1 AND date = $2', [id, date]);
      for (const time of times) {
        const slotId = `blk-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        await pool.query(
          'INSERT INTO reservas_blocked_slots (id, business_id, date, time) VALUES ($1, $2, $3, $4) ON CONFLICT (business_id, date, time) DO NOTHING',
          [slotId, id, date, time]
        );
      }
      return res.json({ success: true, action: 'block_all', date, count: times.length });
    }

    res.status(400).json({ error: 'Acción no válida o lista de horarios vacía' });
  } catch (error) {
    console.error('Error en POST /api/businesses/:id/blocked-slots/bulk:', error);
    res.status(500).json({ error: 'Error en operación masiva de horarios' });
  }
});

// Cambiar Plan desde Developer Dashboard
app.patch('/api/developer/businesses/:id/plan', async (req, res) => {
  try {
    const { id } = req.params;
    const { plan } = req.body;

    const planPrices = { basic: 10, pro: 18, unlimited: 35 };
    const planLimits = { basic: 150, pro: 300, unlimited: null };

    const planPriceUsd = planPrices[plan] || 10;
    const monthlyBookingLimit = planLimits[plan] !== undefined ? planLimits[plan] : 150;

    await pool.query(`
      UPDATE reservas_businesses SET
        plan = $1,
        plan_price_usd = $2,
        monthly_booking_limit = $3
      WHERE id = $4
    `, [plan, planPriceUsd, monthlyBookingLimit, id]);

    res.json({ 
      success: true, 
      message: `Plan del comercio actualizado a "${plan === 'basic' ? 'Plan Básico ($10)' : (plan === 'pro' ? 'Plan Profesional ($18)' : 'Plan Ilimitado ($35)')}".`,
      plan,
      planPriceUsd,
      monthlyBookingLimit
    });
  } catch (error) {
    console.error('Error actualizando plan desde developer:', error);
    res.status(500).json({ error: 'Error al actualizar plan del negocio.' });
  }
});

// Consultar uso mensual de citas y límites del negocio
app.get('/api/businesses/:id/booking-usage', async (req, res) => {
  try {
    const { id } = req.params;
    const bizRes = await pool.query('SELECT name, plan, plan_price_usd, monthly_booking_limit FROM reservas_businesses WHERE id = $1', [id]);
    if (bizRes.rows.length === 0) {
      return res.status(404).json({ error: 'Comercio no encontrado.' });
    }

    const biz = bizRes.rows[0];
    const plan = biz.plan || 'basic';
    const limit = plan === 'unlimited' ? null : (plan === 'pro' ? ((biz.monthly_booking_limit && parseInt(biz.monthly_booking_limit, 10) > 300) ? parseInt(biz.monthly_booking_limit, 10) : 300) : (plan === 'basic' ? 150 : (biz.monthly_booking_limit ? parseInt(biz.monthly_booking_limit, 10) : 150)));
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const countRes = await pool.query(`
      SELECT COUNT(*) as total FROM reservas_appointments 
      WHERE business_id = $1 AND created_at >= $2 AND status != 'cancelled'
    `, [id, startOfMonth]);

    const used = parseInt(countRes.rows[0].total, 10) || 0;
    const remaining = limit ? Math.max(0, limit - used) : null;
    const usagePercent = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;

    res.json({
      plan: biz.plan || 'basic',
      planPriceUsd: parseFloat(biz.plan_price_usd) || 10.00,
      monthlyBookingLimit: limit,
      usedThisMonth: used,
      remainingThisMonth: remaining,
      usagePercent,
      isUnlimited: !limit,
      isLimitReached: limit ? used >= limit : false
    });
  } catch (error) {
    console.error('Error consultando uso mensual:', error);
    res.status(500).json({ error: 'Error al consultar uso mensual de citas.' });
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
// ENDPOINTS DE EQUIPO / ESPECIALISTAS (STAFF)
// ==========================================

// Obtener lista de especialistas / colaboradores del negocio
app.get('/api/businesses/:id/staff', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM reservas_staff WHERE business_id = $1 ORDER BY created_at ASC', [id]);
    const staff = result.rows.map(s => ({
      id: s.id,
      businessId: s.business_id,
      name: s.name,
      roleTitle: s.role_title || 'Especialista',
      avatarUrl: s.avatar_url || '',
      phone: s.phone || '',
      services: s.services || ['all'],
      schedule: s.schedule || null,
      isActive: s.is_active !== false,
      createdAt: s.created_at
    }));
    res.json(staff);
  } catch (error) {
    console.error('Error obteniendo especialistas:', error);
    res.status(500).json({ error: 'Error al obtener especialistas del negocio.' });
  }
});

// Agregar especialista al negocio (Validando límites de plan)
app.post('/api/businesses/:id/staff', async (req, res) => {
  try {
    const { id: businessId } = req.params;
    const s = req.body;
    if (!s.name || !s.name.trim()) {
      return res.status(400).json({ error: 'El nombre del especialista es obligatorio.' });
    }

    // Validar plan del comercio
    const bizRes = await pool.query('SELECT plan FROM reservas_businesses WHERE id = $1', [businessId]);
    if (bizRes.rows.length === 0) {
      return res.status(404).json({ error: 'Comercio no encontrado.' });
    }
    const plan = bizRes.rows[0].plan || 'basic';
    if (plan === 'basic') {
      return res.status(403).json({ 
        error: 'La gestión de múltiples especialistas y empleados requiere el Plan Profesional ($18) o Plan Ilimitado ($35).',
        requiresUpgrade: true
      });
    }

    const countRes = await pool.query('SELECT COUNT(*) as total FROM reservas_staff WHERE business_id = $1', [businessId]);
    const currentStaffCount = parseInt(countRes.rows[0].total, 10) || 0;

    if (plan === 'pro' && currentStaffCount >= 5) {
      return res.status(403).json({ 
        error: 'Has alcanzado el límite de 5 especialistas del Plan Profesional. Actualiza al Plan Ilimitado para agregar más colaboradores sin restricciones.',
        requiresUpgrade: true
      });
    }

    const newStaffId = `staff-${Date.now()}`;
    await pool.query(`
      INSERT INTO reservas_staff (id, business_id, name, role_title, avatar_url, phone, services, schedule, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      newStaffId, 
      businessId, 
      s.name.trim(), 
      s.roleTitle?.trim() || 'Especialista', 
      s.avatarUrl?.trim() || '', 
      s.phone?.trim() || '', 
      JSON.stringify(s.services || ['all']), 
      s.schedule ? JSON.stringify(s.schedule) : null, 
      s.isActive !== false
    ]);

    res.status(201).json({
      id: newStaffId,
      businessId,
      name: s.name.trim(),
      roleTitle: s.roleTitle?.trim() || 'Especialista',
      avatarUrl: s.avatarUrl?.trim() || '',
      phone: s.phone?.trim() || '',
      services: s.services || ['all'],
      schedule: s.schedule || null,
      isActive: s.isActive !== false
    });
  } catch (error) {
    console.error('Error agregando especialista:', error);
    res.status(500).json({ error: 'Error al crear especialista.' });
  }
});

// Actualizar especialista
app.put('/api/businesses/:id/staff/:staffId', async (req, res) => {
  try {
    const { id: businessId, staffId } = req.params;
    const s = req.body;

    await pool.query(`
      UPDATE reservas_staff SET
        name = COALESCE($1, name),
        role_title = COALESCE($2, role_title),
        avatar_url = COALESCE($3, avatar_url),
        phone = COALESCE($4, phone),
        services = COALESCE($5, services),
        schedule = $6,
        is_active = COALESCE($7, is_active)
      WHERE id = $8 AND business_id = $9
    `, [
      s.name ? s.name.trim() : null,
      s.roleTitle ? s.roleTitle.trim() : null,
      s.avatarUrl !== undefined ? s.avatarUrl.trim() : null,
      s.phone !== undefined ? s.phone.trim() : null,
      s.services ? JSON.stringify(s.services) : null,
      s.schedule ? JSON.stringify(s.schedule) : null,
      s.isActive !== undefined ? s.isActive : null,
      staffId,
      businessId
    ]);

    res.json({ success: true, message: 'Especialista actualizado con éxito.' });
  } catch (error) {
    console.error('Error actualizando especialista:', error);
    res.status(500).json({ error: 'Error al actualizar especialista.' });
  }
});

// Eliminar especialista
app.delete('/api/businesses/:id/staff/:staffId', async (req, res) => {
  try {
    const { id: businessId, staffId } = req.params;
    await pool.query('DELETE FROM reservas_staff WHERE id = $1 AND business_id = $2', [staffId, businessId]);
    res.json({ success: true, message: 'Especialista eliminado con éxito.' });
  } catch (error) {
    console.error('Error eliminando especialista:', error);
    res.status(500).json({ error: 'Error al eliminar especialista.' });
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
      whatsappOptIn: a.whatsapp_opt_in !== false,
      staffId: a.staff_id || null,
      staffName: a.staff_name || '',
      createdAt: a.created_at
    }));

    res.json(appointments);
  } catch (error) {
    console.error('Error consultando citas:', error);
    res.status(500).json({ error: 'Error al consultar citas' });
  }
});

// Obtener citas de un cliente por teléfono o email
app.get('/api/clients/:phone/appointments', async (req, res) => {
  try {
    const { phone } = req.params;
    const { email } = req.query;
    let query = 'SELECT a.*, b.name as business_name FROM reservas_appointments a LEFT JOIN reservas_businesses b ON a.business_id = b.id WHERE a.client_phone = $1';
    const params = [phone];

    if (email && email.trim() !== '') {
      query += ' OR (a.client_email != \'\' AND LOWER(a.client_email) = LOWER($2))';
      params.push(email.trim());
    }
    query += ' ORDER BY a.date DESC, a.time ASC';

    const result = await pool.query(query, params);

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
      whatsappOptIn: a.whatsapp_opt_in !== false,
      staffId: a.staff_id || null,
      staffName: a.staff_name || '',
      createdAt: a.created_at
    }));

    res.json(appointments);
  } catch (error) {
    console.error('Error consultando citas de cliente:', error);
    res.status(500).json({ error: 'Error al consultar citas' });
  }
});

// Crear nueva reserva (con notificación por correo electrónico y asignación de especialista)
app.post('/api/appointments', async (req, res) => {
  try {
    const a = req.body;

    // 1. Validar que el comercio no esté bloqueado/suspendido
    const bizCheck = await pool.query('SELECT name, is_blocked, block_reason, plan, monthly_booking_limit, auto_confirm_appointments FROM reservas_businesses WHERE id = $1', [a.businessId]);
    if (bizCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Comercio no encontrado' });
    }

    const bizData = bizCheck.rows[0];
    if (bizData.is_blocked) {
      return res.status(403).json({ 
        error: 'Este comercio se encuentra temporalmente suspendido / bloqueado para nuevas reservas.',
        isBlocked: true,
        reason: bizData.block_reason || 'Suspendido por la administración'
      });
    }

    // 2. Verificar límite mensual de reservas según el plan
    const bookingLimit = bizData.monthly_booking_limit;
    if (bookingLimit && bookingLimit > 0) {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const countRes = await pool.query(`
        SELECT COUNT(*) as total FROM reservas_appointments 
        WHERE business_id = $1 AND created_at >= $2 AND status != 'cancelled'
      `, [a.businessId, startOfMonth]);

      const currentCount = parseInt(countRes.rows[0].total, 10) || 0;
      if (currentCount >= bookingLimit) {
        const planName = bizData.plan === 'basic' ? 'Plan Básico ($10 / 150 citas)' : (bizData.plan === 'pro' ? 'Plan Profesional ($18 / 300 citas)' : 'su plan actual');
        return res.status(403).json({
          error: `El comercio "${bizData.name}" ha alcanzado el límite de ${bookingLimit} reservas de este mes de su ${planName}. Para recibir más citas este mes, debe actualizar a un plan superior.`,
          limitReached: true,
          currentCount,
          bookingLimit,
          plan: bizData.plan
        });
      }
    }

    const isAutoConfirm = bizData.auto_confirm_appointments !== false;
    const initialStatus = a.status ? a.status : (isAutoConfirm ? 'confirmed' : 'pending');

    const newId = `apt-${Date.now().toString().slice(-6)}`;
    const optIn = a.whatsappOptIn !== undefined ? Boolean(a.whatsappOptIn) : true;

    // 3. Resolver especialista asignado (si se seleccionó uno o es 'any' / asignación automática)
    let assignedStaffId = a.staffId && a.staffId !== 'any' ? a.staffId : null;
    let assignedStaffName = a.staffName || null;

    if (assignedStaffId) {
      const stRes = await pool.query('SELECT name, role_title FROM reservas_staff WHERE id = $1', [assignedStaffId]);
      if (stRes.rows.length > 0) {
        assignedStaffName = `${stRes.rows[0].name}${stRes.rows[0].role_title ? ' (' + stRes.rows[0].role_title + ')' : ''}`;
      }
    } else {
      // Asignación automática: buscar especialista disponible para este servicio en la fecha/hora
      const allStaffRes = await pool.query('SELECT * FROM reservas_staff WHERE business_id = $1 AND is_active = TRUE', [a.businessId]);
      if (allStaffRes.rows.length > 0) {
        const eligible = allStaffRes.rows.filter(st => {
          const svcs = st.services || ['all'];
          return Array.isArray(svcs) && (svcs.includes('all') || svcs.includes(a.serviceId));
        });

        if (eligible.length > 0) {
          const bookedStaffRes = await pool.query(`
            SELECT staff_id FROM reservas_appointments 
            WHERE business_id = $1 AND date = $2 AND time = $3 AND status != 'cancelled' AND staff_id IS NOT NULL
          `, [a.businessId, a.date, a.time]);
          const bookedIds = new Set(bookedStaffRes.rows.map(r => r.staff_id));
          const available = eligible.find(st => !bookedIds.has(st.id));

          if (available) {
            assignedStaffId = available.id;
            assignedStaffName = `${available.name}${available.role_title ? ' (' + available.role_title + ')' : ''}`;
          } else {
            assignedStaffId = eligible[0].id;
            assignedStaffName = `${eligible[0].name}${eligible[0].role_title ? ' (' + eligible[0].role_title + ')' : ''}`;
          }
        }
      }
    }

    await pool.query(`
      INSERT INTO reservas_appointments (
        id, business_id, service_id, service_name, service_price,
        service_duration, date, time, client_name, client_phone,
        client_email, notes, status, whatsapp_opt_in, staff_id, staff_name
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    `, [
      newId, a.businessId, a.serviceId, a.serviceName, a.servicePrice,
      a.serviceDuration, a.date, a.time, a.clientName, a.clientPhone,
      a.clientEmail || '', a.notes || '', initialStatus, optIn,
      assignedStaffId, assignedStaffName
    ]);

    // Registrar o actualizar automáticamente el cliente
    if (a.clientName && a.clientPhone) {
      await pool.query(`
        INSERT INTO reservas_clients (id, name, phone, email, whatsapp_opt_in)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO NOTHING
      `, [`cli-${Date.now()}`, a.clientName, a.clientPhone, a.clientEmail || '', optIn]);
    }

    const createdAppointment = { 
      id: newId, 
      ...a, 
      staffId: assignedStaffId,
      staffName: assignedStaffName,
      whatsappOptIn: optIn, 
      status: initialStatus,
      autoConfirmed: isAutoConfirm
    };

    // Si está autoconfirmada y confirmada, enviar notificaciones inmediatamente
    if (isAutoConfirm && initialStatus === 'confirmed') {
      pool.query('SELECT * FROM reservas_businesses WHERE id = $1', [a.businessId])
        .then(bizRes => {
          const business = bizRes.rows[0] || null;

          // 1. Enviar correo de confirmación (si proporcionó email)
          if (a.clientEmail && a.clientEmail.includes('@')) {
            sendBookingConfirmationEmail(createdAppointment, business).catch(emailErr => {
              console.error('⚠️ Error no bloqueante al enviar correo:', emailErr.message);
            });
          }

          // 2. Enviar WhatsApp de confirmación proactivo (Plantilla oficial Meta Cloud API)
          if (optIn && a.clientPhone) {
            sendBookingConfirmationWhatsApp(createdAppointment, business, pool)
              .then(waRes => {
                console.log(`📲 [WhatsApp Auto] Resultado envío cita ${createdAppointment.id}:`, waRes?.success ? `Entregado (${waRes.provider})` : `No enviado (${waRes?.reason || waRes?.error})`);
              })
              .catch(waErr => {
                console.error('⚠️ Error no bloqueante al enviar WhatsApp:', waErr.message);
              });
          }
        })
        .catch(err => {
          console.error('⚠️ Error al consultar datos del negocio para notificaciones:', err.message);
        });
    }

    res.status(201).json(createdAppointment);
  } catch (error) {
    console.error('Error creando cita:', error);
    res.status(500).json({ error: 'Error al registrar la reserva' });
  }
});

// Endpoint de diagnóstico de servicios de notificación
app.get('/api/notifications-status', async (req, res) => {
  const hasResend = Boolean(process.env.RESEND_API_KEY);
  const metaCreds = await getActiveMetaCredentials(pool);
  const hasTwilio = Boolean(process.env.TWILIO_AUTH_TOKEN);

  res.json({
    email: {
      provider: 'Resend Email API',
      status: hasResend ? 'configured' : 'fallback',
      from: process.env.RESEND_FROM_EMAIL || 'Reservas Costa Rica <onboarding@resend.dev>',
      note: 'Los correos de confirmación se envían automáticamente al cliente y al negocio.'
    },
    whatsapp: {
      provider: metaCreds.isConfigured ? 'Meta WhatsApp Cloud API (Directo)' : (hasTwilio ? 'Twilio WhatsApp Sandbox' : 'Sin Configurar'),
      status: metaCreds.isConfigured ? 'configured_meta' : (hasTwilio ? 'configured_twilio' : 'missing_credentials'),
      hasToken: Boolean(metaCreds.token),
      hasPhoneId: Boolean(metaCreds.phoneNumberId),
      phoneNumberId: metaCreds.phoneNumberId ? `${metaCreds.phoneNumberId.slice(0, 4)}...${metaCreds.phoneNumberId.slice(-4)}` : null,
      directMetaEnabled: metaCreds.isConfigured,
      note: metaCreds.isConfigured 
        ? 'Conexión directa con Meta WhatsApp Cloud API activa (1.000 conversaciones gratis/mes).' 
        : 'Puedes configurar tu Token y Phone ID directamente en la pestaña WhatsApp del panel Developer.'
    }
  });
});

// Obtener configuración de WhatsApp para Developer
app.get('/api/developer/settings/whatsapp', async (req, res) => {
  try {
    const metaCreds = await getActiveMetaCredentials(pool);
    res.json({
      configured: metaCreds.isConfigured,
      tokenMasked: metaCreds.token ? `${metaCreds.token.slice(0, 8)}...${metaCreds.token.slice(-6)}` : '',
      hasToken: Boolean(metaCreds.token),
      phoneNumberId: metaCreds.phoneNumberId || '',
      wabaId: metaCreds.wabaId || '',
      provider: metaCreds.isConfigured ? 'Meta WhatsApp Cloud API' : 'Twilio Sandbox / Inactivo'
    });
  } catch (error) {
    console.error('Error obteniendo settings de WhatsApp:', error);
    res.status(500).json({ error: 'Error al consultar configuración de WhatsApp.' });
  }
});

// Guardar configuración de WhatsApp en la base de datos (inmediato, sin reinicio)
app.post('/api/developer/settings/whatsapp', async (req, res) => {
  try {
    const { token, phoneNumberId, wabaId } = req.body;

    if (token !== undefined && token.trim()) {
      await pool.query(`
        INSERT INTO reservas_system_settings (key, value, updated_at)
        VALUES ('META_WHATSAPP_TOKEN', $1, NOW())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
      `, [token.trim()]);
    }

    if (phoneNumberId !== undefined && phoneNumberId.trim()) {
      await pool.query(`
        INSERT INTO reservas_system_settings (key, value, updated_at)
        VALUES ('META_PHONE_NUMBER_ID', $1, NOW())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
      `, [phoneNumberId.trim()]);
    }

    if (wabaId !== undefined) {
      await pool.query(`
        INSERT INTO reservas_system_settings (key, value, updated_at)
        VALUES ('META_WABA_ID', $1, NOW())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
      `, [(wabaId || '').trim()]);
    }

    const updated = await getActiveMetaCredentials(pool);
    res.json({ 
      success: true, 
      message: 'Credenciales de Meta WhatsApp guardadas exitosamente.',
      configured: updated.isConfigured,
      phoneNumberId: updated.phoneNumberId
    });
  } catch (error) {
    console.error('Error guardando settings de WhatsApp:', error);
    res.status(500).json({ error: 'Error al guardar configuración de WhatsApp.' });
  }
});

// Endpoint para probar el envío de WhatsApp de confirmación
app.post('/api/test-whatsapp', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'Debes proporcionar un número de teléfono.' });
    }

    const testAppointment = {
      id: `apt-${Date.now().toString().slice(-6)}`,
      clientName: 'Cliente de Prueba',
      clientPhone: phone.trim(),
      clientEmail: 'prueba@demo.cr',
      serviceName: 'Corte de Cabello Clásico & Barba',
      serviceDuration: 45,
      servicePrice: 10000,
      date: '2026-09-20',
      time: '3:30 PM',
      notes: 'Mensaje de prueba del sistema de reservas WhatsApp',
      whatsappOptIn: true
    };

    const testBusiness = {
      name: 'Barbería & Estilo Vintage',
      address: 'Av. Escazú, Local 12',
      city: 'San José, Escazú',
      phone: '+506 8877 6655'
    };

    const result = await sendBookingConfirmationWhatsApp(testAppointment, testBusiness, pool);
    res.json({ success: true, message: 'Prueba de WhatsApp procesada', result });
  } catch (error) {
    console.error('Error en /api/test-whatsapp:', error);
    res.status(500).json({ error: error.message || 'Error enviando WhatsApp de prueba.' });
  }
});

// Endpoint para probar el envío de correo de confirmación
app.post('/api/test-email', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Debes proporcionar un correo electrónico válido.' });
    }

    const testAppointment = {
      id: `apt-${Date.now().toString().slice(-6)}`,
      clientName: 'Cliente de Prueba',
      clientEmail: email.trim(),
      clientPhone: '+506 8888 7777',
      serviceName: 'Corte de Cabello Clásico & Barba',
      serviceDuration: 45,
      servicePrice: 10000,
      date: '2026-09-20',
      time: '3:30 PM',
      notes: 'Cita de prueba del sistema de correos',
      whatsappOptIn: true
    };

    const testBusiness = {
      name: 'Barbería & Estilo Vintage',
      address: 'Av. Escazú, Local 12',
      city: 'San José, Escazú',
      phone: '+506 8899 1122'
    };

    const result = await sendBookingConfirmationEmail(testAppointment, testBusiness);
    res.json({ success: true, message: 'Prueba de correo procesada', result });
  } catch (error) {
    console.error('Error en /api/test-email:', error);
    res.status(500).json({ error: error.message || 'Error enviando correo de prueba.' });
  }
});

// Actualizar / Reprogramar / Modificar cita completa
app.put('/api/appointments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const a = req.body;

    const prevAptRes = await pool.query('SELECT * FROM reservas_appointments WHERE id = $1', [id]);
    const prevApt = prevAptRes.rows[0];

    await pool.query(`
      UPDATE reservas_appointments SET
        date = COALESCE($1, date),
        time = COALESCE($2, time),
        service_id = COALESCE($3, service_id),
        service_name = COALESCE($4, service_name),
        service_price = COALESCE($5, service_price),
        service_duration = COALESCE($6, service_duration),
        notes = COALESCE($7, notes),
        status = COALESCE($8, status),
        client_name = COALESCE($9, client_name),
        client_phone = COALESCE($10, client_phone),
        client_email = COALESCE($11, client_email)
      WHERE id = $12
    `, [
      a.date, a.time, a.serviceId, a.serviceName,
      a.servicePrice !== undefined ? parseFloat(a.servicePrice) : null,
      a.serviceDuration !== undefined ? parseInt(a.serviceDuration, 10) : null,
      a.notes, a.status, a.clientName, a.clientPhone, a.clientEmail, id
    ]);

    // Si pasó a confirmed y antes no lo estaba, disparar notificaciones
    if (a.status === 'confirmed' && prevApt && prevApt.status !== 'confirmed') {
      const bizRes = await pool.query('SELECT * FROM reservas_businesses WHERE id = $1', [prevApt.business_id]);
      const business = bizRes.rows[0] || null;

      const aptNotif = {
        id: prevApt.id,
        businessId: prevApt.business_id,
        serviceId: a.serviceId || prevApt.service_id,
        serviceName: a.serviceName || prevApt.service_name,
        servicePrice: a.servicePrice !== undefined ? parseFloat(a.servicePrice) : parseFloat(prevApt.service_price),
        serviceDuration: a.serviceDuration !== undefined ? parseInt(a.serviceDuration, 10) : prevApt.service_duration,
        date: a.date || prevApt.date,
        time: a.time || prevApt.time,
        clientName: a.clientName || prevApt.client_name,
        clientPhone: a.clientPhone || prevApt.client_phone,
        clientEmail: a.clientEmail || prevApt.client_email,
        notes: a.notes !== undefined ? a.notes : prevApt.notes,
        status: 'confirmed',
        whatsappOptIn: prevApt.whatsapp_opt_in !== false
      };

      if (aptNotif.clientEmail && aptNotif.clientEmail.includes('@')) {
        sendBookingConfirmationEmail(aptNotif, business).catch(err => {
          console.error('⚠️ Error al enviar correo de confirmación:', err.message);
        });
      }

      const isProOrUnlimited = business && (business.plan === 'pro' || business.plan === 'unlimited');
      if (isProOrUnlimited && aptNotif.whatsappOptIn && aptNotif.clientPhone) {
        sendBookingConfirmationWhatsApp(aptNotif, business, pool).catch(err => {
          console.error('⚠️ Error al enviar WhatsApp de confirmación:', err.message);
        });
      }
    }

    // Si se marcó como completada ('completed') y aún no se ha enviado el correo de valoración, enviarlo de inmediato
    if (a.status === 'completed' && prevApt && !prevApt.review_email_sent_at) {
      const clientEmail = a.clientEmail || prevApt.client_email;
      if (clientEmail && clientEmail.includes('@')) {
        const bizRes = await pool.query('SELECT * FROM reservas_businesses WHERE id = $1', [prevApt.business_id]);
        const business = bizRes.rows[0] || null;

        const aptReviewObj = {
          id: prevApt.id,
          businessId: prevApt.business_id,
          businessName: business?.name || prevApt.business_name || 'el comercio',
          serviceName: a.serviceName || prevApt.service_name,
          date: a.date || prevApt.date,
          time: a.time || prevApt.time,
          clientName: a.clientName || prevApt.client_name,
          clientEmail: clientEmail.trim(),
          clientPhone: a.clientPhone || prevApt.client_phone
        };

        sendReviewRequestEmail(aptReviewObj, business)
          .then(async (emailRes) => {
            if (emailRes && emailRes.success) {
              await pool.query('UPDATE reservas_appointments SET review_email_sent_at = NOW() WHERE id = $1', [prevApt.id]);
              console.log(`⭐ Correo de valoración enviado inmediatamente al completar la cita #${prevApt.id}.`);
            }
          })
          .catch(err => {
            console.error('⚠️ Error enviando correo de valoración inmediato al completar cita:', err.message);
          });
      }
    }

    res.json({ success: true, message: 'Cita actualizada y reprogramada correctamente' });
  } catch (error) {
    console.error('Error actualizando cita:', error);
    res.status(500).json({ error: 'Error al actualizar reserva' });
  }
});

// Actualizar estado de una cita
app.patch('/api/appointments/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const prevAptRes = await pool.query('SELECT * FROM reservas_appointments WHERE id = $1', [id]);
    const prevApt = prevAptRes.rows[0];

    await pool.query('UPDATE reservas_appointments SET status = $1 WHERE id = $2', [status, id]);

    // 1. Si pasó a confirmed desde pending/otro estado, disparar notificaciones automáticamente
    let notificationsSent = false;
    if (status === 'confirmed' && prevApt && prevApt.status !== 'confirmed') {
      const bizRes = await pool.query('SELECT * FROM reservas_businesses WHERE id = $1', [prevApt.business_id]);
      const business = bizRes.rows[0] || null;

      const aptNotif = {
        id: prevApt.id,
        businessId: prevApt.business_id,
        serviceId: prevApt.service_id,
        serviceName: prevApt.service_name,
        servicePrice: parseFloat(prevApt.service_price),
        serviceDuration: prevApt.service_duration,
        date: prevApt.date,
        time: prevApt.time,
        clientName: prevApt.client_name,
        clientPhone: prevApt.client_phone,
        clientEmail: prevApt.client_email,
        notes: prevApt.notes,
        status: 'confirmed',
        whatsappOptIn: prevApt.whatsapp_opt_in !== false
      };

      if (aptNotif.clientEmail && aptNotif.clientEmail.includes('@')) {
        sendBookingConfirmationEmail(aptNotif, business).catch(err => {
          console.error('⚠️ Error no bloqueante al enviar correo de confirmación manual:', err.message);
        });
      }

      if (aptNotif.whatsappOptIn && aptNotif.clientPhone) {
        sendBookingConfirmationWhatsApp(aptNotif, business, pool).catch(err => {
          console.error('⚠️ Error no bloqueante al enviar WhatsApp de confirmación manual:', err.message);
        });
      }

      notificationsSent = true;
    }

    // 2. Si se marcó como completada ('completed') y aún no se ha enviado el correo de valoración, enviarlo de inmediato
    if (status === 'completed' && prevApt && !prevApt.review_email_sent_at) {
      const clientEmail = prevApt.client_email;
      if (clientEmail && clientEmail.includes('@')) {
        const bizRes = await pool.query('SELECT * FROM reservas_businesses WHERE id = $1', [prevApt.business_id]);
        const business = bizRes.rows[0] || null;

        const aptReviewObj = {
          id: prevApt.id,
          businessId: prevApt.business_id,
          businessName: business?.name || 'el comercio',
          serviceName: prevApt.service_name,
          date: prevApt.date,
          time: prevApt.time,
          clientName: prevApt.client_name,
          clientEmail: clientEmail.trim(),
          clientPhone: prevApt.client_phone
        };

        sendReviewRequestEmail(aptReviewObj, business)
          .then(async (emailRes) => {
            if (emailRes && emailRes.success) {
              await pool.query('UPDATE reservas_appointments SET review_email_sent_at = NOW() WHERE id = $1', [prevApt.id]);
              console.log(`⭐ Correo de valoración enviado inmediatamente al completar la cita #${prevApt.id}.`);
            }
          })
          .catch(err => {
            console.error('⚠️ Error enviando correo de valoración inmediato al completar cita:', err.message);
          });
      }
    }

    res.json({ success: true, message: 'Estado actualizado', notificationsSent });
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

// ==========================================
// ENDPOINTS DE DEVELOPER / SUPERADMIN
// ==========================================

// 1. Estadísticas Globales del Sistema
app.get('/api/developer/stats', async (req, res) => {
  try {
    const totalBiz = await pool.query('SELECT COUNT(*) FROM reservas_businesses');
    const totalClients = await pool.query('SELECT COUNT(*) FROM reservas_clients');
    const totalApts = await pool.query('SELECT COUNT(*) FROM reservas_appointments');
    const unreadAlerts = await pool.query("SELECT COUNT(*) FROM reservas_custom_category_alerts WHERE status = 'unread'");

    res.json({
      totalBusinesses: parseInt(totalBiz.rows[0].count, 10),
      totalClients: parseInt(totalClients.rows[0].count, 10),
      totalAppointments: parseInt(totalApts.rows[0].count, 10),
      unreadAlerts: parseInt(unreadAlerts.rows[0].count, 10)
    });
  } catch (error) {
    console.error('Error obteniendo stats de developer:', error);
    res.status(500).json({ error: 'Error al obtener métricas globales.' });
  }
});

// 2. Lista Completa de Negocios para Developer
app.get('/api/developer/businesses', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT b.*,
             u.name as owner_name, u.email as owner_email,
             (SELECT COUNT(*) FROM reservas_services WHERE business_id = b.id) as services_count,
             (SELECT COUNT(*) FROM reservas_appointments WHERE business_id = b.id) as appointments_count
      FROM reservas_businesses b
      LEFT JOIN reservas_business_users u ON u.business_id = b.id
      ORDER BY b.created_at DESC
    `);

    res.json(result.rows.map(row => ({
      id: row.id,
      name: row.name,
      category: row.category,
      categoryLabel: row.category_label,
      rating: parseFloat(row.rating) || 5.0,
      reviewsCount: row.reviews_count || 0,
      city: row.city,
      phone: row.phone,
      email: row.email,
      image: row.image,
      coverImage: row.cover_image,
      ownerName: row.owner_name,
      ownerEmail: row.owner_email,
      servicesCount: parseInt(row.services_count, 10) || 0,
      appointmentsCount: parseInt(row.appointments_count, 10) || 0,
      isDemo: row.is_demo,
      isDemo: Boolean(row.is_demo),
      isHidden: Boolean(row.is_hidden),
      isBlocked: Boolean(row.is_blocked),
      blockReason: row.block_reason || '',
      createdAt: row.created_at
    })));
  } catch (error) {
    console.error('Error obteniendo negocios para developer:', error);
    res.status(500).json({ error: 'Error al obtener negocios.' });
  }
});

// 3. Lista Completa de Clientes / Usuarios para Developer
app.get('/api/developer/clients', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.id, c.name, c.phone, c.email, c.is_blocked, c.block_reason, c.created_at,
             (SELECT COUNT(*) FROM reservas_appointments WHERE client_phone = c.phone OR (client_email = c.email AND client_email != '')) as appointments_count
      FROM reservas_clients c
      ORDER BY c.created_at DESC
    `);

    res.json(result.rows.map(row => ({
      id: row.id,
      name: row.name,
      phone: row.phone,
      email: row.email || '',
      isBlocked: Boolean(row.is_blocked),
      blockReason: row.block_reason || '',
      createdAt: row.created_at,
      appointmentsCount: parseInt(row.appointments_count, 10) || 0
    })));
  } catch (error) {
    console.error('Error obteniendo clientes para developer:', error);
    res.status(500).json({ error: 'Error al obtener clientes.' });
  }
});

// Modificar Cliente / Usuario desde Developer Panel
app.put('/api/developer/clients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, isBlocked, blockReason } = req.body;

    await pool.query(`
      UPDATE reservas_clients SET
        name = COALESCE($1, name),
        phone = COALESCE($2, phone),
        email = COALESCE($3, email),
        is_blocked = COALESCE($4, is_blocked),
        block_reason = COALESCE($5, block_reason)
      WHERE id = $6
    `, [
      name !== undefined ? name.trim() : null,
      phone !== undefined ? phone.trim() : null,
      email !== undefined ? email.trim() : null,
      isBlocked !== undefined ? Boolean(isBlocked) : null,
      blockReason !== undefined ? blockReason.trim() : null,
      id
    ]);

    res.json({ success: true, message: 'Usuario cliente actualizado exitosamente.' });
  } catch (error) {
    console.error('Error actualizando cliente:', error);
    res.status(500).json({ error: 'Error al actualizar usuario cliente.' });
  }
});

// Bloquear / Desbloquear Cliente / Usuario
app.patch('/api/developer/clients/:id/block', async (req, res) => {
  try {
    const { id } = req.params;
    const { isBlocked, reason = '' } = req.body;

    await pool.query(`
      UPDATE reservas_clients SET
        is_blocked = $1,
        block_reason = $2
      WHERE id = $3
    `, [Boolean(isBlocked), reason.trim(), id]);

    res.json({
      success: true,
      message: isBlocked ? 'Usuario cliente bloqueado/suspendido.' : 'Usuario cliente desbloqueado.',
      isBlocked: Boolean(isBlocked),
      blockReason: reason.trim()
    });
  } catch (error) {
    console.error('Error alternando bloqueo de cliente:', error);
    res.status(500).json({ error: 'Error al actualizar estado del cliente.' });
  }
});

// Eliminar Cliente / Usuario
app.delete('/api/developer/clients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM reservas_clients WHERE id = $1', [id]);
    res.json({ success: true, message: 'Usuario cliente eliminado permanentemente.' });
  } catch (error) {
    console.error('Error eliminando cliente:', error);
    res.status(500).json({ error: 'Error al eliminar cliente.' });
  }
});

// 4. Reservas Globales en Tiempo Real
app.get('/api/developer/appointments', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, b.name as business_name, b.category_label as business_category
      FROM reservas_appointments a
      LEFT JOIN reservas_businesses b ON b.id = a.business_id
      ORDER BY a.date DESC, a.time DESC
      LIMIT 200
    `);

    res.json(result.rows.map(row => ({
      id: row.id,
      businessId: row.business_id,
      businessName: row.business_name || 'Negocio',
      businessCategory: row.business_category || 'Servicios',
      serviceId: row.service_id,
      serviceName: row.service_name,
      servicePrice: parseFloat(row.service_price) || 0,
      serviceDuration: row.service_duration,
      date: row.date,
      time: row.time,
      clientName: row.client_name,
      clientPhone: row.client_phone,
      clientEmail: row.client_email,
      notes: row.notes,
      status: row.status,
      createdAt: row.created_at
    })));
  } catch (error) {
    console.error('Error obteniendo citas globales:', error);
    res.status(500).json({ error: 'Error al obtener reservas globales.' });
  }
});

// 5. Alertas de Categorías Nuevas
app.get('/api/developer/category-alerts', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM reservas_custom_category_alerts ORDER BY created_at DESC');
    res.json(result.rows.map(row => ({
      id: row.id,
      businessId: row.business_id,
      businessName: row.business_name,
      categoryId: row.category_id,
      categoryName: row.category_name,
      status: row.status,
      createdAt: row.created_at
    })));
  } catch (error) {
    console.error('Error obteniendo alertas de categorías:', error);
    res.status(500).json({ error: 'Error al obtener alertas.' });
  }
});

// 6. Marcar Alerta como Leída / Descartada
app.post('/api/developer/category-alerts/:id/dismiss', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE reservas_custom_category_alerts SET status = \'read\' WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error descartando alerta:', error);
    res.status(500).json({ error: 'Error al actualizar alerta.' });
  }
});

// 7. Eliminar Negocio por Developer
// 7. Ocultar / Mostrar Negocio de la Página Principal (Visibilidad)
app.patch('/api/developer/businesses/:id/visibility', async (req, res) => {
  try {
    const { id } = req.params;
    const { isHidden } = req.body;
    await pool.query('UPDATE reservas_businesses SET is_hidden = $1 WHERE id = $2', [Boolean(isHidden), id]);
    res.json({ 
      success: true, 
      message: isHidden ? 'Comercio ocultado de la página principal.' : 'Comercio ahora visible en la página principal.',
      isHidden: Boolean(isHidden)
    });
  } catch (error) {
    console.error('Error actualizando visibilidad del comercio:', error);
    res.status(500).json({ error: 'Error al actualizar visibilidad del comercio.' });
  }
});

// 8. Bloquear / Desbloquear Negocio (Suspensión de Operaciones)
app.patch('/api/developer/businesses/:id/block', async (req, res) => {
  try {
    const { id } = req.params;
    const { isBlocked, reason = '' } = req.body;
    await pool.query('UPDATE reservas_businesses SET is_blocked = $1, block_reason = $2 WHERE id = $3', [Boolean(isBlocked), reason.trim(), id]);
    res.json({ 
      success: true, 
      message: isBlocked ? 'Comercio bloqueado/suspendido correctamente.' : 'Comercio desbloqueado exitosamente.',
      isBlocked: Boolean(isBlocked),
      blockReason: reason.trim()
    });
  } catch (error) {
    console.error('Error actualizando estado de bloqueo del comercio:', error);
    res.status(500).json({ error: 'Error al actualizar estado de bloqueo del comercio.' });
  }
});

// 9. Eliminar Negocio por Developer
app.delete('/api/developer/businesses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Eliminar en cascada
    await pool.query('DELETE FROM reservas_custom_category_alerts WHERE business_id = $1', [id]);
    await pool.query('DELETE FROM reservas_appointments WHERE business_id = $1', [id]);
    await pool.query('DELETE FROM reservas_services WHERE business_id = $1', [id]);
    await pool.query('DELETE FROM reservas_business_users WHERE business_id = $1', [id]);
    await pool.query('DELETE FROM reservas_businesses WHERE id = $1', [id]);
    res.json({ success: true, message: 'Negocio y todos sus registros asociados han sido eliminados correctamente.' });
  } catch (error) {
    console.error('Error eliminando negocio desde developer:', error);
    res.status(500).json({ error: 'Error al eliminar negocio.' });
  }
});

// 10. Estadísticas de Datos Depurables para Mantenimiento de BD
app.get('/api/developer/cleanup/stats', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // 1. Password resets expirados o usados
    const resetsRes = await pool.query(
      "SELECT COUNT(*) as count FROM reservas_password_resets WHERE expires_at < NOW() OR used = TRUE"
    );

    // 2. Bloqueos de horarios en fechas pasadas
    const blocksRes = await pool.query(
      "SELECT COUNT(*) as count FROM reservas_blocked_slots WHERE date < $1",
      [today]
    );

    // 3. Alertas de categorías leídas/descartadas con más de 30 días
    const alertsRes = await pool.query(
      "SELECT COUNT(*) as count FROM reservas_custom_category_alerts WHERE status IN ('read', 'dismissed') AND created_at < NOW() - INTERVAL '30 days'"
    );

    // 4. Citas canceladas con más de 60 días
    const aptsRes = await pool.query(
      "SELECT COUNT(*) as count FROM reservas_appointments WHERE status = 'cancelled' AND created_at < NOW() - INTERVAL '60 days'"
    );

    // 5. Pre-registros atendidos o dados de alta con más de 60 días
    const preregRes = await pool.query(
      "SELECT COUNT(*) as count FROM reservas_pre_registrations WHERE status IN ('contacted', 'registered') AND created_at < NOW() - INTERVAL '60 days'"
    );

    const expiredOtpCodes = parseInt(resetsRes.rows[0]?.count || 0, 10);
    const pastDateBlocks = parseInt(blocksRes.rows[0]?.count || 0, 10);
    const oldCategoryAlerts = parseInt(alertsRes.rows[0]?.count || 0, 10);
    const oldCancelledAppointments = parseInt(aptsRes.rows[0]?.count || 0, 10);
    const handledPreRegistrations = parseInt(preregRes.rows[0]?.count || 0, 10);
    const totalPurgeable = expiredOtpCodes + pastDateBlocks + oldCategoryAlerts + oldCancelledAppointments + handledPreRegistrations;

    res.json({
      expiredOtpCodes,
      pastDateBlocks,
      oldCategoryAlerts,
      oldCancelledAppointments,
      handledPreRegistrations,
      passwordResets: expiredOtpCodes,
      pastBlockedSlots: pastDateBlocks,
      cancelledAppointments: oldCancelledAppointments,
      oldPreregistrations: handledPreRegistrations,
      totalPurgeable
    });
  } catch (error) {
    console.error('Error obteniendo stats de limpieza:', error);
    res.status(500).json({ error: 'Error al consultar estadísticas de limpieza.' });
  }
});

// 11. Ejecutar Depuración / Purgado Selectivo de BD
app.post('/api/developer/cleanup/execute', async (req, res) => {
  try {
    const { 
      purgePasswordResets, 
      purgePastBlockedSlots, 
      purgeOldCategoryAlerts, 
      purgeCancelledAppointments, 
      purgeOldPreregistrations,
      otp,
      dateBlocks,
      categoryAlerts,
      cancelledAppointments,
      handledPreRegistrations
    } = req.body;

    const doOtp = purgePasswordResets || otp;
    const doDateBlocks = purgePastBlockedSlots || dateBlocks;
    const doCategoryAlerts = purgeOldCategoryAlerts || categoryAlerts;
    const doCancelled = purgeCancelledAppointments || cancelledAppointments;
    const doPrereg = purgeOldPreregistrations || handledPreRegistrations;

    const today = new Date().toISOString().split('T')[0];
    const results = {
      passwordResets: 0,
      pastBlockedSlots: 0,
      oldCategoryAlerts: 0,
      cancelledAppointments: 0,
      oldPreregistrations: 0
    };

    if (doOtp) {
      const r = await pool.query("DELETE FROM reservas_password_resets WHERE expires_at < NOW() OR used = TRUE");
      results.passwordResets = r.rowCount || 0;
    }

    if (doDateBlocks) {
      const r = await pool.query("DELETE FROM reservas_blocked_slots WHERE date < $1", [today]);
      results.pastBlockedSlots = r.rowCount || 0;
    }

    if (doCategoryAlerts) {
      const r = await pool.query("DELETE FROM reservas_custom_category_alerts WHERE status IN ('read', 'dismissed') AND created_at < NOW() - INTERVAL '30 days'");
      results.oldCategoryAlerts = r.rowCount || 0;
    }

    if (doCancelled) {
      const r = await pool.query("DELETE FROM reservas_appointments WHERE status = 'cancelled' AND created_at < NOW() - INTERVAL '60 days'");
      results.cancelledAppointments = r.rowCount || 0;
    }

    if (doPrereg) {
      const r = await pool.query("DELETE FROM reservas_pre_registrations WHERE status IN ('contacted', 'registered') AND created_at < NOW() - INTERVAL '60 days'");
      results.oldPreregistrations = r.rowCount || 0;
    }

    const totalPurged = Object.values(results).reduce((a, b) => a + b, 0);

    res.json({
      success: true,
      message: `Limpieza completada: se eliminaron ${totalPurged} registros de la base de datos.`,
      results,
      totalPurged
    });
  } catch (error) {
    console.error('Error ejecutando limpieza de BD:', error);
    res.status(500).json({ error: 'Error al ejecutar limpieza de la base de datos.' });
  }
});

// 12. Exportar Historial de Citas y Clientes a Excel Profesional (.xlsx)
app.get('/api/developer/export/appointments-excel', async (req, res) => {
  try {
    const { businessId, status = 'completed', startDate, endDate } = req.query;

    let query = `
      SELECT a.id, a.date, a.time, a.status, a.client_name, a.client_phone, a.client_email,
             a.service_name, a.service_price, a.service_duration, a.notes, a.created_at,
             b.name as business_name, b.category as business_category, b.city as business_city, b.phone as business_phone
      FROM reservas_appointments a
      LEFT JOIN reservas_businesses b ON a.business_id = b.id
      WHERE 1=1
    `;
    const params = [];
    let pIdx = 1;

    if (businessId && businessId !== 'all') {
      query += ` AND a.business_id = $${pIdx++}`;
      params.push(businessId.trim());
    }

    if (status && status !== 'all') {
      query += ` AND a.status = $${pIdx++}`;
      params.push(status.trim());
    }

    if (startDate && startDate.trim()) {
      query += ` AND a.date >= $${pIdx++}`;
      params.push(startDate.trim());
    }

    if (endDate && endDate.trim()) {
      query += ` AND a.date <= $${pIdx++}`;
      params.push(endDate.trim());
    }

    query += ' ORDER BY a.date DESC, a.time DESC';

    const dbRes = await pool.query(query, params);
    const rows = dbRes.rows;

    // Traducir estados
    const statusLabels = {
      'completed': 'Completada / Atendida',
      'confirmed': 'Confirmada',
      'pending': 'Pendiente',
      'cancelled': 'Cancelada'
    };

    // Transformar datos a formato para Excel
    const excelData = rows.map((r, i) => ({
      '#': i + 1,
      'ID Reserva': r.id,
      'Fecha Cita': r.date,
      'Hora': r.time,
      'Estado': statusLabels[r.status] || r.status,
      'Comercio': r.business_name || 'N/A',
      'Categoría Comercio': r.business_category || 'N/A',
      'Ciudad / Cantón': r.business_city || 'N/A',
      'Teléfono Comercio': r.business_phone || 'N/A',
      'Nombre Cliente': r.client_name,
      'Teléfono Cliente': r.client_phone,
      'WhatsApp Enlace': r.client_phone ? `https://wa.me/${r.client_phone.replace(/[^0-9]/g, '')}` : '',
      'Correo Cliente': r.client_email || 'Sin correo',
      'Servicio': r.service_name || 'Servicio General',
      'Duración (min)': r.service_duration || 30,
      'Monto (CRC ₡)': parseFloat(r.service_price) || 0,
      'Notas / Observaciones': r.notes || '',
      'Fecha de Registro': r.created_at ? new Date(r.created_at).toLocaleString('es-CR') : ''
    }));

    // Crear libro de trabajo (Workbook) con SheetJS
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Ajustar anchos de columnas
    const colWidths = [
      { wch: 5 },  // #
      { wch: 14 }, // ID
      { wch: 12 }, // Fecha
      { wch: 10 }, // Hora
      { wch: 22 }, // Estado
      { wch: 28 }, // Comercio
      { wch: 18 }, // Cat
      { wch: 18 }, // Ciudad
      { wch: 18 }, // Tel Biz
      { wch: 26 }, // Cliente
      { wch: 16 }, // Tel Cli
      { wch: 28 }, // WhatsApp link
      { wch: 26 }, // Email Cli
      { wch: 28 }, // Servicio
      { wch: 14 }, // Duración
      { wch: 16 }, // Monto
      { wch: 30 }, // Notas
      { wch: 22 }  // Registro
    ];
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte de Citas y Clientes');

    // Generar buffer XLSX
    const buf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const bizNameSlug = businessId && businessId !== 'all' ? `Comercio_${businessId}` : 'Todos_Comercios';
    const filename = `Reporte_Clientes_ReservasCR_${bizNameSlug}_${new Date().toISOString().split('T')[0]}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buf);
  } catch (error) {
    console.error('Error generando Excel:', error);
    res.status(500).json({ error: 'Error al generar el archivo Excel.' });
  }
});

// ==========================================
// RESEÑAS Y CALIFICACIONES VERIFICADAS POST-CITA
// ==========================================

/**
 * Calcula la fecha y hora exacta en que finaliza una cita
 */
function parseAppointmentEndTime(dateStr, timeStr, durationMinutes = 30) {
  try {
    if (!dateStr || !timeStr) return null;
    let year, month, day;
    const cleanDate = String(dateStr).trim();
    if (cleanDate.includes('-')) {
      const parts = cleanDate.split('-');
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      day = parseInt(parts[2], 10);
    } else if (cleanDate.includes('/')) {
      const parts = cleanDate.split('/');
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      year = parseInt(parts[2], 10);
    } else {
      return null;
    }

    let hour = 12;
    let minute = 0;
    const cleanTime = String(timeStr).trim().toUpperCase();
    const isPM = cleanTime.includes('PM');
    const isAM = cleanTime.includes('AM');
    const timeDigits = cleanTime.replace(/[^0-9:]/g, '');
    const timeParts = timeDigits.split(':');

    if (timeParts.length >= 1) {
      hour = parseInt(timeParts[0], 10);
      if (timeParts.length >= 2) {
        minute = parseInt(timeParts[1], 10);
      }
      if (isPM && hour < 12) hour += 12;
      if (isAM && hour === 12) hour = 0;
    }

    const aptDate = new Date(year, month, day, hour, minute, 0, 0);
    const durationMs = (parseInt(durationMinutes, 10) || 30) * 60 * 1000;
    return new Date(aptDate.getTime() + durationMs);
  } catch (e) {
    return null;
  }
}

/**
 * Procesa y envía correos de solicitud de calificación a citas terminadas hace 1 hora
 */
async function processPendingReviewEmails() {
  try {
    const result = await pool.query(`
      SELECT a.*, b.name as business_name, b.email as business_email
      FROM reservas_appointments a
      LEFT JOIN reservas_businesses b ON a.business_id = b.id
      WHERE a.status != 'cancelled'
        AND a.client_email IS NOT NULL 
        AND a.client_email LIKE '%@%'
        AND a.review_email_sent_at IS NULL
      ORDER BY a.created_at DESC
      LIMIT 30
    `);

    const now = Date.now();
    const ONE_HOUR_MS = 60 * 60 * 1000;

    for (const apt of result.rows) {
      const endTime = parseAppointmentEndTime(apt.date, apt.time, apt.service_duration);
      if (!endTime) continue;

      // Si ya pasó al menos 1 hora desde que terminó la cita
      const timeSinceEnd = now - endTime.getTime();
      if (timeSinceEnd >= ONE_HOUR_MS) {
        console.log(`⏰ Cita #${apt.id} finalizó hace ${Math.round(timeSinceEnd / 60000)} min. Enviando correo de valoración...`);
        
        const appointmentObj = {
          id: apt.id,
          businessId: apt.business_id,
          businessName: apt.business_name,
          serviceName: apt.service_name,
          date: apt.date,
          time: apt.time,
          clientName: apt.client_name,
          clientEmail: apt.client_email,
          clientPhone: apt.client_phone
        };

        const businessObj = {
          id: apt.business_id,
          name: apt.business_name
        };

        const emailRes = await sendReviewRequestEmail(appointmentObj, businessObj);
        if (emailRes && emailRes.success) {
          await pool.query('UPDATE reservas_appointments SET review_email_sent_at = NOW() WHERE id = $1', [apt.id]);
          console.log(`⭐ Correo de valoración registrado exitosamente para la cita #${apt.id}.`);
        }
      }
    }
  } catch (err) {
    console.error('⚠️ Error en worker de correos de reseñas:', err.message);
  }
}

// 1. Obtener información para calificar una cita específica
app.get('/api/appointments/:id/review-info', async (req, res) => {
  try {
    const { id } = req.params;
    const cleanId = (id || '').trim();

    const aptRes = await pool.query(`
      SELECT a.*, b.name as business_name, b.image as business_image, b.city as business_city
      FROM reservas_appointments a
      LEFT JOIN reservas_businesses b ON a.business_id = b.id
      WHERE LOWER(a.id) = LOWER($1)
    `, [cleanId]);

    if (aptRes.rows.length === 0) {
      return res.status(404).json({ error: 'Cita no encontrada.' });
    }

    const apt = aptRes.rows[0];

    // Verificar si ya existe reseña para esta cita
    const revRes = await pool.query('SELECT * FROM reservas_reviews WHERE LOWER(appointment_id) = LOWER($1)', [apt.id]);
    const existingReview = revRes.rows.length > 0 ? revRes.rows[0] : null;

    res.json({
      appointment: {
        id: apt.id,
        businessId: apt.business_id,
        businessName: apt.business_name,
        businessImage: apt.business_image,
        businessCity: apt.business_city,
        serviceName: apt.service_name,
        servicePrice: parseFloat(apt.service_price),
        date: apt.date,
        time: apt.time,
        clientName: apt.client_name,
        clientPhone: apt.client_phone,
        clientEmail: apt.client_email,
        status: apt.status
      },
      alreadyReviewed: Boolean(existingReview),
      review: existingReview ? {
        id: existingReview.id,
        rating: existingReview.rating,
        comment: existingReview.comment,
        createdAt: existingReview.created_at
      } : null
    });
  } catch (error) {
    console.error('Error en /api/appointments/:id/review-info:', error);
    res.status(500).json({ error: 'Error al consultar datos para calificar.' });
  }
});

// 2. Registrar nueva reseña verificada
app.post('/api/reviews', async (req, res) => {
  try {
    const { appointmentId, rating, comment } = req.body;
    if (!appointmentId || !rating) {
      return res.status(400).json({ error: 'El ID de la cita y la calificación de estrellas son obligatorios.' });
    }

    const ratingNum = parseInt(rating, 10);
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ error: 'La calificación debe ser un número entero entre 1 y 5 estrellas.' });
    }

    const cleanId = String(appointmentId).trim();

    // Verificar que la cita existe
    const aptRes = await pool.query('SELECT * FROM reservas_appointments WHERE LOWER(id) = LOWER($1)', [cleanId]);
    if (aptRes.rows.length === 0) {
      return res.status(404).json({ error: 'La cita especificada no existe.' });
    }

    const apt = aptRes.rows[0];

    // Verificar si ya fue calificada previamente
    const existing = await pool.query('SELECT id FROM reservas_reviews WHERE LOWER(appointment_id) = LOWER($1)', [apt.id]);
    let targetReviewId = `rev-${Date.now().toString().slice(-6)}`;
    let isUpdate = false;

    if (existing.rows.length > 0) {
      targetReviewId = existing.rows[0].id;
      isUpdate = true;
      await pool.query(`
        UPDATE reservas_reviews SET
          rating = $1,
          comment = $2,
          created_at = NOW()
        WHERE id = $3
      `, [ratingNum, (comment || '').trim(), targetReviewId]);
    } else {
      await pool.query(`
        INSERT INTO reservas_reviews (
          id, business_id, appointment_id, client_name, client_phone,
          client_email, service_name, rating, comment, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      `, [
        targetReviewId, apt.business_id, apt.id, apt.client_name,
        apt.client_phone, apt.client_email || '', apt.service_name || '',
        ratingNum, (comment || '').trim()
      ]);
    }

    // Marcar cita como completada si aún no lo estaba
    await pool.query("UPDATE reservas_appointments SET status = 'completed' WHERE id = $1 AND status != 'cancelled'", [cleanId]);

    // Recalcular el promedio de calificación y conteo de reseñas del negocio
    const statsRes = await pool.query(`
      SELECT COUNT(*) as total_reviews, AVG(rating) as avg_rating
      FROM reservas_reviews
      WHERE business_id = $1
    `, [apt.business_id]);

    const totalReviews = parseInt(statsRes.rows[0].total_reviews, 10) || 1;
    const avgRating = parseFloat(parseFloat(statsRes.rows[0].avg_rating).toFixed(1)) || ratingNum;

    await pool.query(`
      UPDATE reservas_businesses SET
        rating = $1,
        reviews_count = $2
      WHERE id = $3
    `, [avgRating, totalReviews, apt.business_id]);

    res.status(201).json({
      success: true,
      message: isUpdate 
        ? '¡Muchas gracias! Tu reseña ha sido actualizada exitosamente.' 
        : '¡Muchas gracias! Tu reseña verificada ha sido publicada exitosamente.',
      review: {
        id: targetReviewId,
        appointmentId: apt.id,
        businessId: apt.business_id,
        clientName: apt.client_name,
        serviceName: apt.service_name,
        rating: ratingNum,
        comment: (comment || '').trim()
      },
      updatedBusiness: {
        rating: avgRating,
        reviewsCount: totalReviews
      }
    });
  } catch (error) {
    console.error('Error registrando reseña:', error);
    res.status(500).json({ error: 'Error al registrar la reseña.' });
  }
});

// 3. Obtener reseñas de un negocio específico
app.get('/api/businesses/:id/reviews', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT r.*, a.date as appointment_date, a.time as appointment_time
      FROM reservas_reviews r
      LEFT JOIN reservas_appointments a ON r.appointment_id = a.id
      WHERE r.business_id = $1
      ORDER BY r.created_at DESC
    `, [id]);

    const reviews = result.rows.map(row => ({
      id: row.id,
      businessId: row.business_id,
      appointmentId: row.appointment_id,
      clientName: row.client_name,
      serviceName: row.service_name,
      rating: parseInt(row.rating, 10),
      comment: row.comment,
      createdAt: row.created_at,
      appointmentDate: row.appointment_date,
      appointmentTime: row.appointment_time,
      isVerified: true
    }));

    res.json(reviews);
  } catch (error) {
    console.error('Error consultando reseñas del negocio:', error);
    res.status(500).json({ error: 'Error al consultar opiniones.' });
  }
});

// 4. Endpoint de prueba para enviar correo de calificación a cualquier dirección
app.post('/api/test-review-email', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Debes proporcionar un correo electrónico válido.' });
    }

    const testAppointment = {
      id: `apt-${Date.now().toString().slice(-6)}`,
      clientName: 'Cliente VIP de Prueba',
      clientEmail: email.trim(),
      clientPhone: '+506 8888 7777',
      serviceName: 'Corte de Cabello Clásico & Barba',
      serviceDuration: 45,
      servicePrice: 10000,
      date: '2026-09-15',
      time: '10:00 AM'
    };

    const testBusiness = {
      name: 'Barbería & Estilo Vintage',
      address: 'Av. Escazú, Local 12',
      city: 'San José, Escazú',
      phone: '+506 8899 1122'
    };

    const result = await sendReviewRequestEmail(testAppointment, testBusiness);
    res.json({ success: true, message: 'Correo de valoración de prueba enviado exitosamente.', result });
  } catch (error) {
    console.error('Error en /api/test-review-email:', error);
    res.status(500).json({ error: error.message || 'Error enviando correo de prueba de valoración.' });
  }
});

// ==========================================
// INTEGRACIÓN DE PAGOS Y SUSCRIPCIONES PAYPAL
// ==========================================

// Helper para obtener ajustes de PayPal desde la BD o variables de entorno
async function getPayPalSettings() {
  const defaults = {
    clientId: process.env.PAYPAL_CLIENT_ID || 'BAAsEQDC0BKe7tSW6HzeTRQaXGSaWDvD2WkilEkv31h9Ttq2K2phZ8RGMOp9SyNN-sM0wuAnBVMVPr7YHo',
    clientSecret: process.env.PAYPAL_CLIENT_SECRET || 'ECkYk7RbWEG2ok9w2Kx5SCGPHwnFegU4I8y3Jv-e-YXWR8wx6jYwXFCBSSMeICkmO2rTVFLAwDXmW6P6',
    env: process.env.PAYPAL_ENV || 'live',
    planTest: 'P-8U675044DY030573GNKVATZQ',
    planBasic: 'P-2J419336TA519012VNKU75PY',
    planPro: 'P-3ER02078XB861273LNKU75QA',
    planUnlimited: 'P-8VC868094T599031CNKU75QA'
  };

  try {
    const res = await pool.query("SELECT key, value FROM reservas_system_settings WHERE key LIKE 'paypal_%'");
    for (const row of res.rows) {
      if (row.key === 'paypal_client_id' && row.value) defaults.clientId = row.value;
      if (row.key === 'paypal_client_secret' && row.value) defaults.clientSecret = row.value;
      if (row.key === 'paypal_env' && row.value) defaults.env = row.value;
      if (row.key === 'paypal_plan_test_id' && row.value) defaults.planTest = row.value;
      if (row.key === 'paypal_plan_basic_id' && row.value) defaults.planBasic = row.value;
      if (row.key === 'paypal_plan_pro_id' && row.value) defaults.planPro = row.value;
      if (row.key === 'paypal_plan_unlimited_id' && row.value) defaults.planUnlimited = row.value;
    }
  } catch (err) {
    console.warn('Advertencia obteniendo ajustes de PayPal:', err.message);
  }

  return defaults;
}

// Helper para obtener token de acceso OAuth2 de PayPal
async function getPayPalAccessToken() {
  const settings = await getPayPalSettings();
  const host = settings.env === 'live' ? 'api-m.paypal.com' : 'api-m.sandbox.paypal.com';
  const auth = Buffer.from(`${settings.clientId}:${settings.clientSecret}`).toString('base64');

  const res = await fetch(`https://${host}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error_description || errData.error || `Error ${res.status} al autenticar con PayPal`);
  }

  const data = await res.json();
  return { token: data.access_token, host, settings };
}

// 1. Obtener Configuración Pública de PayPal para el Frontend
app.get('/api/paypal/config', async (req, res) => {
  try {
    const settings = await getPayPalSettings();
    res.json({
      success: true,
      clientId: settings.clientId,
      env: settings.env,
      currency: 'USD',
      plans: {
        test: settings.planTest,
        basic: settings.planBasic,
        pro: settings.planPro,
        unlimited: settings.planUnlimited
      }
    });
  } catch (error) {
    console.error('Error en GET /api/paypal/config:', error);
    res.status(500).json({ error: 'Error al obtener configuración de PayPal' });
  }
});

// 2. Verificar y Activar Suscripción tras aprobación de PayPal
app.post('/api/paypal/verify-subscription', async (req, res) => {
  try {
    const { subscriptionId, businessId, planId } = req.body;

    if (!subscriptionId || !businessId || !planId) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos (subscriptionId, businessId, planId).' });
    }

    const { token, host } = await getPayPalAccessToken();

    // Consultar detalles de la suscripción en la API de PayPal
    const payPalRes = await fetch(`https://${host}/v1/billing/subscriptions/${subscriptionId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!payPalRes.ok) {
      const errData = await payPalRes.json().catch(() => ({}));
      return res.status(400).json({
        error: 'No se pudo verificar la suscripción con PayPal.',
        details: errData
      });
    }

    const subData = await payPalRes.json();
    const status = subData.status; // 'ACTIVE', 'APPROVED'

    if (status !== 'ACTIVE' && status !== 'APPROVED') {
      return res.status(400).json({
        error: `La suscripción en PayPal tiene un estado no activo: ${status}`
      });
    }

    // Mapeo de límites y precios por plan
    const planConfigMap = {
      'basic': { price: 10.00, limit: 150, name: 'Plan Básico' },
      'pro': { price: 18.00, limit: 300, name: 'Plan Profesional' },
      'unlimited': { price: 35.00, limit: 999999, name: 'Plan Ilimitado' }
    };

    const targetPlan = planConfigMap[planId] || planConfigMap['pro'];

    // Actualizar comercio en la Base de Datos PostgreSQL
    const updateRes = await pool.query(`
      UPDATE reservas_businesses
      SET plan = $1,
          plan_price_usd = $2,
          monthly_booking_limit = $3,
          paypal_subscription_id = $4,
          subscription_status = 'active',
          subscription_updated_at = NOW()
      WHERE id = $5
      RETURNING *
    `, [planId, targetPlan.price, targetPlan.limit, subscriptionId, businessId]);

    if (updateRes.rowCount === 0) {
      return res.status(404).json({ error: 'Comercio no encontrado en la base de datos.' });
    }

    console.log(`✅ Suscripción PayPal activada con éxito para comercio [${businessId}] -> Plan: ${planId} (${subscriptionId})`);

    res.json({
      success: true,
      message: `¡Suscripción al ${targetPlan.name} activada con éxito!`,
      subscriptionId,
      status,
      business: updateRes.rows[0]
    });
  } catch (error) {
    console.error('Error en /api/paypal/verify-subscription:', error);
    res.status(500).json({ error: error.message || 'Error al procesar suscripción de PayPal.' });
  }
});

// 2.1 Crear Orden de Pago Único Mensual (Guest Checkout - Tarjeta directa sin crear cuenta)
app.post('/api/paypal/create-order', async (req, res) => {
  try {
    const { businessId, planId } = req.body;
    if (!businessId || !planId) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos (businessId, planId).' });
    }

    const planConfigMap = {
      'basic': { price: '10.00', name: 'Plan Básico', limit: 150 },
      'pro': { price: '18.00', name: 'Plan Profesional', limit: 300 },
      'unlimited': { price: '35.00', name: 'Plan Ilimitado', limit: 999999 }
    };

    const targetPlan = planConfigMap[planId] || planConfigMap['pro'];
    const { token, host } = await getPayPalAccessToken();

    const orderPayload = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: `${businessId}_${planId}`,
          description: `Activación 30 Días - ${targetPlan.name} (Reservas CR)`,
          custom_id: JSON.stringify({ businessId, planId }),
          amount: {
            currency_code: 'USD',
            value: targetPlan.price
          }
        }
      ],
      application_context: {
        brand_name: 'Reservas CR',
        landing_page: 'BILLING',
        user_action: 'PAY_NOW',
        shipping_preference: 'NO_SHIPPING'
      }
    };

    const payPalRes = await fetch(`https://${host}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderPayload)
    });

    const orderData = await payPalRes.json();
    if (!payPalRes.ok) {
      return res.status(400).json({ error: 'Error al crear la orden en PayPal.', details: orderData });
    }

    res.json({ success: true, orderId: orderData.id, order: orderData });
  } catch (error) {
    console.error('Error en /api/paypal/create-order:', error);
    res.status(500).json({ error: error.message || 'Error interno creando orden de PayPal.' });
  }
});

// 2.2 Capturar Orden y Activar Plan en PostgreSQL
app.post('/api/paypal/capture-order', async (req, res) => {
  try {
    const { orderId, businessId, planId } = req.body;
    if (!orderId || !businessId || !planId) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos (orderId, businessId, planId).' });
    }

    const { token, host } = await getPayPalAccessToken();

    const payPalRes = await fetch(`https://${host}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const captureData = await payPalRes.json();
    if (!payPalRes.ok) {
      return res.status(400).json({ error: 'Error al capturar el pago en PayPal.', details: captureData });
    }

    if (captureData.status !== 'COMPLETED') {
      return res.status(400).json({ error: `El pago no se completó. Estado actual: ${captureData.status}` });
    }

    const planConfigMap = {
      'basic': { price: 10.00, limit: 150, name: 'Plan Básico' },
      'pro': { price: 18.00, limit: 300, name: 'Plan Profesional' },
      'unlimited': { price: 35.00, limit: 999999, name: 'Plan Ilimitado' }
    };

    const targetPlan = planConfigMap[planId] || planConfigMap['pro'];

    // Actualizar comercio en la Base de Datos PostgreSQL
    const updateRes = await pool.query(`
      UPDATE reservas_businesses
      SET plan = $1,
          plan_price_usd = $2,
          monthly_booking_limit = $3,
          paypal_subscription_id = $4,
          subscription_status = 'active',
          payment_method = 'card_paypal',
          subscription_updated_at = NOW()
      WHERE id = $5
      RETURNING *
    `, [planId, targetPlan.price, targetPlan.limit, orderId, businessId]);

    if (updateRes.rowCount === 0) {
      return res.status(404).json({ error: 'Comercio no encontrado en la base de datos.' });
    }

    console.log(`✅ Pago de mensualidad con tarjeta / PayPal completado para [${businessId}] -> Plan: ${planId} (Order: ${orderId})`);

    res.json({
      success: true,
      message: `¡Pago de mensualidad del ${targetPlan.name} procesado con éxito!`,
      orderId,
      status: captureData.status,
      business: updateRes.rows[0]
    });
  } catch (error) {
    console.error('Error en /api/paypal/capture-order:', error);
    res.status(500).json({ error: error.message || 'Error capturando orden de PayPal.' });
  }
});

// 3. Cancelar Suscripción de PayPal
app.post('/api/paypal/cancel-subscription', async (req, res) => {
  try {
    const { businessId, reason = 'Cancelado por el usuario' } = req.body;
    if (!businessId) {
      return res.status(400).json({ error: 'ID de comercio requerido.' });
    }

    const bizRes = await pool.query('SELECT * FROM reservas_businesses WHERE id = $1', [businessId]);
    if (bizRes.rowCount === 0) {
      return res.status(404).json({ error: 'Comercio no encontrado.' });
    }

    const biz = bizRes.rows[0];
    const subId = biz.paypal_subscription_id;

    if (subId) {
      try {
        const { token, host } = await getPayPalAccessToken();
        await fetch(`https://${host}/v1/billing/subscriptions/${subId}/cancel`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ reason })
        });
      } catch (err) {
        console.warn('Aviso cancelando en PayPal API:', err.message);
      }
    }

    // Actualizar estado en BD
    await pool.query(`
      UPDATE reservas_businesses
      SET subscription_status = 'cancelled',
          subscription_updated_at = NOW()
      WHERE id = $1
    `, [businessId]);

    res.json({
      success: true,
      message: 'Suscripción cancelada correctamente.'
    });
  } catch (error) {
    console.error('Error en /api/paypal/cancel-subscription:', error);
    res.status(500).json({ error: error.message || 'Error al cancelar suscripción.' });
  }
});

// 3.1 Activación Manual de Plan por Developer (SINPE Móvil / Autorización Manual)
app.post('/api/developer/activate-business-plan', async (req, res) => {
  try {
    const { businessId, planId, daysValid = 30 } = req.body;
    if (!businessId || !planId) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos (businessId, planId).' });
    }

    const planConfigMap = {
      'basic': { price: 10.00, limit: 150, name: 'Plan Básico' },
      'pro': { price: 18.00, limit: 300, name: 'Plan Profesional' },
      'unlimited': { price: 35.00, limit: 999999, name: 'Plan Ilimitado' }
    };

    const targetPlan = planConfigMap[planId] || planConfigMap['pro'];

    const updateRes = await pool.query(`
      UPDATE reservas_businesses
      SET plan = $1,
          plan_price_usd = $2,
          monthly_booking_limit = $3,
          subscription_status = 'active',
          payment_method = 'sinpe_movil',
          subscription_updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `, [planId, targetPlan.price, targetPlan.limit, businessId]);

    if (updateRes.rowCount === 0) {
      return res.status(404).json({ error: 'Comercio no encontrado.' });
    }

    console.log(`✅ Plan ${planId} activado manualmente vía SINPE para comercio [${businessId}]`);

    res.json({
      success: true,
      message: `¡Comercio activado exitosamente con ${targetPlan.name}!`,
      business: updateRes.rows[0]
    });
  } catch (error) {
    console.error('Error en /api/developer/activate-business-plan:', error);
    res.status(500).json({ error: error.message || 'Error al activar comercio.' });
  }
});

// 4. Webhook Oficial de PayPal (Eventos en tiempo real)
app.post('/api/webhooks/paypal', async (req, res) => {
  try {
    const event = req.body;
    const eventType = event.event_type;
    const resource = event.resource || {};

    console.log(`🔔 Webhook PayPal recibido: [${eventType}] - ID: ${resource.id || 'N/A'}`);

    // Manejar eventos clave de Suscripciones
    if (eventType === 'BILLING.SUBSCRIPTION.ACTIVATED' || eventType === 'PAYMENT.SALE.COMPLETED') {
      const subId = resource.billing_agreement_id || resource.id;
      if (subId) {
        await pool.query(`
          UPDATE reservas_businesses
          SET subscription_status = 'active',
              subscription_updated_at = NOW()
          WHERE paypal_subscription_id = $1
        `, [subId]);
      }
    } else if (eventType === 'BILLING.SUBSCRIPTION.CANCELLED' || eventType === 'BILLING.SUBSCRIPTION.EXPIRED') {
      const subId = resource.id;
      if (subId) {
        await pool.query(`
          UPDATE reservas_businesses
          SET subscription_status = 'cancelled',
              subscription_updated_at = NOW()
          WHERE paypal_subscription_id = $1
        `, [subId]);
      }
    } else if (eventType === 'BILLING.SUBSCRIPTION.SUSPENDED' || eventType === 'BILLING.SUBSCRIPTION.PAYMENT.FAILED') {
      const subId = resource.id;
      if (subId) {
        await pool.query(`
          UPDATE reservas_businesses
          SET subscription_status = 'past_due',
              subscription_updated_at = NOW()
          WHERE paypal_subscription_id = $1
        `, [subId]);
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error procesando webhook de PayPal:', error);
    res.status(200).send('ERROR_HANDLED');
  }
});

// 4.1 Webhook Oficial de WhatsApp Cloud API (Verificación y Eventos)
app.get('/api/webhooks/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || 'reservas_cr_webhook_token_2026';

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('✅ Webhook de WhatsApp verificado exitosamente con Meta.');
      res.status(200).send(challenge);
    } else {
      console.warn('⚠️ Fallo en token de verificación de webhook WhatsApp');
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(400);
  }
});

app.post('/api/webhooks/whatsapp', (req, res) => {
  try {
    const body = req.body;
    if (body.object) {
      console.log('🔔 Evento Webhook WhatsApp recibido:', JSON.stringify(body, null, 2));
      res.status(200).send('EVENT_RECEIVED');
    } else {
      res.sendStatus(404);
    }
  } catch (err) {
    console.error('Error procesando webhook WhatsApp:', err);
    res.status(200).send('ERROR_HANDLED');
  }
});

// 5. Guardar Configuración de PayPal desde el Panel Developer
app.post('/api/developer/paypal-settings', async (req, res) => {
  try {
    const { clientId, clientSecret, env, planBasic, planPro, planUnlimited } = req.body;

    const updates = [
      ['paypal_client_id', clientId?.trim()],
      ['paypal_client_secret', clientSecret?.trim()],
      ['paypal_env', env === 'live' ? 'live' : 'sandbox'],
      ['paypal_plan_basic_id', planBasic?.trim()],
      ['paypal_plan_pro_id', planPro?.trim()],
      ['paypal_plan_unlimited_id', planUnlimited?.trim()]
    ];

    for (const [key, val] of updates) {
      if (val !== undefined && val !== null) {
        await pool.query(`
          INSERT INTO reservas_system_settings (key, value, updated_at)
          VALUES ($1, $2, NOW())
          ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
        `, [key, val]);
      }
    }

    res.json({ success: true, message: 'Configuración de PayPal guardada exitosamente.' });
  } catch (error) {
    console.error('Error en /api/developer/paypal-settings:', error);
    res.status(500).json({ error: 'Error guardando ajustes de PayPal.' });
  }
});

// 6. Sincronizar y Crear Planes Automáticamente en PayPal desde el Panel Dev
app.post('/api/developer/paypal-sync-plans', async (req, res) => {
  try {
    const { token, host } = await getPayPalAccessToken();

    // 1. Crear o recuperar Producto en PayPal
    const prodRes = await fetch(`https://${host}/v1/catalogs/products`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        name: 'Reservas CR - Suscripciones',
        description: 'Planes de suscripcion mensual para comercios en Reservas CR',
        type: 'SERVICE',
        category: 'SOFTWARE'
      })
    });

    const prodData = await prodRes.json();
    const productId = prodData.id;

    if (!productId) {
      return res.status(400).json({ error: 'No se pudo crear el producto en PayPal.', details: prodData });
    }

    // 2. Crear los 3 planes
    const plansToCreate = [
      { idKey: 'paypal_plan_basic_id', name: 'Plan Básico Reservas CR', price: '10.00', desc: 'Hasta 150 reservas mensuales' },
      { idKey: 'paypal_plan_pro_id', name: 'Plan Profesional Reservas CR', price: '18.00', desc: 'Hasta 300 reservas mensuales y WhatsApp' },
      { idKey: 'paypal_plan_unlimited_id', name: 'Plan Ilimitado Reservas CR', price: '35.00', desc: 'Reservas ilimitadas y soporte prioritario' }
    ];

    const createdPlans = {};

    for (const p of plansToCreate) {
      const planRes = await fetch(`https://${host}/v1/billing/plans`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          product_id: productId,
          name: p.name,
          description: p.desc,
          status: 'ACTIVE',
          billing_cycles: [
            {
              frequency: { interval_unit: 'MONTH', interval_count: 1 },
              tenure_type: 'REGULAR',
              sequence: 1,
              total_cycles: 0,
              pricing_scheme: {
                fixed_price: { value: p.price, currency_code: 'USD' }
              }
            }
          ],
          payment_preferences: {
            auto_bill_outstanding: true,
            setup_fee: { value: '0', currency_code: 'USD' },
            setup_fee_failure_action: 'CONTINUE',
            payment_failure_threshold: 3
          }
        })
      });

      const planData = await planRes.json();
      if (planData.id) {
        createdPlans[p.idKey] = planData.id;
        await pool.query(`
          INSERT INTO reservas_system_settings (key, value, updated_at)
          VALUES ($1, $2, NOW())
          ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
        `, [p.idKey, planData.id]);
      }
    }

    res.json({
      success: true,
      message: 'Planes sincronizados y creados con éxito en PayPal.',
      productId,
      plans: createdPlans
    });
  } catch (error) {
    console.error('Error en /api/developer/paypal-sync-plans:', error);
    res.status(500).json({ error: error.message || 'Error al sincronizar planes con PayPal.' });
  }
});

// Iniciar base de datos, servidor y worker de reseñas
async function startServer() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`🚀 Servidor de Reservas corriendo en http://localhost:${PORT}`);
    console.log(`🐘 Conectado a Neon PostgreSQL`);

    // Iniciar worker de correos de reseñas automáticos cada 5 minutos
    setInterval(processPendingReviewEmails, 5 * 60 * 1000);
    // Ejecutar chequeo inicial 10 segundos después del arranque
    setTimeout(processPendingReviewEmails, 10000);
  });
}

startServer();

