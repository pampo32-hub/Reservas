import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
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
  sendNewBookingAlertToBusinessWhatsApp,
  sendAppointmentReminderWhatsApp,
  sendPreRegistrationConfirmationWhatsApp,
  getActiveMetaCredentials, 
  sendViaMetaCloudApi, 
  buildBookingConfirmationText, 
  formatMetaPhone 
} from './whatsappService.js';
import { 
  initPushService, 
  getVapidPublicKey, 
  savePushSubscription, 
  removePushSubscription, 
  sendPushToBusiness 
} from './pushService.js';
import { parseSinpeEmail } from './src/services/sinpeParser.js';
import { startSinpeImapWorker } from './sinpeImapService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

export function slugify(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'negocio';
}
const PORT = process.env.PORT || 3000;

// 1. Cabeceras de seguridad HTTP con Helmet (Permitir popups de PayPal y OAuth sin bloquear window.opener)
app.use(helmet({
  contentSecurityPolicy: false, // Permitir CDNs externos (Tailwind CDN, Google Fonts, FontAwesome, PayPal SDK)
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// 2. Compresión Gzip/Brotli de alto rendimiento (> 1KB, excluyendo SSE)
app.use(compression({
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression'] || req.headers.accept === 'text/event-stream' || req.path === '/api/realtime/stream') {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// 3. Política CORS robusta y segura
const isAllowedOrigin = (origin) => {
  if (!origin) return true; // Server-to-server, Postman, Webhooks de PayPal/WhatsApp/SINPE, Apps móviles
  if (process.env.NODE_ENV !== 'production') return true;
  try {
    const url = new URL(origin);
    return (
      url.hostname === 'reservascr.app' ||
      url.hostname.endsWith('.reservascr.app') ||
      url.hostname.endsWith('.onrender.com') ||
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1'
    );
  } catch (e) {
    return false;
  }
};

app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Bloqueado por política CORS'));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '15mb' }));

// 4. Protección estricta contra divulgación de archivos del servidor
app.use((req, res, next) => {
  const p = (req.path || req.url || '').toLowerCase();
  if (
    p.includes('.env') ||
    p.endsWith('server.js') ||
    p.endsWith('db.js') ||
    p.endsWith('package.json') ||
    p.endsWith('package-lock.json') ||
    p.endsWith('.sql') ||
    p.endsWith('.py') ||
    p.endsWith('.sh') ||
    p.includes('/.git') ||
    p.includes('/node_modules')
  ) {
    return res.status(403).send('Acceso Prohibido');
  }
  next();
});

// 5. Configuración de encabezados de caché inteligentes
app.use((req, res, next) => {
  const p = (req.path || req.url || '').toLowerCase();
  
  // Archivos de código JavaScript y CSS: revalidación condicional con ETag (HTTP 304 ahorra ancho de banda)
  if (p.startsWith('/src/') || p.endsWith('.js') || p.endsWith('.css')) {
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  } 
  // Archivos multimedia y recursos estáticos: caché extendida (24 horas)
  else if (p.startsWith('/public/') || p.startsWith('/uploads/') || /\.(png|jpe?g|gif|svg|ico|webp|woff2?|ttf|eot)$/i.test(p)) {
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=43200');
  }
  // API endpoints: sin caché para garantizar datos frescos en tiempo real
  else if (p.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  // Rutas HTML / SPA y Service Worker: no almacenar caché obsoleta pero permitir revalidación
  else {
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
  }
  next();
});

// Servir exclusivamente directorios públicos autorizados (Cierre de fuga S-01)
app.use('/public', express.static(path.join(__dirname, 'public'), { maxAge: '7d' }));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads'), { maxAge: '30d' }));
app.use('/src', express.static(path.join(__dirname, 'src')));
app.use(['/directorio/src', '*/src'], express.static(path.join(__dirname, 'src')));

// Archivos estáticos de raíz permitidos expresamente
const ALLOWED_ROOT_STATIC_FILES = [
  'favicon.ico', 'favicon.png', 'favicon.jpg', 'favicon.svg',
  'manifest.json', 'sw.js', 'robots.txt', 'sitemap.xml',
  'promo-ad-anim.html', 'manual_usuario_comercios.html'
];
ALLOWED_ROOT_STATIC_FILES.forEach(file => {
  app.get(`/${file}`, (req, res) => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
      if (file === 'sw.js') {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
      res.sendFile(filePath);
    } else {
      res.status(404).end();
    }
  });
});

// ==========================================
// SEGURIDAD Y UTILIDADES DE AUTENTICACIÓN (BCRYPT & JWT)
// ==========================================
const JWT_SECRET = process.env.JWT_SECRET || 'reservas_cr_secure_jwt_secret_2026_super_key';

export async function hashPassword(plainPassword) {
  if (!plainPassword) return '';
  return await bcrypt.hash(plainPassword, 10);
}

export async function verifyPassword(plainPassword, storedPassword) {
  if (!plainPassword || !storedPassword) return false;
  if (storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$') || storedPassword.startsWith('$2y$')) {
    return await bcrypt.compare(plainPassword, storedPassword);
  }
  return plainPassword === storedPassword;
}

export function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Acceso no autorizado: Token de sesión requerido.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Sesión expirada o token inválido.' });
    }
    req.user = user;
    next();
  });
}

export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: `Acceso restringido: requiere privilegios de ${role}.` });
    }
    next();
  };
}

export function authenticateBusinessOwnerOrDev(req, res, next) {
  authenticateToken(req, res, () => {
    const targetBusinessId = req.params.id || req.body?.businessId || req.query?.businessId;
    if (req.user.role === 'developer' || (req.user.role === 'business' && req.user.businessId === targetBusinessId)) {
      return next();
    }
    return res.status(403).json({ error: 'No tienes permisos para modificar este comercio.' });
  });
}

// --- GESTIÓN DE ARCHIVOS FÍSICOS Y FOTOS EN EL DISCO DURO DEL SERVIDOR (VPS) ---
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
function ensureDirExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
ensureDirExists(path.join(UPLOADS_DIR, 'businesses'));
ensureDirExists(path.join(UPLOADS_DIR, 'portfolio'));
ensureDirExists(path.join(UPLOADS_DIR, 'staff'));
ensureDirExists(path.join(UPLOADS_DIR, 'clients'));

/**
 * Guarda una imagen enviada en formato base64 directamente en el disco duro del VPS.
 * Retorna la URL pública relativa (/uploads/...) para guardar solo la ruta en Neon PostgreSQL.
 * Si ya es una URL (http, https, /uploads), la retorna intacta.
 */
function processAndSaveImage(dataStr, subfolder = 'general', prefix = 'img') {
  if (!dataStr || typeof dataStr !== 'string') return dataStr;
  
  const trimmed = dataStr.trim();
  if (!trimmed.startsWith('data:image/')) {
    return trimmed;
  }

  try {
    const matches = trimmed.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/s);
    if (!matches || matches.length < 3) {
      return trimmed;
    }

    let ext = matches[1].toLowerCase();
    if (ext === 'jpeg') ext = 'jpg';
    if (ext === 'svg+xml') ext = 'svg';
    if (!['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext)) {
      ext = 'jpg';
    }

    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    // Limpiar subcarpeta para URLs y rutas del sistema operativo
    const cleanSubfolder = String(subfolder).replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') || 'general';
    const cleanPrefix = (prefix || 'img').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `${cleanPrefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;

    const folderParts = cleanSubfolder.split('/');
    const targetDir = path.join(UPLOADS_DIR, ...folderParts);
    ensureDirExists(targetDir);

    const filePath = path.join(targetDir, fileName);
    fs.writeFileSync(filePath, buffer);

    const publicUrl = `/uploads/${cleanSubfolder}/${fileName}`;
    console.log(`📸 Foto guardada en disco VPS: ${publicUrl} (${(buffer.length / 1024).toFixed(1)} KB)`);
    return publicUrl;
  } catch (err) {
    console.error('Error guardando imagen en disco:', err);
    return dataStr;
  }
}

// Rutas directas para el Manual de Usuario de Comercios (PDF y Guía Web)
app.get([
  '/manual-comercios-pdf', 
  '/manual-comercios.pdf', 
  '/Manual_de_Usuario_Comercios_Reservas_CR.pdf', 
  '/public/Manual_de_Usuario_Comercios_Reservas_CR.pdf', 
  '/api/manual-pdf'
], (req, res) => {
  let pdfPath = path.join(__dirname, 'public', 'Manual_de_Usuario_Comercios_Reservas_CR.pdf');
  if (!fs.existsSync(pdfPath)) {
    pdfPath = path.join(__dirname, 'Manual_de_Usuario_Comercios_Reservas_CR.pdf');
  }
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="Manual_de_Usuario_Comercios_Reservas_CR.pdf"');
  res.sendFile(pdfPath);
});

app.get([
  '/manual-comercios', 
  '/manual-comercios-html', 
  '/manual-comercios.html', 
  '/manual_usuario_comercios.html', 
  '/public/manual_usuario_comercios.html'
], (req, res) => {
  let htmlPath = path.join(__dirname, 'public', 'manual_usuario_comercios.html');
  if (!fs.existsSync(htmlPath)) {
    htmlPath = path.join(__dirname, 'manual_usuario_comercios.html');
  }
  res.setHeader('Content-Type', 'text/html; charset=UTF-8');
  res.sendFile(htmlPath);
});

// Rutas directas para Landing B2B, Directorio, Pruebas y Paneles (SPA HTML5 History)
app.get([
  '/',
  '/unete', '/para-negocios', '/para-comercios', '/registro-negocio', '/negocios', '/hazte-socio',
  '/directorio', '/explorar', '/catalogo', '/buscar', '/comercios',
  '/pruebas', '/planes-prueba', '/test-planes', '/planes-test', '/demo-planes',
  '/mis-reservas', '/panel-negocio', '/developer'
], (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});


// Sitemap y Robots para Indexación en Google / Search Console
app.get(['/sitemap.xml', '/sitemap'], async (req, res) => {
  try {
    const sitemapPath = path.join(__dirname, 'public', 'sitemap.xml');
    res.header('Content-Type', 'application/xml');
    res.sendFile(sitemapPath);
  } catch (err) {
    console.error('Error sirviendo sitemap.xml:', err);
    res.status(500).send('Error generando sitemap');
  }
});

app.get('/robots.txt', (req, res) => {
  const robotsPath = path.join(__dirname, 'public', 'robots.txt');
  res.header('Content-Type', 'text/plain');
  res.sendFile(robotsPath);
});

// ==========================================
// CANAL REALTIME EN VIVO (SERVER-SENT EVENTS - SSE)
// ==========================================
const sseBusinessClients = new Map(); // businessId -> Set of express response objects

function broadcastBusinessSSE(businessId, eventType, data) {
  if (!businessId) return;
  const clients = sseBusinessClients.get(businessId);
  if (clients && clients.size > 0) {
    const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
    clients.forEach(clientRes => {
      try {
        clientRes.write(payload);
      } catch (e) {
        clients.delete(clientRes);
      }
    });
    console.log(`⚡ [Realtime SSE] Notificación '${eventType}' enviada en vivo a ${clients.size} sesión(es) del negocio ${businessId}.`);
  }
}

// Endpoint de conexión SSE para pantalla de comercio
app.get('/api/realtime/stream', (req, res) => {
  const { businessId } = req.query;
  if (!businessId) {
    return res.status(400).json({ error: 'Falta businessId para conectar el canal en tiempo real.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  if (!sseBusinessClients.has(businessId)) {
    sseBusinessClients.set(businessId, new Set());
  }
  sseBusinessClients.get(businessId).add(res);

  // Handshake inicial
  res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', businessId, timestamp: new Date().toISOString() })}\n\n`);

  // Mantener viva la conexión con ping cada 20 segundos
  const keepAliveInterval = setInterval(() => {
    try {
      res.write(': keep-alive\n\n');
    } catch (err) {
      clearInterval(keepAliveInterval);
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(keepAliveInterval);
    const clients = sseBusinessClients.get(businessId);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) {
        sseBusinessClients.delete(businessId);
      }
    }
  });
});

// Helper global para convertir horarios ("10:30 AM", "14:00", etc.) a minutos del día
export function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  let str = String(timeStr).trim().toUpperCase();
  const isPM = str.includes('PM');
  const isAM = str.includes('AM');
  str = str.replace(/[APM\s]/g, '');
  const parts = str.split(':');
  let h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  if (isPM && h < 12) h += 12;
  if (isAM && h === 12) h = 0;
  return h * 60 + m;
}

// ==========================================
// SEGURIDAD: CONTROL DE INTENTOS FALLIDOS Y RATE LIMITING DE LOGIN
// ==========================================
const loginAttempts = new Map(); // key: ip + identifier -> { count: number, blockedUntil: timestamp, lastAttempt: timestamp }
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_BLOCK_DURATION_MS = 5 * 60 * 1000; // 5 minutos de bloqueo

function getClientIp(req) {
  const forwarded = req.headers['cf-connecting-ip'] || 
                    (req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0].trim() : null) || 
                    req.ip || 
                    req.connection?.remoteAddress || 
                    'unknown';
  return String(forwarded).replace(/^::ffff:/, '');
}

function checkLoginRateLimit(req, identifier) {
  const ip = getClientIp(req);
  const now = Date.now();
  const cleanId = (identifier || '').trim().toLowerCase();
  const key = `${ip}_${cleanId}`;

  // Verificar bloqueo por combinación IP+usuario o solo por IP
  const record = loginAttempts.get(key) || loginAttempts.get(`ip_${ip}`);
  if (record && record.blockedUntil && record.blockedUntil > now) {
    return {
      blocked: true,
      message: 'Demasiados intentos. Inténtalo más tarde.'
    };
  }

  // Si el tiempo de bloqueo ya expiró, limpiar el bloqueo
  if (record && record.blockedUntil && record.blockedUntil <= now) {
    loginAttempts.delete(key);
    loginAttempts.delete(`ip_${ip}`);
  }

  return { blocked: false };
}

function recordFailedLoginAttempt(req, identifier) {
  const ip = getClientIp(req);
  const now = Date.now();
  const cleanId = (identifier || '').trim().toLowerCase();
  const key = `${ip}_${cleanId}`;

  let record = loginAttempts.get(key) || { count: 0, blockedUntil: 0, lastAttempt: now };
  record.count += 1;
  record.lastAttempt = now;

  if (record.count >= MAX_LOGIN_ATTEMPTS) {
    record.blockedUntil = now + LOGIN_BLOCK_DURATION_MS;
    loginAttempts.set(key, record);
    loginAttempts.set(`ip_${ip}`, record);
    return {
      blocked: true,
      message: 'Demasiados intentos. Inténtalo más tarde.'
    };
  }

  loginAttempts.set(key, record);

  const remaining = MAX_LOGIN_ATTEMPTS - record.count;
  if (remaining === 2) {
    return {
      blocked: false,
      message: 'Contraseña incorrecta. Te quedan 2 intentos restantes.'
    };
  } else if (remaining === 1) {
    return {
      blocked: false,
      message: 'Contraseña incorrecta. Te queda 1 intento restante.'
    };
  }

  return {
    blocked: false,
    message: 'Credenciales inválidas. Verifica tu correo/teléfono y contraseña.'
  };
}

function recordSuccessfulLogin(req, identifier) {
  const ip = getClientIp(req);
  const cleanId = (identifier || '').trim().toLowerCase();
  const key = `${ip}_${cleanId}`;
  loginAttempts.delete(key);
  loginAttempts.delete(`ip_${ip}`);
}

// Limpieza periódica de registros viejos de intentos fallidos cada 15 minutos
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of loginAttempts.entries()) {
    if (now - v.lastAttempt > 30 * 60 * 1000 && (!v.blockedUntil || v.blockedUntil <= now)) {
      loginAttempts.delete(k);
    }
  }
}, 15 * 60 * 1000);

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

    // Verificación de Rate Limit
    const rateCheck = checkLoginRateLimit(req, cleanEmail);
    if (rateCheck.blocked) {
      return res.status(429).json({ error: rateCheck.message });
    }

    // 1. Consulta segura a base de datos para Developer
    const devRes = await pool.query(
      'SELECT * FROM reservas_developer_users WHERE LOWER(email) = LOWER($1)',
      [cleanEmail]
    );

    if (devRes.rows.length === 0) {
      const failInfo = recordFailedLoginAttempt(req, cleanEmail);
      return res.status(failInfo.blocked ? 429 : 401).json({ error: failInfo.message });
    }

    const dev = devRes.rows[0];
    const isValidDev = await verifyPassword(cleanPass, dev.password);
    if (!isValidDev) {
      const failInfo = recordFailedLoginAttempt(req, cleanEmail);
      return res.status(failInfo.blocked ? 429 : 401).json({ error: failInfo.message });
    }

    // Si la contraseña aún estaba en texto plano, migrarla a bcrypt hash automáticamente
    if (!dev.password.startsWith('$2a$') && !dev.password.startsWith('$2b$')) {
      const newHash = await hashPassword(cleanPass);
      await pool.query('UPDATE reservas_developer_users SET password = $1 WHERE id = $2', [newHash, dev.id]);
    }

    recordSuccessfulLogin(req, cleanEmail);
    const token = generateToken({
      id: dev.id,
      name: dev.name,
      email: dev.email,
      role: 'developer'
    });

    res.json({
      success: true,
      role: 'developer',
      token,
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

    // Verificación de Rate Limit
    const rateCheck = checkLoginRateLimit(req, cleanEmail);
    if (rateCheck.blocked) {
      return res.status(429).json({ error: rateCheck.message });
    }

    // 1. Comprobar si existe en tabla de Developer
    try {
      const devRes = await pool.query(
        'SELECT * FROM reservas_developer_users WHERE LOWER(email) = LOWER($1)',
        [cleanEmail]
      );

      if (devRes.rows.length > 0) {
        const dev = devRes.rows[0];
        const isValidDev = await verifyPassword(cleanPass, dev.password);
        if (isValidDev) {
          if (!dev.password.startsWith('$2a$') && !dev.password.startsWith('$2b$')) {
            const newHash = await hashPassword(cleanPass);
            await pool.query('UPDATE reservas_developer_users SET password = $1 WHERE id = $2', [newHash, dev.id]);
          }
          recordSuccessfulLogin(req, cleanEmail);
          const token = generateToken({
            id: dev.id,
            name: dev.name,
            email: dev.email,
            role: 'developer'
          });
          return res.json({
            success: true,
            role: 'developer',
            token,
            user: {
              id: dev.id,
              name: dev.name,
              email: dev.email,
              role: 'developer'
            }
          });
        }
      }
    } catch (e) {
      console.warn('Developer check in business login:', e.message);
    }

    // 2. Comprobar si es Usuario de Negocio
    const userRes = await pool.query(
      'SELECT * FROM reservas_business_users WHERE LOWER(email) = LOWER($1)',
      [cleanEmail]
    );

    if (userRes.rows.length > 0) {
      const user = userRes.rows[0];
      const isValid = await verifyPassword(cleanPass, user.password);
      if (isValid) {
        if (!user.password.startsWith('$2a$') && !user.password.startsWith('$2b$')) {
          const newHash = await hashPassword(cleanPass);
          await pool.query('UPDATE reservas_business_users SET password = $1 WHERE id = $2', [newHash, user.id]);
        }
        const bizRes = await pool.query('SELECT * FROM reservas_businesses WHERE id = $1', [user.business_id]);
        const business = bizRes.rows[0] || null;

        recordSuccessfulLogin(req, cleanEmail);
        const token = generateToken({
          id: user.id,
          name: user.name,
          email: user.email,
          role: 'business',
          businessId: user.business_id
        });

        return res.json({
          success: true,
          role: 'business',
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            businessId: user.business_id
          },
          business
        });
      }
    }

    // 3. Si ingresó credenciales de Cliente aquí por error, autenticarlo como cliente
    const clientRes = await pool.query(
      'SELECT * FROM reservas_clients WHERE LOWER(email) = LOWER($1) OR phone = $1',
      [cleanEmail]
    );

    if (clientRes.rows.length > 0) {
      const clientRow = clientRes.rows[0];
      const isValidClient = await verifyPassword(cleanPass, clientRow.password);
      if (isValidClient) {
        if (clientRow.password && !clientRow.password.startsWith('$2a$') && !clientRow.password.startsWith('$2b$')) {
          const newHash = await hashPassword(cleanPass);
          await pool.query('UPDATE reservas_clients SET password = $1 WHERE id = $2', [newHash, clientRow.id]);
        }
        recordSuccessfulLogin(req, cleanEmail);
        const token = generateToken({
          id: clientRow.id,
          name: clientRow.name,
          phone: clientRow.phone,
          email: clientRow.email,
          role: 'client'
        });

        return res.json({
          success: true,
          role: 'client',
          token,
          client: {
            id: clientRow.id,
            name: clientRow.name,
            phone: clientRow.phone,
            email: clientRow.email || ''
          }
        });
      }
    }

    const failInfo = recordFailedLoginAttempt(req, cleanEmail);
    return res.status(failInfo.blocked ? 429 : 401).json({ error: failInfo.message });
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

    const planId = business.plan || 'free';
    const planPriceUsd = planId === 'free' ? 0 : (planId === 'unlimited' ? 35 : (planId === 'basic' ? 10 : 18));
    const bookingLimit = planId === 'free' ? 25 : (planId === 'unlimited' ? 600 : (planId === 'basic' ? 150 : 300));
    const subStatus = planId === 'free' ? 'active' : (business.subscriptionStatus || 'pending_payment');
    const payMethod = planId === 'free' ? 'free' : (business.paymentMethod || 'sinpe_movil');
    const socialLinks = business.socialLinks || business.social_links || {};
    const autoConfirm = business.autoConfirmAppointments !== undefined ? Boolean(business.autoConfirmAppointments) : true;

    // Insertar negocio
    await pool.query(`
      INSERT INTO reservas_businesses (
        id, name, category, category_label, rating, reviews_count,
        price_range, address, city, phone, email, description,
        image, cover_image, schedule, features, is_demo,
        plan, plan_price_usd, monthly_booking_limit, social_links,
        auto_confirm_appointments, subscription_status, payment_method
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
    `, [
      newBizId, business.name, business.category, business.categoryLabel || 'Servicios',
      5.0, 0, business.priceRange || '₡₡',
      business.address || '', business.city || '', business.phone || '', email.trim(),
      business.description || '', business.image || '', business.coverImage || '',
      JSON.stringify(schedule), JSON.stringify(features), false,
      planId, planPriceUsd, bookingLimit, JSON.stringify(socialLinks),
      autoConfirm, subStatus, payMethod
    ]);

    // Si es una categoría personalizada, registrar alerta para el Developer
    if (business.isCustomCategory || business.is_custom || business.category === 'otra') {
      const alertId = `alert-${Date.now()}`;
      await pool.query(`
        INSERT INTO reservas_custom_category_alerts (id, business_id, business_name, category_id, category_name, status)
        VALUES ($1, $2, $3, $4, $5, 'unread')
      `, [alertId, newBizId, business.name, business.category, business.categoryLabel || business.category]);
    }

    // Insertar usuario del negocio con contraseña hasheada
    const hashedPassword = await hashPassword(password.trim());
    await pool.query(`
      INSERT INTO reservas_business_users (id, business_id, name, email, password)
      VALUES ($1, $2, $3, $4, $5)
    `, [newUserId, newBizId, ownerName || business.name, email.trim(), hashedPassword]);

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

    const token = generateToken({
      id: newUserId,
      name: ownerName || business.name,
      email: email.trim(),
      role: 'business',
      businessId: newBizId
    });

    res.status(201).json({
      success: true,
      role: 'business',
      token,
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
    if (!name || !phone || !email || !password) {
      return res.status(400).json({ error: 'Nombre, Teléfono, Correo Electrónico y Contraseña son obligatorios.' });
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
    const hashedPassword = await hashPassword(password.trim());
    await pool.query(`
      INSERT INTO reservas_clients (id, name, phone, email, password, whatsapp_opt_in)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [newClientId, name.trim(), phone.trim(), (email || '').trim(), hashedPassword, Boolean(whatsappOptIn)]);

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

    const token = generateToken({
      id: newClientId,
      name: name.trim(),
      phone: phone.trim(),
      email: (email || '').trim(),
      role: 'client'
    });

    res.json({ success: true, token, client: clientUser });
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

    // Verificación de Rate Limit
    const rateCheck = checkLoginRateLimit(req, cleanIdent);
    if (rateCheck.blocked) {
      return res.status(429).json({ error: rateCheck.message });
    }

    // 1. Comprobar si es Developer
    try {
      const devRes = await pool.query(
        'SELECT * FROM reservas_developer_users WHERE LOWER(email) = LOWER($1)',
        [cleanIdent]
      );

      if (devRes.rows.length > 0) {
        const dev = devRes.rows[0];
        const isValidDev = await verifyPassword(cleanPass, dev.password);
        if (isValidDev) {
          if (!dev.password.startsWith('$2a$') && !dev.password.startsWith('$2b$')) {
            const newHash = await hashPassword(cleanPass);
            await pool.query('UPDATE reservas_developer_users SET password = $1 WHERE id = $2', [newHash, dev.id]);
          }
          recordSuccessfulLogin(req, cleanIdent);
          const token = generateToken({
            id: dev.id,
            name: dev.name,
            email: dev.email,
            role: 'developer'
          });
          return res.json({
            success: true,
            role: 'developer',
            token,
            user: {
              id: dev.id,
              name: dev.name,
              email: dev.email,
              role: 'developer'
            }
          });
        }
      }
    } catch (e) {
      console.warn('Developer check in client login:', e.message);
    }

    // 2. Comprobar si es Usuario de Negocio (por si el dueño se loguea desde la pestaña de cliente)
    const bizUserRes = await pool.query(
      'SELECT * FROM reservas_business_users WHERE LOWER(email) = LOWER($1)',
      [cleanIdent]
    );

    if (bizUserRes.rows.length > 0) {
      const user = bizUserRes.rows[0];
      const isValidBiz = await verifyPassword(cleanPass, user.password);
      if (isValidBiz) {
        if (!user.password.startsWith('$2a$') && !user.password.startsWith('$2b$')) {
          const newHash = await hashPassword(cleanPass);
          await pool.query('UPDATE reservas_business_users SET password = $1 WHERE id = $2', [newHash, user.id]);
        }
        const bizRes = await pool.query('SELECT * FROM reservas_businesses WHERE id = $1', [user.business_id]);
        const business = bizRes.rows[0] || null;

        recordSuccessfulLogin(req, cleanIdent);
        const token = generateToken({
          id: user.id,
          name: user.name,
          email: user.email,
          role: 'business',
          businessId: user.business_id
        });
        return res.json({
          success: true,
          role: 'business',
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            businessId: user.business_id
          },
          business
        });
      }
    }

    // 3. Comprobar si es Cliente
    const identDigits = cleanIdent.replace(/[^0-9]/g, '').slice(-8);
    let result;
    if (identDigits.length === 8) {
      result = await pool.query(
        `SELECT * FROM reservas_clients 
         WHERE LOWER(email) = LOWER($1) 
            OR RIGHT(regexp_replace(phone, '[^0-9]', '', 'g'), 8) = $2 
            OR phone = $1 
         ORDER BY (password IS NOT NULL) DESC, created_at DESC`,
        [cleanIdent, identDigits]
      );
    } else {
      result = await pool.query(
        `SELECT * FROM reservas_clients WHERE LOWER(email) = LOWER($1) OR phone = $1 ORDER BY (password IS NOT NULL) DESC, created_at DESC`,
        [cleanIdent]
      );
    }

    if (result.rows.length === 0) {
      const failInfo = recordFailedLoginAttempt(req, cleanIdent);
      return res.status(failInfo.blocked ? 429 : 401).json({ error: failInfo.message });
    }

    const clientRow = result.rows[0];
    if (clientRow.password) {
      const isValid = await verifyPassword(cleanPass, clientRow.password);
      if (!isValid) {
        const failInfo = recordFailedLoginAttempt(req, cleanIdent);
        return res.status(failInfo.blocked ? 429 : 401).json({ error: failInfo.message });
      }
      // Si la contraseña estaba en texto plano, migrarla al vuelo
      if (!clientRow.password.startsWith('$2a$') && !clientRow.password.startsWith('$2b$')) {
        const newHash = await hashPassword(cleanPass);
        await pool.query('UPDATE reservas_clients SET password = $1 WHERE id = $2', [newHash, clientRow.id]);
      }
    } else {
      // Si no tenía contraseña guardada previamente, se le asigna hasheada
      const newHash = await hashPassword(cleanPass);
      await pool.query('UPDATE reservas_clients SET password = $1 WHERE id = $2', [newHash, clientRow.id]);
    }

    recordSuccessfulLogin(req, cleanIdent);

    const token = generateToken({
      id: clientRow.id,
      name: clientRow.name,
      phone: clientRow.phone,
      email: clientRow.email || '',
      role: 'client'
    });

    res.json({
      success: true,
      role: 'client',
      token,
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
    const cleanName = (name || '').trim();
    const cleanPhone = (phone || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!cleanName || !cleanPhone) {
      return res.status(400).json({ error: 'Nombre y Teléfono son requeridos.' });
    }

    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      return res.status(400).json({ error: 'El Correo Electrónico es obligatorio y debe tener un formato válido.' });
    }

    // Buscar si ya existe por teléfono o correo
    const phoneDigits = cleanPhone.replace(/[^0-9]/g, '').slice(-8);
    let existing;
    if (phoneDigits.length === 8) {
      existing = await pool.query(
        `SELECT * FROM reservas_clients 
         WHERE (email != '' AND LOWER(email) = LOWER($1)) 
            OR RIGHT(regexp_replace(phone, '[^0-9]', '', 'g'), 8) = $2 
            OR phone = $3 
         ORDER BY (password IS NOT NULL) DESC, created_at DESC LIMIT 1`,
        [cleanEmail, phoneDigits, cleanPhone]
      );
    } else {
      existing = await pool.query(
        'SELECT * FROM reservas_clients WHERE phone = $1 OR (email != \'\' AND LOWER(email) = LOWER($2)) ORDER BY (password IS NOT NULL) DESC, created_at DESC LIMIT 1',
        [cleanPhone, cleanEmail]
      );
    }

    let clientUser;
    if (existing.rows.length > 0) {
      clientUser = existing.rows[0];
      await pool.query(
        'UPDATE reservas_clients SET name = $1, phone = $2, email = $3, whatsapp_opt_in = COALESCE($4, whatsapp_opt_in) WHERE id = $5',
        [cleanName, cleanPhone, cleanEmail, Boolean(whatsappOptIn), clientUser.id]
      );
      clientUser.name = cleanName;
      clientUser.phone = cleanPhone;
      clientUser.email = cleanEmail;
      clientUser.whatsappOptIn = Boolean(whatsappOptIn);
    } else {
      const newClientId = `cli-${Date.now()}`;
      await pool.query(`
        INSERT INTO reservas_clients (id, name, phone, email, whatsapp_opt_in)
        VALUES ($1, $2, $3, $4, $5)
      `, [newClientId, cleanName, cleanPhone, cleanEmail, Boolean(whatsappOptIn)]);

      clientUser = {
        id: newClientId,
        name: cleanName,
        phone: cleanPhone,
        email: cleanEmail,
        whatsappOptIn: Boolean(whatsappOptIn)
      };

      // Notificación por correo al Administrador (pampo32@gmail.com)
      sendAdminClientRegistrationNotificationEmail(clientUser).catch(err => {
        console.error('⚠️ Error no bloqueante enviando correo de nuevo cliente al admin:', err.message);
      });
    }

    const token = generateToken({
      id: clientUser.id,
      name: clientUser.name,
      phone: clientUser.phone,
      email: clientUser.email || '',
      role: 'client'
    });

    res.json({ success: true, token, client: clientUser });
  } catch (error) {
    console.error('Error en login/registro cliente:', error);
    res.status(500).json({ error: 'Error al procesar acceso de cliente.' });
  }
});

// 5.1 Actualizar Perfil de Cliente / Usuario Final
app.put('/api/client/profile/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, password, whatsappOptIn } = req.body;

    const cleanEmail = email ? email.trim().toLowerCase() : null;
    let updateQuery = `
      UPDATE reservas_clients SET
        name = COALESCE($1, name),
        phone = COALESCE($2, phone),
        email = COALESCE($3, email),
        whatsapp_opt_in = COALESCE($4, whatsapp_opt_in)
    `;
    const params = [
      name ? name.trim() : null,
      phone ? phone.trim() : null,
      cleanEmail,
      whatsappOptIn !== undefined ? Boolean(whatsappOptIn) : null
    ];

    if (password && password.trim()) {
      const hashedPassword = await hashPassword(password.trim());
      updateQuery += `, password = $5 WHERE (id = $6 OR (email != '' AND LOWER(email) = LOWER($7))) RETURNING *`;
      params.push(hashedPassword, id, cleanEmail || id);
    } else {
      updateQuery += ` WHERE (id = $5 OR (email != '' AND LOWER(email) = LOWER($6))) RETURNING *`;
      params.push(id, cleanEmail || id);
    }

    const result = await pool.query(updateQuery, params);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const updated = result.rows[0];
    res.json({
      success: true,
      user: {
        id: updated.id,
        name: updated.name,
        phone: updated.phone || '',
        email: updated.email || '',
        whatsappOptIn: updated.whatsapp_opt_in !== false,
        role: 'client'
      }
    });
  } catch (error) {
    console.error('Error actualizando perfil de cliente:', error);
    res.status(500).json({ error: error.message || 'Error al actualizar perfil.' });
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

    // 2. Actualizar contraseña en la tabla correspondiente con hash seguro
    const hashedPassword = await hashPassword(cleanPass);
    let updated = false;

    if (resetRecord.user_type === 'business') {
      const uRes = await pool.query(
        'UPDATE reservas_business_users SET password = $1 WHERE LOWER(email) = LOWER($2)',
        [hashedPassword, cleanEmail]
      );
      if (uRes.rowCount > 0) updated = true;
    } else {
      const uRes = await pool.query(
        'UPDATE reservas_clients SET password = $1 WHERE LOWER(email) = LOWER($2)',
        [hashedPassword, cleanEmail]
      );
      if (uRes.rowCount > 0) updated = true;
    }

    // Fallback: Si no se actualizó por tipo, intentar actualizar en ambas
    if (!updated) {
      await pool.query('UPDATE reservas_business_users SET password = $1 WHERE LOWER(email) = LOWER($2)', [hashedPassword, cleanEmail]);
      await pool.query('UPDATE reservas_clients SET password = $1 WHERE LOWER(email) = LOWER($2)', [hashedPassword, cleanEmail]);
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
    const { businessName, contactName, phone, email = '', category, city, planInterest = 'pro', notes = '' } = req.body;
    if (!businessName || !phone || !contactName) {
      return res.status(400).json({ error: 'Nombre del negocio, persona de contacto y número de WhatsApp son obligatorios.' });
    }

    const id = `prereg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const cleanBizName = (businessName || '').trim();
    const cleanContact = (contactName || '').trim();
    const cleanPhone = (phone || '').trim();
    const cleanEmail = (email || '').trim();
    const cleanCat = (category || 'Servicios Generales').trim();
    const cleanCity = (city || '').trim();
    const cleanPlan = (planInterest || 'pro').trim();
    const cleanNotes = (notes || '').trim();

    await pool.query(`
      INSERT INTO reservas_pre_registrations (id, business_name, contact_name, phone, email, category, city, plan_interest, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [id, cleanBizName, cleanContact, cleanPhone, cleanEmail, cleanCat, cleanCity, cleanPlan, cleanNotes]);

    // Notificación por correo al Administrador (pampo32@gmail.com)
    sendAdminPreRegistrationNotificationEmail({
      businessName: cleanBizName,
      contactName: cleanContact,
      phone: cleanPhone,
      email: cleanEmail,
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
        email: cleanEmail,
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
      email: r.email || '',
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

// ==========================================
// CONTROL DE ACCESO GLOBAL PARA DEVELOPER PANEL
// ==========================================
app.use('/api/developer', authenticateToken, requireRole('developer'));

// Actualizar Pre-registro desde Developer Panel
app.put('/api/developer/pre-registrations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { businessName, contactName, phone, email, category, city, planInterest, notes, status, isBlocked, blockReason } = req.body;

    await pool.query(`
      UPDATE reservas_pre_registrations SET
        business_name = COALESCE($1, business_name),
        contact_name = COALESCE($2, contact_name),
        phone = COALESCE($3, phone),
        email = COALESCE($4, email),
        category = COALESCE($5, category),
        city = COALESCE($6, city),
        plan_interest = COALESCE($7, plan_interest),
        notes = COALESCE($8, notes),
        status = COALESCE($9, status),
        is_blocked = COALESCE($10, is_blocked),
        block_reason = COALESCE($11, block_reason)
      WHERE id = $12
    `, [
      businessName !== undefined ? businessName.trim() : null,
      contactName !== undefined ? contactName.trim() : null,
      phone !== undefined ? phone.trim() : null,
      email !== undefined ? email.trim() : null,
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
      whatsappOptIn: a.whatsapp_opt_in !== false,
      createdAt: a.created_at
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
      slug: b.slug || slugify(b.name || b.id),
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
      portfolio: Array.isArray(b.portfolio) ? b.portfolio : (typeof b.portfolio === 'string' ? JSON.parse(b.portfolio || '[]') : []),
      isDemo: Boolean(b.is_demo),
      isHidden: Boolean(b.is_hidden),
      isBlocked: Boolean(b.is_blocked),
      blockReason: b.block_reason || '',
      isVerified: Boolean(b.is_verified),
      plan: b.plan || 'basic',
      planPriceUsd: (b.plan_price_usd !== null && b.plan_price_usd !== undefined) ? parseFloat(b.plan_price_usd) : (b.plan === 'free' ? 0 : (b.plan === 'unlimited' ? 35 : (b.plan === 'pro' ? 18 : 10))),
      monthlyBookingLimit: b.plan === 'unlimited' ? ((b.monthly_booking_limit && parseInt(b.monthly_booking_limit, 10) > 600) ? parseInt(b.monthly_booking_limit, 10) : 600) : (b.plan === 'free' ? 25 : (b.plan === 'pro' ? ((b.monthly_booking_limit && parseInt(b.monthly_booking_limit, 10) > 300) ? parseInt(b.monthly_booking_limit, 10) : 300) : (b.monthly_booking_limit !== null && b.monthly_booking_limit !== undefined ? parseInt(b.monthly_booking_limit, 10) : 150))),
      extraWhatsappCredits: parseInt(b.extra_whatsapp_credits || 0, 10),
      notifyOwnerWhatsapp: Boolean(b.notify_owner_whatsapp),
      socialLinks: b.social_links || {},
      autoConfirmAppointments: b.auto_confirm_appointments !== false,
      subscriptionStatus: b.subscription_status,
      paymentMethod: b.payment_method,
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

// Endpoint explícito para el Developer Dashboard
app.get('/api/developer/businesses', async (req, res) => {
  try {
    const bizRes = await pool.query(`
      SELECT * FROM reservas_businesses 
      ORDER BY is_demo DESC, created_at ASC
    `);
    const srvRes = await pool.query('SELECT * FROM reservas_services ORDER BY created_at ASC');

    const businesses = bizRes.rows.map(b => ({
      id: b.id,
      name: b.name,
      slug: b.slug || slugify(b.name || b.id),
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
      portfolio: Array.isArray(b.portfolio) ? b.portfolio : (typeof b.portfolio === 'string' ? JSON.parse(b.portfolio || '[]') : []),
      isDemo: Boolean(b.is_demo),
      isHidden: Boolean(b.is_hidden),
      isBlocked: Boolean(b.is_blocked),
      blockReason: b.block_reason || '',
      isVerified: Boolean(b.is_verified),
      plan: b.plan || 'basic',
      planPriceUsd: (b.plan_price_usd !== null && b.plan_price_usd !== undefined) ? parseFloat(b.plan_price_usd) : (b.plan === 'free' ? 0 : (b.plan === 'unlimited' ? 35 : (b.plan === 'pro' ? 18 : 10))),
      monthlyBookingLimit: b.plan === 'unlimited' ? ((b.monthly_booking_limit && parseInt(b.monthly_booking_limit, 10) > 600) ? parseInt(b.monthly_booking_limit, 10) : 600) : (b.plan === 'free' ? 25 : (b.plan === 'pro' ? ((b.monthly_booking_limit && parseInt(b.monthly_booking_limit, 10) > 300) ? parseInt(b.monthly_booking_limit, 10) : 300) : (b.monthly_booking_limit !== null && b.monthly_booking_limit !== undefined ? parseInt(b.monthly_booking_limit, 10) : 150))),
      extraWhatsappCredits: parseInt(b.extra_whatsapp_credits || 0, 10),
      notifyOwnerWhatsapp: Boolean(b.notify_owner_whatsapp),
      socialLinks: b.social_links || {},
      autoConfirmAppointments: b.auto_confirm_appointments !== false,
      subscriptionStatus: b.subscription_status,
      paymentMethod: b.payment_method,
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
    console.error('Error en GET /api/developer/businesses:', error);
    res.status(500).json({ error: 'Error al consultar negocios para developer' });
  }
});

// Obtener un negocio por ID o por Slug
app.get('/api/businesses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const cleanLookup = String(id || '').trim().toLowerCase();
    const bizRes = await pool.query('SELECT * FROM reservas_businesses WHERE id = $1 OR LOWER(slug) = $2', [id, cleanLookup]);
    if (bizRes.rows.length === 0) {
      return res.status(404).json({ error: 'Negocio no encontrado' });
    }

    const b = bizRes.rows[0];
    const srvRes = await pool.query('SELECT * FROM reservas_services WHERE business_id = $1 ORDER BY created_at ASC', [b.id]);

    const business = {
      id: b.id,
      name: b.name,
      slug: b.slug || slugify(b.name || b.id),
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
      portfolio: Array.isArray(b.portfolio) ? b.portfolio : (typeof b.portfolio === 'string' ? JSON.parse(b.portfolio || '[]') : []),
      isDemo: Boolean(b.is_demo),
      isHidden: Boolean(b.is_hidden),
      isBlocked: Boolean(b.is_blocked),
      blockReason: b.block_reason || '',
      isVerified: Boolean(b.is_verified),
      plan: b.plan || 'basic',
      planPriceUsd: (b.plan_price_usd !== null && b.plan_price_usd !== undefined) ? parseFloat(b.plan_price_usd) : (b.plan === 'free' ? 0 : (b.plan === 'unlimited' ? 35 : (b.plan === 'pro' ? 18 : 10))),
      monthlyBookingLimit: b.plan === 'unlimited' ? ((b.monthly_booking_limit && parseInt(b.monthly_booking_limit, 10) > 600) ? parseInt(b.monthly_booking_limit, 10) : 600) : (b.plan === 'free' ? 25 : (b.plan === 'pro' ? ((b.monthly_booking_limit && parseInt(b.monthly_booking_limit, 10) > 300) ? parseInt(b.monthly_booking_limit, 10) : 300) : (b.monthly_booking_limit !== null && b.monthly_booking_limit !== undefined ? parseInt(b.monthly_booking_limit, 10) : 150))),
      extraWhatsappCredits: parseInt(b.extra_whatsapp_credits || 0, 10),
      notifyOwnerWhatsapp: Boolean(b.notify_owner_whatsapp),
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
app.put('/api/businesses/:id/plan', authenticateBusinessOwnerOrDev, async (req, res) => {
  try {
    const { id } = req.params;
    const { plan, planPriceUsd, monthlyBookingLimit } = req.body;
    
    let priceUsd = 0;
    let limit = 25;
    if (plan === 'unlimited') {
      priceUsd = 35;
      limit = 600;
    } else if (plan === 'pro') {
      priceUsd = 18;
      limit = 300;
    } else if (plan === 'basic') {
      priceUsd = 10;
      limit = 150;
    } else if (plan === 'free') {
      priceUsd = 0;
      limit = 25;
    }

    const finalPrice = (planPriceUsd !== undefined && planPriceUsd !== null) ? parseFloat(planPriceUsd) : priceUsd;
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

// Recargar créditos / mensajes adicionales de WhatsApp (Add-ons)
app.put('/api/businesses/:id/whatsapp-credits', authenticateBusinessOwnerOrDev, async (req, res) => {
  try {
    const { id } = req.params;
    const { credits } = req.body;
    const added = parseInt(credits, 10) || 0;
    if (added <= 0) return res.status(400).json({ error: 'Créditos de recarga inválidos.' });

    const r = await pool.query(`
      UPDATE reservas_businesses 
      SET extra_whatsapp_credits = COALESCE(extra_whatsapp_credits, 0) + $1 
      WHERE id = $2 
      RETURNING id, name, extra_whatsapp_credits
    `, [added, id]);

    if (r.rowCount === 0) return res.status(404).json({ error: 'Negocio no encontrado.' });
    console.log(`🎁 [WhatsApp Pack] Negocio ${r.rows[0].name} (${id}) recargó ${added} créditos de WhatsApp. Saldo: ${r.rows[0].extra_whatsapp_credits}`);
    res.json({ success: true, businessId: id, extraWhatsappCredits: r.rows[0].extra_whatsapp_credits });
  } catch (error) {
    console.error('Error al recargar créditos de WhatsApp:', error);
    res.status(500).json({ error: 'Error al recargar créditos de WhatsApp.' });
  }
});

// Actualizar negocio completo (Modificar datos, incluyendo slug)
app.put('/api/businesses/:id', authenticateBusinessOwnerOrDev, async (req, res) => {
  try {
    const { id } = req.params;
    const b = req.body;
    const finalPhone = b.phone !== undefined ? String(b.phone).trim() : (b.whatsapp !== undefined ? String(b.whatsapp).trim() : null);
    const rawSlug = b.slug !== undefined ? slugify(b.slug) : (b.name ? slugify(b.name) : null);

    // Validar si el slug nuevo ya está en uso por otro negocio
    if (rawSlug) {
      const existingSlugCheck = await pool.query(
        'SELECT id, name FROM reservas_businesses WHERE LOWER(slug) = LOWER($1) AND id != $2 LIMIT 1',
        [rawSlug, id]
      );
      if (existingSlugCheck.rows.length > 0) {
        const fallbackSuggestion = `${rawSlug}-${slugify(b.city || 'cr')}`;
        return res.status(409).json({ 
          error: `Este enlace ya está en uso por otro negocio. Prueba con otro (por ejemplo agregando tu zona, cantón o provincia como '${fallbackSuggestion}').` 
        });
      }
    }

    // Procesar imágenes Base64 y guardarlas físicamente en la carpeta de este comercio
    const bizFolder = `comercios/${id}`;
    if (b.image) {
      b.image = processAndSaveImage(b.image, bizFolder, 'logo');
    }
    if (b.coverImage) {
      b.coverImage = processAndSaveImage(b.coverImage, bizFolder, 'portada');
    }
    if (Array.isArray(b.portfolio)) {
      b.portfolio = b.portfolio.map((item, idx) => {
        if (typeof item === 'string') {
          return processAndSaveImage(item, `${bizFolder}/portafolio`, `port_${idx}`);
        }
        if (item && item.url) {
          return {
            ...item,
            url: processAndSaveImage(item.url, `${bizFolder}/portafolio`, `port_${idx}`)
          };
        }
        return item;
      });
    }

    const updateRes = await pool.query(`
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
        is_hidden = COALESCE($19, is_hidden),
        is_verified = COALESCE($20, is_verified),
        slug = COALESCE($21, slug),
        portfolio = COALESCE($22, portfolio)
      WHERE id = $23 OR LOWER(slug) = LOWER($23)
      RETURNING *
    `, [
      b.name !== undefined ? b.name : null,
      b.category !== undefined ? b.category : null,
      b.categoryLabel !== undefined ? b.categoryLabel : null,
      b.city !== undefined ? b.city : null,
      b.address !== undefined ? b.address : null,
      finalPhone,
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
      b.isVerified !== undefined ? Boolean(b.isVerified) : null,
      rawSlug,
      b.portfolio ? JSON.stringify(b.portfolio) : null,
      id
    ]);

    if (updateRes.rowCount === 0) {
      // Upsert: si no existía el registro, crearlo directamente en PostgreSQL
      const newSlug = rawSlug || slugify(b.name || id);
      await pool.query(`
        INSERT INTO reservas_businesses (
          id, name, slug, category, category_label, city, address, phone, email, description,
          image, cover_image, price_range, features, schedule, social_links,
          auto_confirm_appointments, plan, is_blocked, block_reason, is_hidden, is_verified,
          portfolio, rating, reviews_count, is_demo, subscription_status, payment_method
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22,
          $23, 5.0, 0, false, 'active', 'free'
        )
      `, [
        id,
        b.name || 'Negocio',
        newSlug,
        b.category || 'servicios',
        b.categoryLabel || 'Servicios',
        b.city || '',
        b.address || '',
        finalPhone || '',
        b.email || '',
        b.description || '',
        b.image || '',
        b.coverImage || '',
        b.priceRange || '₡₡',
        b.features ? JSON.stringify(b.features) : JSON.stringify([]),
        b.schedule ? JSON.stringify(b.schedule) : JSON.stringify({ days: [1,2,3,4,5,6], openTime: '08:00', closeTime: '18:00', slotDuration: 30 }),
        b.socialLinks ? JSON.stringify(b.socialLinks) : JSON.stringify({}),
        b.autoConfirmAppointments !== undefined ? Boolean(b.autoConfirmAppointments) : true,
        b.plan || 'free',
        Boolean(b.isBlocked),
        b.blockReason || '',
        Boolean(b.isHidden),
        Boolean(b.isVerified),
        b.portfolio ? JSON.stringify(b.portfolio) : JSON.stringify([])
      ]);
    }

    res.json({ success: true, message: 'Perfil del negocio actualizado exitosamente' });
  } catch (error) {
    console.error('Error actualizando negocio:', error);
    res.status(500).json({ error: 'Error al actualizar negocio' });
  }
});

// Crear o sincronizar negocio con Slug
app.post('/api/businesses', async (req, res) => {
  try {
    const b = req.body;
    const bizId = b.id || `biz-${Date.now()}`;
    const finalPhone = b.phone !== undefined ? String(b.phone).trim() : (b.whatsapp !== undefined ? String(b.whatsapp).trim() : '');
    const finalSlug = slugify(b.slug || b.name || bizId);

    // Procesar imágenes Base64 y guardarlas físicamente en la carpeta de este comercio
    const bizFolder = `comercios/${bizId}`;
    if (b.image) {
      b.image = processAndSaveImage(b.image, bizFolder, 'logo');
    }
    if (b.coverImage) {
      b.coverImage = processAndSaveImage(b.coverImage, bizFolder, 'portada');
    }
    if (Array.isArray(b.portfolio)) {
      b.portfolio = b.portfolio.map((item, idx) => {
        if (typeof item === 'string') {
          return processAndSaveImage(item, `${bizFolder}/portafolio`, `port_${idx}`);
        }
        if (item && item.url) {
          return {
            ...item,
            url: processAndSaveImage(item.url, `${bizFolder}/portafolio`, `port_${idx}`)
          };
        }
        return item;
      });
    }

    await pool.query(`
      INSERT INTO reservas_businesses (
        id, name, slug, category, category_label, city, address, phone, email, description,
        image, cover_image, price_range, features, schedule, social_links,
        auto_confirm_appointments, plan, is_blocked, block_reason, is_hidden, is_verified,
        portfolio, rating, reviews_count, is_demo, subscription_status, payment_method
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22,
        $23, 5.0, 0, false, 'active', 'free'
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        slug = COALESCE(EXCLUDED.slug, reservas_businesses.slug),
        category = EXCLUDED.category,
        category_label = EXCLUDED.category_label,
        city = EXCLUDED.city,
        address = EXCLUDED.address,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        description = EXCLUDED.description,
        image = EXCLUDED.image,
        cover_image = EXCLUDED.cover_image,
        price_range = EXCLUDED.price_range,
        features = EXCLUDED.features,
        schedule = EXCLUDED.schedule,
        social_links = EXCLUDED.social_links,
        auto_confirm_appointments = EXCLUDED.auto_confirm_appointments,
        portfolio = COALESCE(EXCLUDED.portfolio, reservas_businesses.portfolio)
    `, [
      bizId,
      b.name || 'Nuevo Negocio',
      finalSlug,
      b.category || 'servicios',
      b.categoryLabel || 'Servicios',
      b.city || '',
      b.address || '',
      finalPhone,
      b.email || '',
      b.description || '',
      b.image || '',
      b.coverImage || '',
      b.priceRange || '₡₡',
      b.features ? JSON.stringify(b.features) : JSON.stringify([]),
      b.schedule ? JSON.stringify(b.schedule) : JSON.stringify({ days: [1,2,3,4,5,6], openTime: '08:00', closeTime: '18:00', slotDuration: 30 }),
      b.socialLinks ? JSON.stringify(b.socialLinks) : JSON.stringify({}),
      b.autoConfirmAppointments !== undefined ? Boolean(b.autoConfirmAppointments) : true,
      b.plan || 'free',
      Boolean(b.isBlocked),
      b.blockReason || '',
      Boolean(b.isHidden),
      Boolean(b.isVerified),
      b.portfolio ? JSON.stringify(b.portfolio) : JSON.stringify([])
    ]);

    res.status(201).json({ success: true, id: bizId, slug: finalSlug });
  } catch (error) {
    console.error('Error creando negocio:', error);
    res.status(500).json({ error: 'Error al crear negocio' });
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

    const planPrices = { free: 0, basic: 10, pro: 18, unlimited: 35 };
    const planLimits = { free: 25, basic: 150, pro: 300, unlimited: 600 };

    const planPriceUsd = planPrices[plan] !== undefined ? planPrices[plan] : 0;
    const monthlyBookingLimit = planLimits[plan] !== undefined ? planLimits[plan] : 25;

    await pool.query(`
      UPDATE reservas_businesses SET
        plan = $1,
        plan_price_usd = $2,
        monthly_booking_limit = $3
      WHERE id = $4
    `, [plan, planPriceUsd, monthlyBookingLimit, id]);

    const planNames = {
      free: 'Plan Gratis (₡0)',
      basic: 'Plan Básico ($10)',
      pro: 'Plan Profesional ($18)',
      unlimited: 'Plan Premium ($35)'
    };

    res.json({ 
      success: true, 
      message: `Plan del comercio actualizado a "${planNames[plan] || plan}".`,
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
    const bizRes = await pool.query('SELECT name, plan, plan_price_usd, monthly_booking_limit, extra_whatsapp_credits FROM reservas_businesses WHERE id = $1', [id]);
    if (bizRes.rows.length === 0) {
      return res.status(404).json({ error: 'Comercio no encontrado.' });
    }

    const biz = bizRes.rows[0];
    const plan = biz.plan || 'free';
    const limit = plan === 'unlimited' ? ((biz.monthly_booking_limit && parseInt(biz.monthly_booking_limit, 10) > 600) ? parseInt(biz.monthly_booking_limit, 10) : 600) : (plan === 'free' ? 25 : (plan === 'basic' ? 150 : (plan === 'pro' ? ((biz.monthly_booking_limit && parseInt(biz.monthly_booking_limit, 10) > 300) ? parseInt(biz.monthly_booking_limit, 10) : 300) : (biz.monthly_booking_limit ? parseInt(biz.monthly_booking_limit, 10) : 25))));
    const extraCredits = parseInt(biz.extra_whatsapp_credits || 0, 10);
    const totalCapacity = limit + extraCredits;

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const countRes = await pool.query(`
      SELECT COUNT(*) as total FROM reservas_appointments 
      WHERE business_id = $1 AND created_at >= $2 AND status != 'cancelled'
    `, [id, startOfMonth]);

    const used = parseInt(countRes.rows[0].total, 10) || 0;
    const remaining = Math.max(0, totalCapacity - used);
    const usagePercent = totalCapacity > 0 ? Math.min(100, Math.round((used / totalCapacity) * 100)) : 0;

    res.json({
      plan: biz.plan || 'free',
      planPriceUsd: (biz.plan_price_usd !== null && biz.plan_price_usd !== undefined) ? parseFloat(biz.plan_price_usd) : (plan === 'free' ? 0 : (plan === 'unlimited' ? 35 : (plan === 'basic' ? 10 : 18))),
      monthlyBookingLimit: limit,
      extraWhatsappCredits: extraCredits,
      totalCapacity,
      usedThisMonth: used,
      remainingThisMonth: remaining,
      usagePercent,
      isUnlimited: false,
      isLimitReached: used >= totalCapacity
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

    // Verificar límite de servicios según el plan
    const bizRes = await pool.query('SELECT plan FROM reservas_businesses WHERE id = $1', [businessId]);
    const biz = bizRes.rows[0];
    const plan = biz ? (biz.plan || 'free') : 'free';

    if (plan === 'free') {
      const countRes = await pool.query('SELECT COUNT(*) FROM reservas_services WHERE business_id = $1', [businessId]);
      const currentServicesCount = parseInt(countRes.rows[0]?.count || 0, 10);
      if (currentServicesCount >= 5) {
        return res.status(403).json({
          error: 'Has alcanzado el límite de 5 servicios del Plan Gratis. Mejora tu plan para agregar servicios ilimitados.',
          upgradeRequired: true,
          limit: 5,
          current: currentServicesCount
        });
      }
    }

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

    const cleanPrice = (s.price !== undefined && s.price !== null)
      ? parseFloat(String(s.price).replace(/[^0-9.]/g, ''))
      : null;
    const cleanDuration = (s.duration !== undefined && s.duration !== null)
      ? parseInt(String(s.duration).replace(/[^0-9]/g, ''), 10)
      : null;

    await pool.query(`
      UPDATE reservas_services SET
        name = COALESCE($1, name),
        duration = COALESCE($2, duration),
        price = COALESCE($3, price),
        description = COALESCE($4, description)
      WHERE id = $5
    `, [
      s.name !== undefined ? s.name : null,
      (cleanDuration !== null && !isNaN(cleanDuration)) ? cleanDuration : null,
      (cleanPrice !== null && !isNaN(cleanPrice)) ? cleanPrice : null,
      s.description !== undefined ? s.description : null,
      id
    ]);

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
        error: 'La gestión de múltiples especialistas y empleados requiere el Plan Profesional ($18) o Plan Premium ($35).',
        requiresUpgrade: true
      });
    }

    const countRes = await pool.query('SELECT COUNT(*) as total FROM reservas_staff WHERE business_id = $1', [businessId]);
    const currentStaffCount = parseInt(countRes.rows[0].total, 10) || 0;

    if (plan === 'pro' && currentStaffCount >= 5) {
      return res.status(403).json({ 
        error: 'Has alcanzado el límite de 5 especialistas del Plan Profesional. Actualiza al Plan Premium para agregar más colaboradores sin restricciones.',
        requiresUpgrade: true
      });
    }

    const newStaffId = `staff-${Date.now()}`;
    const cleanAvatar = s.avatarUrl ? processAndSaveImage(s.avatarUrl, `comercios/${businessId}/equipo`, `staff_${newStaffId}`) : '';
    await pool.query(`
      INSERT INTO reservas_staff (id, business_id, name, role_title, avatar_url, phone, services, schedule, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      newStaffId, 
      businessId, 
      s.name.trim(), 
      s.roleTitle?.trim() || 'Especialista', 
      cleanAvatar, 
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
      avatarUrl: cleanAvatar,
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
    const cleanUpdateAvatar = s.avatarUrl !== undefined ? (s.avatarUrl ? processAndSaveImage(s.avatarUrl, `comercios/${businessId}/equipo`, `staff_${staffId}`) : '') : null;

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
      cleanUpdateAvatar,
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

// Endpoint general para subida directa de imágenes al disco del VPS
app.post('/api/upload', (req, res) => {
  try {
    const { image, businessId, folder, prefix = 'file' } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'No se envió ninguna imagen.' });
    }
    const targetFolder = businessId 
      ? `comercios/${businessId}/${folder || 'general'}`
      : (folder || 'general');
    const savedUrl = processAndSaveImage(image, targetFolder, prefix);
    res.json({ success: true, url: savedUrl });
  } catch (err) {
    console.error('Error en /api/upload:', err);
    res.status(500).json({ error: 'Error al procesar y guardar la imagen en disco.' });
  }
});

// ==========================================
// ENDPOINTS DE CITAS Y RESERVAS
// ==========================================

// Obtener citas de un negocio
app.get('/api/businesses/:id/appointments', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT a.*, r.id as review_id, r.rating as review_rating, r.comment as review_comment,
             r.created_at as review_created_at,
             (r.created_at IS NOT NULL AND (NOW() - r.created_at > INTERVAL '24 hours')) as review_is_expired
      FROM reservas_appointments a
      LEFT JOIN reservas_reviews r ON LOWER(r.appointment_id) = LOWER(a.id)
      WHERE a.business_id = $1 
      ORDER BY a.date DESC, a.time ASC
    `, [id]);

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
      isReviewed: Boolean(a.review_id),
      reviewRating: a.review_rating ? parseInt(a.review_rating, 10) : null,
      reviewComment: a.review_comment || null,
      reviewCreatedAt: a.review_created_at || null,
      reviewIsExpired: Boolean(a.review_is_expired),
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

    const cleanPhone = (phone && phone !== 'null' && phone !== 'undefined') ? phone.trim() : '';
    const cleanPhoneDigits = cleanPhone.replace(/[^0-9]/g, '').slice(-8);
    const cleanEmail = (email && email !== 'null' && email !== 'undefined') ? email.trim().toLowerCase() : '';

    if (!cleanPhoneDigits && !cleanPhone && !cleanEmail) {
      return res.json([]);
    }

    let query = `
      SELECT a.*, b.name as business_name, r.id as review_id, r.rating as review_rating, r.comment as review_comment,
             r.created_at as review_created_at,
             (r.created_at IS NOT NULL AND (NOW() - r.created_at > INTERVAL '24 hours')) as review_is_expired
      FROM reservas_appointments a 
      LEFT JOIN reservas_businesses b ON a.business_id = b.id 
      LEFT JOIN reservas_reviews r ON LOWER(r.appointment_id) = LOWER(a.id)
      WHERE 
    `;
    const params = [];
    const conditions = [];

    if (cleanPhoneDigits && cleanPhoneDigits.length === 8) {
      params.push(cleanPhoneDigits);
      conditions.push(`(RIGHT(regexp_replace(a.client_phone, '[^0-9]', '', 'g'), 8) = $${params.length} OR a.client_phone = $${params.length})`);
    } else if (cleanPhone) {
      params.push(cleanPhone);
      conditions.push(`a.client_phone = $${params.length}`);
    }

    if (cleanEmail) {
      params.push(cleanEmail);
      conditions.push(`(a.client_email IS NOT NULL AND a.client_email != '' AND LOWER(a.client_email) = LOWER($${params.length}))`);
    }

    query += `(${conditions.join(' OR ')}) ORDER BY a.created_at DESC, a.date DESC, a.time ASC`;

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
      isReviewed: Boolean(a.review_id),
      reviewRating: a.review_rating ? parseInt(a.review_rating, 10) : null,
      reviewComment: a.review_comment || null,
      reviewCreatedAt: a.review_created_at || null,
      reviewIsExpired: Boolean(a.review_is_expired),
      createdAt: a.created_at
    }));

    res.json(appointments);
  } catch (error) {
    console.error('Error consultando citas de cliente:', error);
    res.status(500).json({ error: 'Error al consultar citas' });
  }
});

// ==========================================
// ENDPOINTS MINI CRM & NOTAS DE CLIENTES
// ==========================================

// Obtener todas las notas y etiquetas internas de clientes de un negocio (CRM)
app.get('/api/businesses/:id/client-notes', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT client_phone, client_name, notes, tags, updated_at FROM reservas_business_client_notes WHERE business_id = $1',
      [id]
    );
    const notesMap = {};
    result.rows.forEach(r => {
      notesMap[r.client_phone] = {
        clientName: r.client_name || '',
        notes: r.notes || '',
        tags: r.tags ? r.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        updatedAt: r.updated_at
      };
    });
    res.json({ success: true, notes: notesMap });
  } catch (err) {
    console.error('Error obteniendo notas de clientes:', err);
    res.status(500).json({ error: 'Error al obtener notas de clientes' });
  }
});

// Guardar o actualizar nota interna y etiquetas de un cliente en un negocio (CRM)
app.put('/api/businesses/:id/client-notes/:phone', async (req, res) => {
  try {
    const { id, phone } = req.params;
    const { notes, tags, clientName } = req.body || {};
    const cleanPhone = (phone || '').trim();
    if (!cleanPhone) {
      return res.status(400).json({ error: 'Número de teléfono requerido' });
    }

    const noteId = `cn_${id}_${cleanPhone.replace(/[^0-9]/g, '') || Math.random().toString(36).slice(2, 9)}`;
    const tagsStr = Array.isArray(tags) ? tags.join(',') : (tags || '');

    await pool.query(`
      INSERT INTO reservas_business_client_notes (id, business_id, client_phone, client_name, notes, tags, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (business_id, client_phone)
      DO UPDATE SET
        notes = EXCLUDED.notes,
        tags = EXCLUDED.tags,
        client_name = COALESCE(NULLIF(EXCLUDED.client_name, ''), reservas_business_client_notes.client_name),
        updated_at = NOW()
    `, [noteId, id, cleanPhone, clientName || '', notes || '', tagsStr]);

    res.json({ success: true, message: 'Nota interna de cliente guardada correctamente.' });
  } catch (err) {
    console.error('Error guardando nota de cliente:', err);
    res.status(500).json({ error: 'Error al guardar nota de cliente' });
  }
});

// Crear nueva reserva (con protección estricta anti-colisión, soporte transaccional y notificaciones)
app.post('/api/appointments', async (req, res) => {
  const client = await pool.connect();
  try {
    const a = req.body;
    if (!a.businessId || !a.date || !a.time || !a.serviceId) {
      client.release();
      return res.status(400).json({ error: 'Faltan datos obligatorios para la reserva (comercio, fecha, hora o servicio).' });
    }

    const cleanClientName = (a.clientName || '').trim();
    const cleanClientPhone = (a.clientPhone || '').trim();
    const cleanClientEmail = (a.clientEmail || '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!cleanClientName) {
      client.release();
      return res.status(400).json({ error: 'El nombre completo del cliente es obligatorio para confirmar la reserva.' });
    }

    if (!cleanClientPhone) {
      client.release();
      return res.status(400).json({ error: 'El número de teléfono / WhatsApp es obligatorio para confirmar la reserva.' });
    }

    if (!cleanClientEmail || !emailRegex.test(cleanClientEmail)) {
      client.release();
      return res.status(400).json({ error: 'El correo electrónico es obligatorio y debe tener un formato válido.' });
    }

    await client.query('BEGIN');


    // 1. Validar comercio con bloqueo de fila para evitar condiciones de carrera (Race Conditions)
    const bizCheck = await client.query(
      'SELECT name, is_blocked, block_reason, plan, monthly_booking_limit, auto_confirm_appointments FROM reservas_businesses WHERE id = $1 FOR UPDATE',
      [a.businessId]
    );

    if (bizCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ error: 'Comercio no encontrado' });
    }

    const bizData = bizCheck.rows[0];
    if (bizData.is_blocked) {
      await client.query('ROLLBACK');
      client.release();
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

      const countRes = await client.query(`
        SELECT COUNT(*) as total FROM reservas_appointments 
        WHERE business_id = $1 AND created_at >= $2 AND status != 'cancelled'
      `, [a.businessId, startOfMonth]);

      const currentCount = parseInt(countRes.rows[0].total, 10) || 0;
      if (currentCount >= bookingLimit) {
        await client.query('ROLLBACK');
        client.release();
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

    // 3. Rango de tiempo de la reserva solicitada
    const reqStart = timeToMinutes(a.time);
    const reqDuration = parseInt(a.serviceDuration, 10) || 30;
    const reqEnd = reqStart + reqDuration;

    // 4. Verificación de Bloqueos Manuales del Comercio (reservas_blocked_slots)
    const blockedRes = await client.query(
      'SELECT time FROM reservas_blocked_slots WHERE business_id = $1 AND date = $2',
      [a.businessId, a.date]
    );
    const hasBlockedConflict = blockedRes.rows.some(b => {
      const bStart = timeToMinutes(b.time);
      const is15 = (bStart % 30 !== 0);
      const bDur = is15 ? 15 : 30;
      return (reqStart < (bStart + bDur) && reqEnd > bStart);
    });
    if (hasBlockedConflict) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(409).json({
        error: 'El horario seleccionado se encuentra bloqueado por el comercio. Por favor elige otro horario.',
        conflict: true
      });
    }

    // 5. Verificación de Citas Existentes Activas en la misma fecha
    const existingRes = await client.query(`
      SELECT id, time, service_duration, staff_id, client_name 
      FROM reservas_appointments 
      WHERE business_id = $1 AND date = $2 AND status != 'cancelled'
    `, [a.businessId, a.date]);

    // Consultar especialistas activos del negocio
    const allStaffRes = await client.query(
      'SELECT id, name, role_title, services, is_active FROM reservas_staff WHERE business_id = $1 AND is_active = TRUE',
      [a.businessId]
    );
    const activeStaff = allStaffRes.rows;

    let assignedStaffId = null;
    let assignedStaffName = null;

    // CASO A: Negocio sin equipo configurado (Operador único / Dueño solo)
    if (activeStaff.length === 0) {
      const hasConflict = existingRes.rows.some(row => {
        const aptStart = timeToMinutes(row.time);
        const aptDur = parseInt(row.service_duration, 10) || 30;
        return (reqStart < (aptStart + aptDur) && reqEnd > aptStart);
      });
      if (hasConflict) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(409).json({
          error: 'El horario seleccionado ya se encuentra ocupado por otra cita. Por favor elige otro horario disponible.',
          conflict: true
        });
      }
    } 
    // CASO B: Especialista específico seleccionado por el cliente
    else if (a.staffId && a.staffId !== 'any') {
      const targetStaff = activeStaff.find(s => s.id === a.staffId);
      if (!targetStaff) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(404).json({ error: 'El especialista seleccionado no se encuentra disponible.' });
      }

      const hasStaffConflict = existingRes.rows.some(row => {
        if (row.staff_id !== a.staffId) return false;
        const aptStart = timeToMinutes(row.time);
        const aptDur = parseInt(row.service_duration, 10) || 30;
        return (reqStart < (aptStart + aptDur) && reqEnd > aptStart);
      });

      if (hasStaffConflict) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(409).json({
          error: `El especialista ${targetStaff.name} ya tiene una reserva en ese horario (${a.time}). Por favor elige otra hora o selecciona otro especialista.`,
          conflict: true
        });
      }

      assignedStaffId = targetStaff.id;
      assignedStaffName = `${targetStaff.name}${targetStaff.role_title ? ' (' + targetStaff.role_title + ')' : ''}`;
    } 
    // CASO C: Asignación automática ('any' o no especificado)
    else {
      let eligible = activeStaff.filter(st => {
        const svcs = st.services || ['all'];
        return Array.isArray(svcs) && (svcs.includes('all') || svcs.includes(a.serviceId));
      });
      if (eligible.length === 0) eligible = activeStaff;

      const busyStaffIds = new Set();
      let unassignedOverlapCount = 0;

      existingRes.rows.forEach(row => {
        const aptStart = timeToMinutes(row.time);
        const aptDur = parseInt(row.service_duration, 10) || 30;
        if (reqStart < (aptStart + aptDur) && reqEnd > aptStart) {
          if (row.staff_id) {
            busyStaffIds.add(row.staff_id);
          } else {
            unassignedOverlapCount++;
          }
        }
      });

      const availableStaff = eligible.filter(st => !busyStaffIds.has(st.id));

      if (availableStaff.length - unassignedOverlapCount <= 0) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(409).json({
          error: 'No hay especialistas disponibles en el horario seleccionado. Por favor elige otro horario.',
          conflict: true
        });
      }

      const assigned = availableStaff[0];
      assignedStaffId = assigned.id;
      assignedStaffName = `${assigned.name}${assigned.role_title ? ' (' + assigned.role_title + ')' : ''}`;
    }

    const isAutoConfirm = bizData.auto_confirm_appointments !== false;
    const initialStatus = a.status ? a.status : (isAutoConfirm ? 'confirmed' : 'pending');
    const newId = `apt-${Date.now().toString().slice(-6)}`;
    const optIn = a.whatsappOptIn !== undefined ? Boolean(a.whatsappOptIn) : true;

    // Regla de recordatorios: Solo enviar a citas reservadas con al menos 24 horas de anticipación
    const cleanTime = (a.time || '00:00').trim().slice(0, 5);
    const aptDateTime = new Date(`${a.date}T${cleanTime.padStart(5, '0')}:00-06:00`);
    const advanceHours = (aptDateTime.getTime() - Date.now()) / (1000 * 60 * 60);
    // Si la reserva se hace con menos de 24 horas de antelación, se omite el recordatorio
    const reminderSentAt = (advanceHours < 24) ? new Date() : null;

    // 6. Inserción de la nueva cita garantizada sin colisión
    await client.query(`
      INSERT INTO reservas_appointments (
        id, business_id, service_id, service_name, service_price,
        service_duration, date, time, client_name, client_phone,
        client_email, notes, status, whatsapp_opt_in, staff_id, staff_name,
        whatsapp_reminder_sent_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    `, [
      newId, a.businessId, a.serviceId, a.serviceName, a.servicePrice,
      reqDuration, a.date, a.time, a.clientName, a.clientPhone,
      a.clientEmail || '', a.notes || '', initialStatus, optIn,
      assignedStaffId, assignedStaffName, reminderSentAt
    ]);

    // Registrar o actualizar automáticamente el cliente (evitar duplicados por teléfono o email)
    if (cleanClientName && cleanClientPhone) {
      const existingClient = await client.query(
        'SELECT id FROM reservas_clients WHERE phone = $1 OR (email != \'\' AND LOWER(email) = LOWER($2)) ORDER BY (password IS NOT NULL) DESC, created_at ASC LIMIT 1',
        [cleanClientPhone, cleanClientEmail]
      );
      if (existingClient.rows.length > 0) {
        await client.query(
          'UPDATE reservas_clients SET name = $1, email = COALESCE(NULLIF($2, \'\'), email), whatsapp_opt_in = $3 WHERE id = $4',
          [cleanClientName, cleanClientEmail, optIn, existingClient.rows[0].id]
        );
      } else {
        await client.query(
          'INSERT INTO reservas_clients (id, name, phone, email, whatsapp_opt_in) VALUES ($1, $2, $3, $4, $5)',
          [`cli-${Date.now()}`, cleanClientName, cleanClientPhone, cleanClientEmail, optIn]
        );
      }
    }

    await client.query('COMMIT');
    client.release();

    const createdAppointment = { 
      id: newId, 
      ...a, 
      businessName: (bizData && bizData.name) || a.businessName || 'Comercio',
      serviceDuration: reqDuration,
      staffId: assignedStaffId,
      staffName: assignedStaffName,
      whatsappOptIn: optIn, 
      status: initialStatus,
      autoConfirmed: isAutoConfirm
    };

    // Emitir inmediatamente al canal en tiempo real (SSE) para actualizar pantallas de comercio en vivo sin F5
    broadcastBusinessSSE(a.businessId, 'appointment_created', {
      appointment: createdAppointment,
      businessId: a.businessId,
      message: `¡Nueva cita agendada por ${a.clientName || 'un cliente'}!`
    });

    // Notificaciones automáticas de citas (Email, WhatsApp y Web Push)
    const ENABLE_BOOKING_NOTIFICATIONS = process.env.ENABLE_BOOKING_NOTIFICATIONS !== 'false';

    if (ENABLE_BOOKING_NOTIFICATIONS) {
      pool.query('SELECT * FROM reservas_businesses WHERE id = $1', [a.businessId])
        .then(bizRes => {
          const business = bizRes.rows[0] || { name: bizData.name || 'Comercio Reservas CR', phone: '+506 2200 0000', plan: bizData.plan || 'pro' };

          // 1. Si es autoconfirmada: enviar confirmación directa al CLIENTE
          if (isAutoConfirm && initialStatus === 'confirmed') {
            if (a.clientEmail && a.clientEmail.includes('@')) {
              console.log(`📧 [Email Auto] Enviando confirmación de cita #${createdAppointment.id} a ${a.clientEmail}...`);
              sendBookingConfirmationEmail(createdAppointment, business)
                .then(emailRes => {
                  console.log(`📧 [Email Auto] Resultado cita #${createdAppointment.id}:`, emailRes?.success ? `Enviado con éxito (ID: ${emailRes?.data?.id || 'ok'})` : `No enviado (${emailRes?.reason || emailRes?.error?.message || emailRes?.error})`);
                })
                .catch(emailErr => {
                  console.error('⚠️ Error no bloqueante al enviar correo:', emailErr.message);
                });
            }

            if (optIn && a.clientPhone) {
              const plan = business?.plan || 'free';
              const isPaid = ['basic', 'pro', 'unlimited'].includes(plan);
              const extraCredits = parseInt(business?.extra_whatsapp_credits || 0, 10);

              if (isPaid || extraCredits > 0) {
                console.log(`📲 [WhatsApp Cliente] Enviando confirmación de cita #${createdAppointment.id} al teléfono ${a.clientPhone}...`);
                sendBookingConfirmationWhatsApp(createdAppointment, business, pool)
                  .then(waRes => {
                    console.log(`📲 [WhatsApp Cliente] Resultado cita #${createdAppointment.id}:`, waRes?.success ? `Entregado (${waRes.provider})` : `No entregado (${waRes?.reason || waRes?.error})`);
                  })
                  .catch(waErr => {
                    console.error('⚠️ Error no bloqueante al enviar WhatsApp a cliente:', waErr.message);
                  });
              } else {
                console.log(`ℹ️ [WhatsApp Cliente] Cita #${createdAppointment.id}: Negocio en Plan Gratis sin créditos extra de WhatsApp (confirmación enviada por correo).`);
              }
            }
          }

          // 2. Alertar al COMERCIO / DUEÑO (WhatsApp si lo tiene activado, y Web Push / Correo siempre)
          const bizPhone = business?.phone || business?.whatsapp;
          if (bizPhone && business?.notify_owner_whatsapp) {
            console.log(`📲 [WhatsApp Comercio] Enviando alerta de cita #${createdAppointment.id} al teléfono del negocio ${bizPhone}...`);
            sendNewBookingAlertToBusinessWhatsApp(createdAppointment, business, pool)
              .then(waBizRes => {
                console.log(`📲 [WhatsApp Comercio] Resultado cita #${createdAppointment.id}:`, waBizRes?.success ? `Entregado (${waBizRes.provider})` : `No entregado (${waBizRes?.reason || waBizRes?.error})`);
              })
              .catch(waBizErr => {
                console.error('⚠️ Error no bloqueante al enviar WhatsApp al comercio:', waBizErr.message);
              });
          } else {
            console.log(`ℹ️ [WhatsApp Comercio] Alerta al comercio enviada vía Push/Correo (Ahorro 33% Meta activo).`);
          }

          // 3. Enviar Notificación Push Móvil a los dispositivos suscritos del comercio
          const pushTitle = isAutoConfirm 
            ? '🔔 ¡Nueva Reserva Recibida!' 
            : '⏳ ¡Nueva Solicitud de Cita (Pendiente)!';
          const pushBody = isAutoConfirm 
            ? `${a.clientName} ha reservado "${a.serviceName}" para el ${a.date} a las ${a.time}.`
            : `${a.clientName} solicitó "${a.serviceName}" para el ${a.date} a las ${a.time}. Entra a tu panel para aprobarla.`;

          sendPushToBusiness(pool, a.businessId, {
            title: pushTitle,
            body: pushBody,
            icon: '/src/assets/reservas_cr_clean_badge_1.jpg',
            badge: '/src/assets/reservas_cr_clean_badge_1.jpg',
            data: {
              url: `/#/owner-dashboard?tab=calendar&appointmentId=${newId}`,
              appointmentId: newId,
              businessId: a.businessId
            }
          }).then(pushRes => {
            console.log(`📱 [Web Push Auto] Resultado para cita #${createdAppointment.id}:`, pushRes?.delivered ? `${pushRes.delivered} entregados` : (pushRes?.total === 0 ? 'Sin dispositivos suscritos' : 'No entregado'));
          }).catch(pushErr => {
            console.error('⚠️ Error no bloqueante al enviar Push a comercio:', pushErr.message);
          });
        })
        .catch(err => {
          console.error('⚠️ Error al consultar datos del negocio para notificaciones:', err.message);
        });
    }

    res.status(201).json(createdAppointment);
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    client.release();
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

// Endpoint para probar el envío de recordatorio automático por WhatsApp
app.post('/api/test-reminder-whatsapp', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'Debes proporcionar un número de teléfono.' });
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const testAppointment = {
      id: `apt-${Date.now().toString().slice(-6)}`,
      clientName: 'Cliente VIP',
      clientPhone: phone.trim(),
      clientEmail: 'cliente@demo.cr',
      serviceName: 'Corte de Cabello & Barba Premium',
      serviceDuration: 45,
      servicePrice: 12000,
      date: tomorrowStr,
      time: '10:30 AM',
      notes: 'Recordatorio programado',
      whatsappOptIn: true
    };

    const testBusiness = {
      name: 'Salón & Spa Elegance',
      address: 'Centro Comercial Escazú, Local 4',
      city: 'San José',
      phone: '+506 8877 6655'
    };

    const result = await sendAppointmentReminderWhatsApp(testAppointment, testBusiness, pool);
    res.json({ success: true, message: 'Prueba de recordatorio de WhatsApp procesada', result });
  } catch (error) {
    console.error('Error en /api/test-reminder-whatsapp:', error);
    res.status(500).json({ error: error.message || 'Error enviando recordatorio de prueba.' });
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
    if (!prevApt) {
      return res.status(404).json({ error: 'Cita no encontrada' });
    }

    // Validación anti-colisión si se reprograma fecha u hora
    if (a.date || a.time) {
      const targetDate = a.date || prevApt.date;
      const targetTime = a.time || prevApt.time;
      const targetDuration = a.serviceDuration !== undefined ? parseInt(a.serviceDuration, 10) : (parseInt(prevApt.service_duration, 10) || 30);
      const targetStaffId = a.staffId !== undefined ? (a.staffId === 'any' ? null : a.staffId) : prevApt.staff_id;
      const reqStart = timeToMinutes(targetTime);
      const reqEnd = reqStart + targetDuration;

      // 1. Verificar bloqueos manuales
      const blockedRes = await pool.query(
        'SELECT time FROM reservas_blocked_slots WHERE business_id = $1 AND date = $2',
        [prevApt.business_id, targetDate]
      );
      const hasBlockedConflict = blockedRes.rows.some(b => {
        const bStart = timeToMinutes(b.time);
        const is15 = (bStart % 30 !== 0);
        const bDur = is15 ? 15 : 30;
        return (reqStart < (bStart + bDur) && reqEnd > bStart);
      });
      if (hasBlockedConflict) {
        return res.status(409).json({
          error: 'El nuevo horario seleccionado se encuentra bloqueado por el comercio.',
          conflict: true
        });
      }

      // 2. Verificar colisión con otras citas activas (excluyendo la misma cita)
      const existingRes = await pool.query(`
        SELECT id, time, service_duration, staff_id 
        FROM reservas_appointments 
        WHERE business_id = $1 AND date = $2 AND status != 'cancelled' AND id != $3
      `, [prevApt.business_id, targetDate, id]);

      if (targetStaffId) {
        const staffConflict = existingRes.rows.some(row => {
          if (row.staff_id !== targetStaffId) return false;
          const aptStart = timeToMinutes(row.time);
          const aptDur = parseInt(row.service_duration, 10) || 30;
          return (reqStart < (aptStart + aptDur) && reqEnd > aptStart);
        });
        if (staffConflict) {
          return res.status(409).json({
            error: 'El especialista ya tiene otra cita agendada en el nuevo horario seleccionado.',
            conflict: true
          });
        }
      } else {
        const allStaffRes = await pool.query(
          'SELECT id FROM reservas_staff WHERE business_id = $1 AND is_active = TRUE',
          [prevApt.business_id]
        );
        if (allStaffRes.rows.length === 0) {
          const overlap = existingRes.rows.some(row => {
            const aptStart = timeToMinutes(row.time);
            const aptDur = parseInt(row.service_duration, 10) || 30;
            return (reqStart < (aptStart + aptDur) && reqEnd > aptStart);
          });
          if (overlap) {
            return res.status(409).json({
              error: 'El nuevo horario seleccionado ya se encuentra ocupado por otra cita.',
              conflict: true
            });
          }
        }
      }
    }

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
        client_email = COALESCE($11, client_email),
        staff_id = COALESCE($12, staff_id),
        staff_name = COALESCE($13, staff_name)
      WHERE id = $14
    `, [
      a.date, a.time, a.serviceId, a.serviceName,
      a.servicePrice !== undefined ? parseFloat(a.servicePrice) : null,
      a.serviceDuration !== undefined ? parseInt(a.serviceDuration, 10) : null,
      a.notes, a.status, a.clientName, a.clientPhone, a.clientEmail,
      a.staffId !== undefined ? a.staffId : null,
      a.staffName !== undefined ? a.staffName : null,
      id
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

    if (prevApt && prevApt.business_id) {
      broadcastBusinessSSE(prevApt.business_id, 'appointment_updated', {
        appointmentId: id,
        date: a.date || prevApt.date,
        time: a.time || prevApt.time,
        status: a.status || prevApt.status
      });
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

    if (prevApt && prevApt.business_id) {
      broadcastBusinessSSE(prevApt.business_id, 'appointment_updated', {
        appointmentId: id,
        status: status
      });
    }

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

      const isProOrUnlimited = business && (business.plan === 'pro' || business.plan === 'unlimited');
      if (isProOrUnlimited && aptNotif.whatsappOptIn && aptNotif.clientPhone) {
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
      isVerified: Boolean(row.is_verified),
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

// 8.5. Alternar Verificación Oficial de Comercio por Developer
app.patch('/api/developer/businesses/:id/verify', async (req, res) => {
  try {
    const { id } = req.params;
    const { isVerified } = req.body;
    await pool.query('UPDATE reservas_businesses SET is_verified = $1 WHERE id = $2', [Boolean(isVerified), id]);
    res.json({ 
      success: true, 
      message: isVerified ? 'Comercio marcado como VERIFICADO oficialmente.' : 'Verificación de comercio retirada (estado pendiente).',
      isVerified: Boolean(isVerified)
    });
  } catch (error) {
    console.error('Error actualizando verificación del comercio:', error);
    res.status(500).json({ error: 'Error al actualizar verificación del comercio.' });
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

/**
 * Procesa y envía recordatorios automáticos de WhatsApp con regla de >= 24h de anticipación:
 * 1. Omitir si la cita se reservó con menos de 24 horas de antelación (evita spam reciente).
 * 2. Citas de la tarde (>= 12:00 MD): Se envían el mismo día 4 horas antes.
 * 3. Citas de la mañana (< 12:00 MD): Se envían la noche anterior (a partir de las 7:00 PM).
 * Horario de cortesía: 8:00 AM a 8:30 PM (Costa Rica UTC-6).
 */
async function processPendingWhatsAppReminders() {
  try {
    // 1. Obtener fecha y hora actual en Costa Rica (UTC-6)
    const crDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Costa_Rica' }));
    const currentHour = crDate.getHours();
    const currentMinute = crDate.getMinutes();
    const nowMinutes = currentHour * 60 + currentMinute;

    // Solo enviar entre 8:00 AM y 8:30 PM para no perturbar a los clientes
    if (currentHour < 8 || currentHour >= 21) {
      return;
    }

    // Fechas en formato YYYY-MM-DD
    const todayStr = crDate.toLocaleDateString('en-CA', { timeZone: 'America/Costa_Rica' });
    const tomorrowDate = new Date(crDate);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowStr = tomorrowDate.toLocaleDateString('en-CA', { timeZone: 'America/Costa_Rica' });

    // Si ya son las 7:00 PM (19:00) o más, consultamos citas de hoy y de mañana en la mañana
    const datesToQuery = (currentHour >= 19) ? [todayStr, tomorrowStr] : [todayStr];

    // 2. Buscar citas pendientes de recordatorio para las fechas objetivo
    const result = await pool.query(`
      SELECT a.*, 
             b.name as business_name, 
             b.phone as business_phone, 
             b.phone as business_whatsapp, 
             b.address as business_address, 
             b.city as business_city, 
             b.plan as business_plan,
             COALESCE(b.extra_whatsapp_credits, 0) as business_extra_credits
      FROM reservas_appointments a
      JOIN reservas_businesses b ON a.business_id = b.id
      WHERE a.status IN ('confirmed', 'confirmed_sinpe', 'pending')
        AND a.whatsapp_opt_in IS NOT FALSE
        AND a.client_phone IS NOT NULL 
        AND TRIM(a.client_phone) != ''
        AND a.whatsapp_reminder_sent_at IS NULL
        AND a.date = ANY($1)
      ORDER BY a.date ASC, a.time ASC
      LIMIT 30
    `, [datesToQuery]);

    if (!result.rows || result.rows.length === 0) {
      return;
    }

    for (const apt of result.rows) {
      const cleanTime = (apt.time || '').trim().slice(0, 5);
      const timeParts = cleanTime.split(':');
      if (timeParts.length < 2) {
        continue;
      }
      const aptHour = parseInt(timeParts[0], 10);
      const aptMinute = parseInt(timeParts[1], 10);

      // 1. REGLA DE ANTICIPACIÓN: Verificar que la cita fue reservada al menos 24 horas antes
      const aptDateTime = new Date(`${apt.date}T${cleanTime.padStart(5, '0')}:00-06:00`);
      const createdDateTime = new Date(apt.created_at || Date.now());
      const advanceHours = (aptDateTime.getTime() - createdDateTime.getTime()) / (1000 * 60 * 60);

      if (advanceHours < 24) {
        // Reservada con menos de 24h de antelación -> omitir recordatorio para evitar spam
        await pool.query('UPDATE reservas_appointments SET whatsapp_reminder_sent_at = NOW() WHERE id = $1', [apt.id]);
        continue;
      }

      // 2. MOMENTO DE DISPARO DEL RECORDATORIO:
      let shouldSend = false;

      if (apt.date === todayStr) {
        const aptMinutes = aptHour * 60 + aptMinute;
        const minutesUntilApt = aptMinutes - nowMinutes;

        // Si la cita ya pasó, descartar para no enviar fuera de tiempo
        if (minutesUntilApt < 0) {
          await pool.query('UPDATE reservas_appointments SET whatsapp_reminder_sent_at = NOW() WHERE id = $1', [apt.id]);
          continue;
        }

        if (aptHour >= 12) {
          // Citas de la tarde: enviar 4 horas antes (<= 240 min)
          if (minutesUntilApt <= 240) {
            shouldSend = true;
          }
        } else {
          // Citas de la mañana de hoy (fallback matutino si no se envió la noche previa)
          shouldSend = true;
        }
      } else if (apt.date === tomorrowStr) {
        // Citas de mañana: únicamente las de la mañana (< 12:00 MD) se envían la noche anterior a partir de las 7:00 PM (19:00)
        if (currentHour >= 19 && aptHour < 12) {
          shouldSend = true;
        }
      }

      if (!shouldSend) {
        continue;
      }

      const plan = apt.business_plan || 'free';
      const hasPlan = ['basic', 'pro', 'unlimited'].includes(plan);
      const extraCredits = parseInt(apt.business_extra_credits || 0, 10);

      // Si es plan gratis sin créditos extra de WhatsApp, marcar como procesado para no reintentar en bucle
      if (!hasPlan && extraCredits <= 0) {
        await pool.query('UPDATE reservas_appointments SET whatsapp_reminder_sent_at = NOW() WHERE id = $1', [apt.id]);
        continue;
      }

      const appointmentObj = {
        id: apt.id,
        businessId: apt.business_id,
        businessName: apt.business_name,
        serviceName: apt.service_name,
        servicePrice: apt.service_price,
        serviceDuration: apt.service_duration,
        date: apt.date,
        time: apt.time,
        clientName: apt.client_name,
        clientEmail: apt.client_email,
        clientPhone: apt.client_phone,
        whatsappOptIn: apt.whatsapp_opt_in
      };

      const businessObj = {
        id: apt.business_id,
        name: apt.business_name,
        phone: apt.business_phone,
        whatsapp: apt.business_whatsapp,
        address: apt.business_address,
        city: apt.business_city,
        plan: apt.business_plan
      };

      try {
        const sendRes = await sendAppointmentReminderWhatsApp(appointmentObj, businessObj, pool);
        if (sendRes && sendRes.success) {
          await pool.query('UPDATE reservas_appointments SET whatsapp_reminder_sent_at = NOW() WHERE id = $1', [apt.id]);
          console.log(`✅ [Worker Recordatorios] Recordatorio entregado para cita #${apt.id} (${apt.client_name}) al tel: ${apt.client_phone} [${sendRes.provider}]`);
        } else {
          console.warn(`⚠️ [Worker Recordatorios] No se pudo entregar recordatorio cita #${apt.id}:`, sendRes?.reason || sendRes?.error);
        }
      } catch (sendErr) {
        console.error(`❌ [Worker Recordatorios] Error enviando recordatorio cita #${apt.id}:`, sendErr.message);
      }
    }
  } catch (err) {
    console.error('⚠️ Error en worker de recordatorios de WhatsApp:', err.message);
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

    // Verificar si ya existe reseña para esta cita y calcular antigüedad en horas
    const revRes = await pool.query(`
      SELECT *,
             EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600.0 AS hours_elapsed,
             (NOW() - created_at > INTERVAL '24 hours') AS is_expired
      FROM reservas_reviews
      WHERE LOWER(appointment_id) = LOWER($1)
    `, [apt.id]);
    const existingReview = revRes.rows.length > 0 ? revRes.rows[0] : null;

    let canEditReview = true;
    let isExpired = false;
    let hoursRemaining = 24;
    let minutesRemaining = 0;

    if (existingReview) {
      const hoursElapsed = parseFloat(existingReview.hours_elapsed) || 0;
      isExpired = Boolean(existingReview.is_expired) || hoursElapsed >= 24;
      canEditReview = !isExpired;

      const totalSecondsLeft = Math.max(0, (24 * 3600) - Math.floor(hoursElapsed * 3600));
      hoursRemaining = Math.floor(totalSecondsLeft / 3600);
      minutesRemaining = Math.floor((totalSecondsLeft % 3600) / 60);
    }

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
      canEditReview,
      isExpired,
      hoursRemaining,
      minutesRemaining,
      review: existingReview ? {
        id: existingReview.id,
        rating: existingReview.rating,
        comment: existingReview.comment,
        createdAt: existingReview.created_at,
        updatedAt: existingReview.updated_at
      } : null
    });
  } catch (error) {
    console.error('Error en /api/appointments/:id/review-info:', error);
    res.status(500).json({ error: 'Error al consultar datos para calificar.' });
  }
});

// 2. Registrar o modificar reseña verificada (con ventana de 24 horas)
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
    const existing = await pool.query(`
      SELECT id, created_at,
             EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600.0 AS hours_elapsed,
             (NOW() - created_at > INTERVAL '24 hours') AS is_expired
      FROM reservas_reviews
      WHERE LOWER(appointment_id) = LOWER($1)
    `, [apt.id]);

    let targetReviewId = `rev-${Date.now().toString().slice(-6)}`;
    let isUpdate = false;

    if (existing.rows.length > 0) {
      const reviewRow = existing.rows[0];
      const hoursElapsed = parseFloat(reviewRow.hours_elapsed) || 0;
      const isExpired = Boolean(reviewRow.is_expired) || hoursElapsed >= 24;

      if (isExpired) {
        return res.status(403).json({
          error: 'El plazo de 24 horas para modificar tu calificación ha expirado. Ya no es posible modificar esta reseña.',
          isExpired: true,
          canEditReview: false
        });
      }

      targetReviewId = reviewRow.id;
      isUpdate = true;
      // Modificamos calificación y comentario, registrando updated_at y preservando created_at original
      await pool.query(`
        UPDATE reservas_reviews SET
          rating = $1,
          comment = $2,
          updated_at = NOW()
        WHERE id = $3
      `, [ratingNum, (comment || '').trim(), targetReviewId]);
    } else {
      await pool.query(`
        INSERT INTO reservas_reviews (
          id, business_id, appointment_id, client_name, client_phone,
          client_email, service_name, rating, comment, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
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
      isUpdate,
      message: isUpdate 
        ? '¡Muchas gracias! Tu calificación ha sido modificada exitosamente.' 
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
      'unlimited': { price: 35.00, limit: 600, name: 'Plan Premium' }
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
      'unlimited': { price: '35.00', name: 'Plan Premium', limit: 600 }
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
      'unlimited': { price: 35.00, limit: 600, name: 'Plan Premium' }
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
      'free': { price: 0, limit: 25, name: 'Plan Gratis' },
      'basic': { price: 10.00, limit: 150, name: 'Plan Básico' },
      'pro': { price: 18.00, limit: 300, name: 'Plan Profesional' },
      'unlimited': { price: 35.00, limit: 600, name: 'Plan Premium' }
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
      { idKey: 'paypal_plan_unlimited_id', name: 'Plan Premium Reservas CR', price: '35.00', desc: 'Hasta 600 reservas mensuales y especialistas ilimitados' }
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

// ==========================================
// ENDPOINTS DE VERIFICACIÓN SINPE MÓVIL (COSTA RICA)
// ==========================================

// 1. Verificar si un pago SINPE fue recibido y conciliarlo
app.post('/api/sinpe/verify', async (req, res) => {
  try {
    const { amount, senderPhone, referenceNumber, businessId, planId } = req.body;
    const numAmount = parseFloat(amount);
    const cleanRef = String(referenceNumber || '').trim().replace(/^[#:\.\-\s]+/, '');
    const cleanPhone = String(senderPhone || '').replace(/\D/g, '');

    console.log(`🔍 [SINPE Verify] Verificando comprobante: Ref: "${cleanRef}", Monto: ₡${numAmount || 0}, Tel: "${cleanPhone}"`);

    if (!cleanRef && (!numAmount || isNaN(numAmount))) {
      return res.status(400).json({ 
        success: false, 
        error: 'COMPROBANTE_REQUERIDO', 
        message: 'Por favor ingresa el número de comprobante emitido por el banco para validar el pago.' 
      });
    }

    // 1. Escanear buzón en caliente por si el correo acaba de llegar
    try {
      const { checkSinpeEmailsOnce } = await import('./sinpeImapService.js');
      await checkSinpeEmailsOnce();
    } catch (scanErr) {
      console.warn('⚠️ [SINPE Verify] Escaneo en caliente omitido:', scanErr.message);
    }

    // 2. REGLA ESTRICTA: Si el comprobante ya fue usado previamente, rechazarlo de inmediato
    if (cleanRef && cleanRef.length >= 3) {
      const strippedRef = cleanRef.replace(/^0+/, '');
      const usedCheck = await pool.query(`
        SELECT * FROM reservas_sinpe_transactions 
        WHERE (
          reference_number = $1 
          OR reference_number ILIKE $1
          OR LTRIM(reference_number, '0') = $2
          OR reference_number = ('SINPE-' || $1)
        )
        AND status = 'used'
        LIMIT 1
      `, [cleanRef, strippedRef]);

      if (usedCheck.rows.length > 0) {
        const usedTx = usedCheck.rows[0];
        console.warn(`⚠️ [SINPE Verify] Comprobante duplicado/usado rechazado: #${usedTx.reference_number}`);
        return res.status(400).json({
          success: false,
          error: 'COMPROBANTE_YA_UTILIZADO',
          message: `⚠️ El comprobante #${usedTx.reference_number} ya fue utilizado anteriormente y no es válido para otra transacción.`
        });
      }
    }

    let rows = [];

    // 3. Búsqueda principal: Comprobante disponible (unclaimed o verified) con coincidencia exacta
    if (cleanRef && cleanRef.length >= 3) {
      const strippedRef = cleanRef.replace(/^0+/, '');
      const refQuery = `
        SELECT * FROM reservas_sinpe_transactions 
        WHERE (
          reference_number = $1
          OR reference_number ILIKE $1
          OR LTRIM(reference_number, '0') = $2
          OR reference_number = ('SINPE-' || $1)
        )
        AND status IN ('unclaimed', 'verified')
        ORDER BY received_at DESC
        LIMIT 1
      `;
      const refRes = await pool.query(refQuery, [cleanRef, strippedRef]);
      rows = refRes.rows;
    }

    // 3. Si aún no está en BD, hacer escaneo IMAP en caliente y reintentar
    if (rows.length === 0) {
      try {
        const { checkSinpeEmailsOnce } = await import('./sinpeImapService.js');
        await checkSinpeEmailsOnce();

        if (cleanRef && cleanRef.length >= 3) {
          const strippedRef = cleanRef.replace(/^0+/, '');
          const refRetry = await pool.query(`
            SELECT * FROM reservas_sinpe_transactions 
            WHERE (
              reference_number = $1
              OR reference_number ILIKE $1
              OR LTRIM(reference_number, '0') = $2
              OR reference_number = ('SINPE-' || $1)
            )
            AND status IN ('unclaimed', 'verified')
            ORDER BY received_at DESC
            LIMIT 1
          `, [cleanRef, strippedRef]);
          rows = refRetry.rows;
        }
      } catch (scanErr) {
        console.warn('⚠️ [SINPE Verify] Escaneo en caliente omitido:', scanErr.message);
      }
    }

    // 4. Búsqueda secundaria: Por monto y teléfono reciente (si no se envió comprobante)
    if (rows.length === 0 && numAmount > 0 && !cleanRef) {
      let query = `
        SELECT * FROM reservas_sinpe_transactions 
        WHERE ABS(amount_crc - $1) < 0.01 
          AND status IN ('unclaimed', 'verified')
      `;
      const params = [numAmount];

      if (cleanPhone && cleanPhone.length >= 4) {
        const phoneTail = cleanPhone.slice(-4);
        params.push(`%${phoneTail}%`);
        query += ` AND REGEXP_REPLACE(sender_phone, '[^0-9]', '', 'g') ILIKE $${params.length}`;
      } else {
        query += ` AND received_at >= NOW() - INTERVAL '45 minutes'`;
      }

      query += ` ORDER BY received_at DESC LIMIT 1`;
      const amountRes = await pool.query(query, params);
      rows = amountRes.rows;
    }

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'TRANSACCION_NO_ENCONTRADA',
        message: cleanRef 
          ? `❌ No se encontró ningún SINPE pendiente con el comprobante #${cleanRef}. Si acabas de realizar la transferencia, espera unos 10-20 segundos a que el banco emita la notificación y presiona "Verificar" nuevamente.`
          : `❌ No se encontró ninguna transferencia SINPE reciente por ₡${(numAmount || 0).toLocaleString('es-CR')}. Por favor ingresa el número de comprobante.`
      });
    }

    const tx = rows[0];
    const txAmount = parseFloat(tx.amount_crc) || 0;

    // 5. Marcar la transacción como 'used' para que NUNCA vuelva a ser utilizada
    // 5. VALIDACIÓN ESTRICTA DE MONTO: El comprobante y el monto solicitado deben coincidir exactamente
    if (numAmount > 0 && Math.abs(txAmount - numAmount) > 0.01) {
      console.warn(`⚠️ [SINPE Verify] Discrepancia de monto: Comprobante #${tx.reference_number} es por ₡${txAmount}, pero se requiere ₡${numAmount}`);
      return res.status(400).json({
        success: false,
        error: 'MONTO_NO_COINCIDE',
        message: `❌ El comprobante #${tx.reference_number} corresponde a una transferencia por ₡${Number(txAmount).toLocaleString('es-CR')}, pero el monto requerido para esta transacción es de ₡${Number(numAmount).toLocaleString('es-CR')}. Los montos deben coincidir exactamente.`
      });
    }

    // 6. Marcar la transacción como 'used' para que NUNCA vuelva a ser utilizada
    await pool.query(`
      UPDATE reservas_sinpe_transactions
      SET status = 'used',
          claimed_by_business_id = $1,
          claimed_plan_id = $2,
          verified_at = NOW()
      WHERE id = $3
    `, [businessId || null, planId || 'basic', tx.id]);

    // Si hay un businessId asociado, activar el plan o acreditar mensajes adicionales en la base de datos
    if (businessId) {
      const isPack = String(planId || '').startsWith('pack_');
      if (isPack) {
        const packCredits = planId === 'pack_200' ? 200 : (planId === 'pack_500' ? 500 : (planId === 'pack_1000' ? 1000 : 200));
        await pool.query(`
          UPDATE reservas_businesses
          SET extra_whatsapp_credits = COALESCE(extra_whatsapp_credits, 0) + $1
          WHERE id = $2
        `, [packCredits, businessId]);
        console.log(`✅ [SINPE Verify] +${packCredits} créditos extra de WhatsApp acreditados al comercio [${businessId}]`);
      } else {
        await pool.query(`
          UPDATE reservas_businesses
          SET plan = $1,
              subscription_status = 'active',
              payment_method = 'sinpe',
              subscription_updated_at = NOW()
          WHERE id = $2
        `, [planId || 'basic', businessId]);
      }
    }

    console.log(`✅ [SINPE Verify] ¡Pago verificado con éxito y marcado como USADO! Tx ID: ${tx.id}, Ref: ${tx.reference_number}, Monto: ₡${tx.amount_crc}`);

    res.json({
      success: true,
      message: `🎉 ¡Pago de ₡${Number(tx.amount_crc).toLocaleString('es-CR')} confirmado con éxito! Referencia #${tx.reference_number}.`,
      transaction: {
        id: tx.id,
        reference: tx.reference_number,
        amount: Number(tx.amount_crc),
        senderPhone: tx.sender_phone || cleanPhone,
        senderName: tx.sender_name || 'Cliente SINPE',
        originBank: tx.origin_bank,
        receivedAt: tx.received_at,
        verifiedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error en /api/sinpe/verify:', error);
    res.status(500).json({ success: false, error: error.message || 'Error al verificar pago SINPE.' });
  }
});

// 2. Simular recepción de SINPE desde el banco (para entorno de pruebas)
app.post('/api/sinpe/simulate-incoming', async (req, res) => {
  try {
    const { 
      amount_crc = 5, 
      sender_phone = '8888-8888', 
      sender_name = 'Cliente de Prueba', 
      reference_number = `SINPE-${Date.now().toString().slice(-6)}`, 
      origin_bank = 'BAC Credomatic',
      detail = 'Prueba SINPE'
    } = req.body;

    const txId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const numAmount = parseFloat(amount_crc) || 5;

    await pool.query(`
      INSERT INTO reservas_sinpe_transactions 
      (id, reference_number, sender_phone, sender_name, amount_crc, origin_bank, target_phone, detail, status, received_at)
      VALUES ($1, $2, $3, $4, $5, $6, '71433852', $7, 'unclaimed', NOW())
      ON CONFLICT (reference_number) DO NOTHING
    `, [txId, reference_number, sender_phone, sender_name, numAmount, origin_bank, detail]);

    console.log(`🧪 [SINPE Simulator] Nuevo SINPE simulado insertado: ₡${numAmount} de ${sender_phone} (Ref: ${reference_number})`);

    res.json({
      success: true,
      message: `Simulación creada: Se registró un SINPE de ₡${numAmount} de ${sender_phone} con comprobante #${reference_number}.`,
      transaction: {
        id: txId,
        reference_number,
        amount_crc: numAmount,
        sender_phone,
        sender_name,
        origin_bank,
        detail
      }
    });
  } catch (error) {
    console.error('Error en /api/sinpe/simulate-incoming:', error);
    res.status(500).json({ error: error.message || 'Error al simular SINPE.' });
  }
});

// 3. Listar transacciones SINPE recientes (para depuración y pruebas)
app.get('/api/sinpe/transactions', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT * FROM reservas_sinpe_transactions 
      ORDER BY received_at DESC 
      LIMIT 20
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error en /api/sinpe/transactions:', error);
    res.status(500).json({ error: error.message || 'Error al obtener transacciones SINPE.' });
  }
});

// 4. Webhook Inbound para Correos Reenviados (Cloudflare Email Routing, SendGrid, Mailgun, Hotmail Rule)
app.post('/api/webhooks/sinpe-inbound', async (req, res) => {
  try {
    const { from, subject, text, html, body } = req.body;
    const parsed = parseSinpeEmail(subject, text || body, html, from);

    if (!parsed.isSinpe || parsed.amountCrc <= 0) {
      console.log('ℹ️ [SINPE Inbound Webhook] Correo recibido pero no es una notificación de pago SINPE.');
      return res.json({ received: true, isSinpe: false });
    }

    const txId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    await pool.query(`
      INSERT INTO reservas_sinpe_transactions 
      (id, reference_number, sender_phone, sender_name, amount_crc, origin_bank, target_phone, detail, status, raw_data, received_at)
      VALUES ($1, $2, $3, $4, $5, $6, '71433852', $7, 'unclaimed', $8, NOW())
      ON CONFLICT (reference_number) DO UPDATE 
      SET amount_crc = EXCLUDED.amount_crc, sender_phone = EXCLUDED.sender_phone, raw_data = EXCLUDED.raw_data
    `, [txId, parsed.referenceNumber, parsed.senderPhone, parsed.senderName, parsed.amountCrc, parsed.originBank, parsed.detail, JSON.stringify({ from, subject, summary: parsed.rawSummary })]);

    console.log(`⚡ [SINPE Inbound Webhook] ¡SINPE de ₡${parsed.amountCrc} registrado con éxito! Ref: ${parsed.referenceNumber}, Tel: ${parsed.senderPhone}, Banco: ${parsed.originBank}`);

    res.json({
      success: true,
      transaction: parsed
    });
  } catch (error) {
    console.error('Error en /api/webhooks/sinpe-inbound:', error);
    res.status(500).json({ error: error.message || 'Error al procesar webhook de SINPE' });
  }
});

// ==========================================
// ENDPOINTS DE NOTIFICACIONES PUSH MÓVILES (WEB PUSH)
// ==========================================

// 1. Obtener la clave pública VAPID para suscripción en el navegador
app.get('/api/push/vapid-public-key', async (req, res) => {
  try {
    const key = await getVapidPublicKey(pool);
    res.json({ publicKey: key });
  } catch (error) {
    console.error('Error obteniendo VAPID key:', error);
    res.status(500).json({ error: 'Error al obtener clave pública Push' });
  }
});

// 2. Registrar o renovar suscripción push de un comercio
app.post('/api/push/subscribe', async (req, res) => {
  try {
    const { businessId, subscription } = req.body;
    const userAgent = req.headers['user-agent'] || '';
    if (!businessId || !subscription) {
      return res.status(400).json({ error: 'Faltan datos de suscripción requeridos' });
    }
    const result = await savePushSubscription(pool, { businessId, subscription, userAgent });
    res.json(result);
  } catch (error) {
    console.error('Error guardando suscripción push:', error);
    res.status(500).json({ error: error.message || 'Error al guardar suscripción push' });
  }
});

// 3. Eliminar suscripción push de un comercio
app.post('/api/push/unsubscribe', async (req, res) => {
  try {
    const { businessId, endpoint } = req.body;
    if (!endpoint) {
      return res.status(400).json({ error: 'Endpoint requerido para desuscribir' });
    }
    const result = await removePushSubscription(pool, { businessId, endpoint });
    res.json(result);
  } catch (error) {
    console.error('Error eliminando suscripción push:', error);
    res.status(500).json({ error: error.message || 'Error al desuscribir push' });
  }
});

// 4. Enviar notificación de prueba al comercio
app.post('/api/push/test', async (req, res) => {
  try {
    const { businessId } = req.body;
    if (!businessId) {
      return res.status(400).json({ error: 'ID de comercio requerido' });
    }
    const result = await sendPushToBusiness(pool, businessId, {
      title: '🔔 ¡Prueba de Notificación Push!',
      body: '¡Excelente! Tu celular y navegador están recibiendo notificaciones instantáneas de nuevas reservas.',
      data: { url: '/#/owner-dashboard' }
    });
    res.json(result);
  } catch (error) {
    console.error('Error enviando push de prueba:', error);
    res.status(500).json({ error: error.message || 'Error al enviar notificación de prueba' });
  }
});

// ==========================================
// 1.1 GOOGLE OAUTH 2.0 DIRECTO (LOGIN Y REGISTRO OFICIAL CON GOOGLE)
// ==========================================

// Iniciar sesión / Registrarse / Conectar calendario con Google OAuth 2.0 oficial directo
app.get('/api/auth/google', (req, res) => {
  try {
    const role = req.query.role || 'client';
    const action = req.query.action || 'login';
    const businessId = req.query.businessId || null;
    const returnTo = req.query.returnTo || (role === 'business' ? '/panel-negocio' : '/mis-reservas');

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return res.status(500).send('Google Client ID no está configurado en las variables de entorno (.env).');
    }

    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/auth/google/callback`;
    const stateObj = { role, action, businessId, returnTo, ts: Date.now() };
    const state = Buffer.from(JSON.stringify(stateObj)).toString('base64url');

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid email profile');
    authUrl.searchParams.set('access_type', 'online');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('prompt', 'select_account');
    authUrl.searchParams.set('hl', 'es');

    res.redirect(authUrl.toString());
  } catch (err) {
    console.error('Error generando URL de login con Google:', err);
    res.status(500).send(`Error al iniciar sesión con Google: ${err.message}`);
  }
});

// Callback oficial de Google OAuth 2.0
app.get('/api/auth/google/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;

  if (error) {
    console.error('❌ Error recibido en Google OAuth callback:', error, error_description);
    return res.redirect(`/directorio?oauth_error=${encodeURIComponent(error_description || error)}`);
  }

  if (!code) {
    return res.redirect('/directorio?oauth_error=no_authorization_code');
  }

  let role = 'client';
  let action = 'login';
  let businessId = null;
  let returnTo = '/mis-reservas';

  if (state) {
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
      role = decoded.role || 'client';
      action = decoded.action || 'login';
      businessId = decoded.businessId || null;
      returnTo = decoded.returnTo || (role === 'business' ? '/panel-negocio' : '/mis-reservas');
    } catch (e) {
      console.warn('No se pudo decodificar state de Google OAuth:', e.message);
    }
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/auth/google/callback`;

    // 1. Intercambiar código de autorización por tokens con Google
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || tokenData.error) {
      const errorMsg = tokenData.error_description || tokenData.error || 'Error al canjear el código con Google';
      console.error('❌ Error intercambiando código con Google:', errorMsg);
      return res.redirect(`/directorio?oauth_error=${encodeURIComponent(errorMsg)}`);
    }

    // 2. Obtener perfil del usuario desde Google OAuth2 UserInfo
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const profile = await profileRes.json();

    if (!profile || !profile.email) {
      throw new Error('Google no devolvió la dirección de correo electrónico del usuario.');
    }

    const cleanEmail = String(profile.email).trim().toLowerCase();
    const fullName = (profile.name || `${profile.given_name || ''} ${profile.family_name || ''}`).trim() || cleanEmail.split('@')[0];
    const avatarUrl = profile.picture || null;

    // CASO CONECTAR CALENDARIO / CUENTA DIRECTA DE NEGOCIO
    if ((action === 'connect_calendar' || action === 'connect') && businessId) {
      await pool.query(
        `UPDATE reservas_businesses 
         SET nylas_grant_id = $1, nylas_email = $2, nylas_provider = $3, nylas_connected_at = NOW() 
         WHERE id = $4`,
        [`google-direct-${Date.now()}`, cleanEmail, 'google', businessId]
      );
      console.log(`✅ [Google Direct] Cuenta conectada para el negocio ${businessId} (${cleanEmail})`);
      return res.redirect(`/panel-negocio?calendar_connected=true&tab=integrations&email=${encodeURIComponent(cleanEmail)}&provider=google`);
    }

    let sessionUser = null;
    let finalRole = role;

    // 3. Procesar según rol solicitado
    if (role === 'business') {
      // Buscar si ya existe como usuario de negocio
      const bizUserRes = await pool.query('SELECT * FROM reservas_business_users WHERE LOWER(email) = $1', [cleanEmail]);
      if (bizUserRes.rows.length > 0) {
        const row = bizUserRes.rows[0];
        sessionUser = {
          id: row.id,
          businessId: row.business_id,
          name: row.name,
          email: row.email,
          role: 'business'
        };
        await pool.query('UPDATE reservas_business_users SET oauth_provider = $1, avatar_url = COALESCE($2, avatar_url) WHERE id = $3', ['google', avatarUrl, row.id]).catch(() => {});
      } else {
        // Verificar si existe negocio con este email
        const bizRes = await pool.query('SELECT * FROM reservas_businesses WHERE LOWER(email) = $1', [cleanEmail]);
        if (bizRes.rows.length > 0) {
          const biz = bizRes.rows[0];
          const newUserId = `buser-${Date.now()}`;
          await pool.query(
            `INSERT INTO reservas_business_users (id, business_id, name, email, password, oauth_provider, avatar_url)
             VALUES ($1, $2, $3, $4, 'OAUTH_GOOGLE', 'google', $5)`,
            [newUserId, biz.id, biz.name || fullName, cleanEmail, avatarUrl]
          );
          sessionUser = {
            id: newUserId,
            businessId: biz.id,
            name: biz.name || fullName,
            email: cleanEmail,
            role: 'business'
          };
        } else {
          // Crear nuevo negocio y usuario automáticamente
          const newBizId = `biz-${Date.now()}`;
          const newUserId = `buser-${Date.now()}`;
          const defaultSchedule = {
            days: [1, 2, 3, 4, 5, 6],
            openTime: '08:00',
            closeTime: '18:00',
            breakStart: '12:00',
            breakEnd: '13:00',
            slotDuration: 30
          };
          const defaultFeatures = ['Sinpe Móvil', 'Atención Personalizada'];

          await pool.query(`
            INSERT INTO reservas_businesses (
              id, name, category, category_label, rating, reviews_count,
              price_range, address, city, phone, email, description,
              image, cover_image, schedule, features, is_demo,
              plan, plan_price_usd, monthly_booking_limit,
              auto_confirm_appointments, subscription_status, payment_method,
              nylas_provider
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
          `, [
            newBizId, `Negocio de ${fullName}`, 'belleza', 'Salud y Belleza',
            5.0, 0, '₡₡',
            'San José, Costa Rica', 'San José', '', cleanEmail,
            'Servicios profesionales y atención personalizada.',
            avatarUrl || 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80',
            'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1200&q=80',
            JSON.stringify(defaultSchedule), JSON.stringify(defaultFeatures), false,
            'free', 0, 25,
            true, 'active', 'free',
            'google'
          ]);

          const srvId = `srv-${Date.now()}`;
          await pool.query(`
            INSERT INTO reservas_services (id, business_id, name, duration, price, description)
            VALUES ($1, $2, 'Servicio General', 30, 10000, 'Servicio profesional')
          `, [srvId, newBizId]);

          await pool.query(
            `INSERT INTO reservas_business_users (id, business_id, name, email, password, oauth_provider, avatar_url)
             VALUES ($1, $2, $3, $4, 'OAUTH_GOOGLE', 'google', $5)`,
            [newUserId, newBizId, fullName, cleanEmail, avatarUrl]
          );

          sessionUser = {
            id: newUserId,
            businessId: newBizId,
            name: fullName,
            email: cleanEmail,
            role: 'business'
          };
          returnTo = '/panel-negocio?tab=profile';
          console.log(`✅ [Google OAuth] Nuevo comercio registrado y autenticado: ${cleanEmail}`);
        }
      }
    } else {
      // Cliente final
      const clientRes = await pool.query('SELECT * FROM reservas_clients WHERE LOWER(email) = $1', [cleanEmail]);
      if (clientRes.rows.length > 0) {
        const row = clientRes.rows[0];
        sessionUser = {
          id: row.id,
          name: row.name,
          phone: row.phone || '',
          email: row.email,
          avatarUrl: row.avatar_url || avatarUrl,
          whatsappOptIn: row.whatsapp_opt_in !== false,
          role: 'client',
          oauthProvider: 'google',
          needsPhone: !row.phone || row.phone.trim() === ''
        };
        await pool.query(
          'UPDATE reservas_clients SET oauth_provider = $1, avatar_url = COALESCE($2, avatar_url) WHERE id = $3',
          ['google', avatarUrl, row.id]
        ).catch(() => {});
      } else {
        // Verificar si es dueño de negocio ingresando por el acceso general
        const bizUserRes = await pool.query('SELECT * FROM reservas_business_users WHERE LOWER(email) = $1', [cleanEmail]);
        if (bizUserRes.rows.length > 0) {
          const row = bizUserRes.rows[0];
          sessionUser = {
            id: row.id,
            businessId: row.business_id,
            name: row.name,
            email: row.email,
            role: 'business',
            oauthProvider: 'google'
          };
          finalRole = 'business';
          returnTo = '/panel-negocio';
        } else {
          // Registrar nuevo cliente con datos de Google
          const newClientId = `cli-${Date.now()}`;
          await pool.query(
            `INSERT INTO reservas_clients (id, name, phone, email, password, whatsapp_opt_in, oauth_provider, avatar_url)
             VALUES ($1, $2, $3, $4, 'OAUTH_GOOGLE', true, 'google', $5)`,
            [newClientId, fullName, '', cleanEmail, avatarUrl]
          );
          sessionUser = {
            id: newClientId,
            name: fullName,
            phone: '',
            email: cleanEmail,
            avatarUrl: avatarUrl,
            whatsappOptIn: true,
            role: 'client',
            oauthProvider: 'google',
            needsPhone: true
          };
          console.log(`✅ [Google OAuth] Nuevo cliente registrado con Google: ${cleanEmail}`);
        }
      }
    }

    // 4. Generar token JWT seguro de sesión
    const authToken = generateToken({
      id: sessionUser.id,
      name: sessionUser.name,
      email: sessionUser.email,
      role: finalRole,
      ...(finalRole === 'business' ? { businessId: sessionUser.businessId } : { phone: sessionUser.phone || '' })
    });

    let redirectTarget = returnTo || (finalRole === 'business' ? '/panel-negocio' : '/mis-reservas');
    const separator = redirectTarget.includes('?') ? '&' : (redirectTarget.includes('#') ? '?' : '?');
    redirectTarget = `${redirectTarget}${separator}oauth_login=success${sessionUser.needsPhone ? '&needs_phone=1' : ''}`;

    function escapeHtml(s) {
      return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    res.send(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Iniciando sesión con Google...</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: #0f172a;
            color: #ffffff;
          }
          .card {
            background: #1e293b;
            padding: 2.5rem;
            border-radius: 1.5rem;
            text-align: center;
            border: 1px solid rgba(255,255,255,0.1);
            box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);
            max-width: 400px;
            width: 90%;
          }
          .avatar-wrap {
            position: relative;
            width: 64px;
            height: 64px;
            margin: 0 auto 1.25rem;
          }
          .avatar {
            width: 64px;
            height: 64px;
            border-radius: 50%;
            object-fit: cover;
            border: 2px solid #3b82f6;
          }
          .spinner {
            width: 48px;
            height: 48px;
            border: 4px solid rgba(59,130,246,0.2);
            border-top-color: #3b82f6;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 1.5rem;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
          h2 { margin: 0 0 0.5rem; font-size: 1.25rem; font-weight: 800; color: #f8fafc; }
          p { margin: 0; color: #94a3b8; font-size: 0.875rem; }
        </style>
      </head>
      <body>
        <div class="card">
          ${avatarUrl ? `
            <div class="avatar-wrap">
              <img src="${escapeHtml(avatarUrl)}" alt="Avatar" class="avatar">
            </div>
          ` : '<div class="spinner"></div>'}
          <h2>¡Bienvenido, ${escapeHtml(sessionUser.name)}!</h2>
          <p>Iniciando sesión con tu cuenta de Google (${escapeHtml(cleanEmail)})...</p>
        </div>
        <script>
          try {
            const role = ${JSON.stringify(finalRole)};
            const token = ${JSON.stringify(authToken)};
            const sessionData = ${JSON.stringify(sessionUser)};

            if (token) {
              localStorage.setItem('reservas_auth_token_v1', token);
            }
            if (role === 'business') {
              localStorage.setItem('directorio_biz_user_session', JSON.stringify(sessionData));
              if (sessionData.businessId) {
                localStorage.setItem('directorio_active_biz_id', sessionData.businessId);
              }
            } else {
              localStorage.setItem('directorio_client_user_session', JSON.stringify(sessionData));
            }

            if (window.opener && !window.opener.closed) {
              window.opener.postMessage({ type: 'GOOGLE_OAUTH_SUCCESS', role: role, token: token, user: sessionData, needsPhone: Boolean(sessionData && sessionData.needsPhone) }, '*');
              setTimeout(() => { window.close(); }, 300);
            } else {
              window.location.href = ${JSON.stringify(redirectTarget)};
            }
          } catch(e) {
            console.error('Error al guardar sesión:', e);
            window.location.href = '/directorio';
          }
        </script>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('❌ Error en Google OAuth callback:', err);
    res.redirect(`/directorio?oauth_error=${encodeURIComponent(err.message)}`);
  }
});


// ==========================================
// 1.2 MICROSOFT OAUTH 2.0 DIRECTO (OUTLOOK, HOTMAIL, LIVE, MICROSOFT 365)
// ==========================================

// Iniciar sesión / Registrarse / Conectar calendario con Microsoft OAuth 2.0 oficial directo
app.get(['/api/auth/microsoft', '/api/auth/outlook', '/api/auth/hotmail'], (req, res) => {
  try {
    const role = req.query.role || 'client';
    const action = req.query.action || 'login';
    const businessId = req.query.businessId || null;
    const returnTo = req.query.returnTo || (role === 'business' ? '/panel-negocio' : '/mis-reservas');

    const clientId = process.env.MICROSOFT_CLIENT_ID;
    if (!clientId) {
      return res.status(500).send('Microsoft Client ID no está configurado en las variables de entorno (.env).');
    }

    const redirectUri = process.env.MICROSOFT_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/auth/microsoft/callback`;
    const stateObj = { role, action, businessId, returnTo, ts: Date.now() };
    const state = Buffer.from(JSON.stringify(stateObj)).toString('base64url');

    const authUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('response_mode', 'query');
    authUrl.searchParams.set('scope', 'openid profile email User.Read');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('prompt', 'select_account');
    authUrl.searchParams.set('mkt', 'es-es');

    res.redirect(authUrl.toString());
  } catch (err) {
    console.error('Error generando URL de login con Microsoft:', err);
    res.status(500).send(`Error al iniciar sesión con Microsoft: ${err.message}`);
  }
});

// Callback oficial de Microsoft OAuth 2.0
app.get(['/api/auth/microsoft/callback', '/api/auth/outlook/callback'], async (req, res) => {
  const { code, state, error, error_description } = req.query;

  if (error) {
    console.error('❌ Error recibido en Microsoft OAuth callback:', error, error_description);
    return res.redirect(`/directorio?oauth_error=${encodeURIComponent(error_description || error)}`);
  }

  if (!code) {
    return res.redirect('/directorio?oauth_error=no_authorization_code');
  }

  let role = 'client';
  let action = 'login';
  let businessId = null;
  let returnTo = '/mis-reservas';

  if (state) {
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
      role = decoded.role || 'client';
      action = decoded.action || 'login';
      businessId = decoded.businessId || null;
      returnTo = decoded.returnTo || (role === 'business' ? '/panel-negocio' : '/mis-reservas');
    } catch (e) {
      console.warn('No se pudo decodificar state de Microsoft OAuth:', e.message);
    }
  }

  try {
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    const redirectUri = process.env.MICROSOFT_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/auth/microsoft/callback`;

    // 1. Intercambiar código de autorización por tokens con Microsoft
    const tokenRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || tokenData.error) {
      const errorMsg = tokenData.error_description || tokenData.error || 'Error al canjear el código con Microsoft';
      console.error('❌ Error intercambiando código con Microsoft:', errorMsg);
      return res.redirect(`/directorio?oauth_error=${encodeURIComponent(errorMsg)}`);
    }

    // 2. Obtener perfil del usuario desde Microsoft Graph API
    const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const profile = await profileRes.json();

    // Las cuentas personales de Microsoft (Hotmail, Outlook.com, Live) suelen devolver mail=null y el email en userPrincipalName
    const rawEmail = profile.mail || profile.userPrincipalName;
    if (!rawEmail) {
      throw new Error('Microsoft no devolvió la dirección de correo electrónico del usuario.');
    }

    const cleanEmail = String(rawEmail).trim().toLowerCase();

    // CASO CONECTAR CALENDARIO / CUENTA DIRECTA DE NEGOCIO
    if ((action === 'connect_calendar' || action === 'connect') && businessId) {
      await pool.query(
        `UPDATE reservas_businesses 
         SET nylas_grant_id = $1, nylas_email = $2, nylas_provider = $3, nylas_connected_at = NOW() 
         WHERE id = $4`,
        [`microsoft-direct-${Date.now()}`, cleanEmail, 'microsoft', businessId]
      );
      console.log(`✅ [Microsoft Direct] Cuenta conectada para el negocio ${businessId} (${cleanEmail})`);
      return res.redirect(`/panel-negocio?calendar_connected=true&tab=integrations&email=${encodeURIComponent(cleanEmail)}&provider=microsoft`);
    }
    const fullName = (profile.displayName || `${profile.givenName || ''} ${profile.surname || ''}`).trim() || cleanEmail.split('@')[0];
    const phoneFromMs = profile.mobilePhone || (Array.isArray(profile.businessPhones) && profile.businessPhones[0]) || '';

    // Intentar obtener foto de perfil de Microsoft Graph (opcional)
    let avatarUrl = null;
    try {
      const photoRes = await fetch('https://graph.microsoft.com/v1.0/me/photo/$value', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
        signal: AbortSignal.timeout(2000)
      });
      if (photoRes.ok) {
        const buffer = await photoRes.arrayBuffer();
        const contentType = photoRes.headers.get('content-type') || 'image/jpeg';
        avatarUrl = `data:${contentType};base64,${Buffer.from(buffer).toString('base64')}`;
      }
    } catch (photoErr) {
      // Sin foto configurada, continuar
    }

    let sessionUser = null;
    let finalRole = role;

    // 3. Procesar según rol solicitado
    if (role === 'business') {
      // Buscar si ya existe como usuario de negocio
      const bizUserRes = await pool.query('SELECT * FROM reservas_business_users WHERE LOWER(email) = $1', [cleanEmail]);
      if (bizUserRes.rows.length > 0) {
        const row = bizUserRes.rows[0];
        sessionUser = {
          id: row.id,
          businessId: row.business_id,
          name: row.name,
          email: row.email,
          role: 'business'
        };
        await pool.query('UPDATE reservas_business_users SET oauth_provider = $1, avatar_url = COALESCE($2, avatar_url) WHERE id = $3', ['microsoft', avatarUrl, row.id]).catch(() => {});
      } else {
        // Verificar si existe negocio con este email
        const bizRes = await pool.query('SELECT * FROM reservas_businesses WHERE LOWER(email) = $1', [cleanEmail]);
        if (bizRes.rows.length > 0) {
          const biz = bizRes.rows[0];
          const newUserId = `buser-${Date.now()}`;
          await pool.query(
            `INSERT INTO reservas_business_users (id, business_id, name, email, password, oauth_provider, avatar_url)
             VALUES ($1, $2, $3, $4, 'OAUTH_MICROSOFT', 'microsoft', $5)`,
            [newUserId, biz.id, biz.name || fullName, cleanEmail, avatarUrl]
          );
          sessionUser = {
            id: newUserId,
            businessId: biz.id,
            name: biz.name || fullName,
            email: cleanEmail,
            role: 'business'
          };
        } else {
          // Crear nuevo negocio y usuario automáticamente
          const newBizId = `biz-${Date.now()}`;
          const newUserId = `buser-${Date.now()}`;
          const defaultSchedule = {
            days: [1, 2, 3, 4, 5, 6],
            openTime: '08:00',
            closeTime: '18:00',
            breakStart: '12:00',
            breakEnd: '13:00',
            slotDuration: 30
          };
          const defaultFeatures = ['Sinpe Móvil', 'Atención Personalizada'];

          await pool.query(`
            INSERT INTO reservas_businesses (
              id, name, category, category_label, rating, reviews_count,
              price_range, address, city, phone, email, description,
              image, cover_image, schedule, features, is_demo,
              plan, plan_price_usd, monthly_booking_limit,
              auto_confirm_appointments, subscription_status, payment_method,
              nylas_provider
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
          `, [
            newBizId, `Negocio de ${fullName}`, 'belleza', 'Salud y Belleza',
            5.0, 0, '₡₡',
            'San José, Costa Rica', 'San José', phoneFromMs || '', cleanEmail,
            'Servicios profesionales y atención personalizada.',
            avatarUrl || 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80',
            'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1200&q=80',
            JSON.stringify(defaultSchedule), JSON.stringify(defaultFeatures), false,
            'free', 0, 25,
            true, 'active', 'free',
            'microsoft'
          ]);

          const srvId = `srv-${Date.now()}`;
          await pool.query(`
            INSERT INTO reservas_services (id, business_id, name, duration, price, description)
            VALUES ($1, $2, 'Servicio General', 30, 10000, 'Servicio profesional')
          `, [srvId, newBizId]);

          await pool.query(
            `INSERT INTO reservas_business_users (id, business_id, name, email, password, oauth_provider, avatar_url)
             VALUES ($1, $2, $3, $4, 'OAUTH_MICROSOFT', 'microsoft', $5)`,
            [newUserId, newBizId, fullName, cleanEmail, avatarUrl]
          );

          sessionUser = {
            id: newUserId,
            businessId: newBizId,
            name: fullName,
            email: cleanEmail,
            role: 'business'
          };
          returnTo = '/panel-negocio?tab=profile';
          console.log(`✅ [Microsoft OAuth] Nuevo comercio registrado y autenticado: ${cleanEmail}`);
        }
      }
    } else {
      // Cliente final
      const clientRes = await pool.query('SELECT * FROM reservas_clients WHERE LOWER(email) = $1', [cleanEmail]);
      if (clientRes.rows.length > 0) {
        const row = clientRes.rows[0];
        const clientPhone = row.phone || phoneFromMs || '';
        sessionUser = {
          id: row.id,
          name: row.name,
          phone: clientPhone,
          email: row.email,
          avatarUrl: row.avatar_url || avatarUrl,
          whatsappOptIn: row.whatsapp_opt_in !== false,
          role: 'client',
          oauthProvider: 'microsoft',
          needsPhone: !clientPhone || clientPhone.trim() === ''
        };
        await pool.query(
          'UPDATE reservas_clients SET oauth_provider = $1, avatar_url = COALESCE($2, avatar_url), phone = COALESCE(NULLIF(phone, \'\'), $3) WHERE id = $4',
          ['microsoft', avatarUrl, phoneFromMs || null, row.id]
        ).catch(() => {});
      } else {
        // Verificar si es dueño de negocio ingresando por el acceso general
        const bizUserRes = await pool.query('SELECT * FROM reservas_business_users WHERE LOWER(email) = $1', [cleanEmail]);
        if (bizUserRes.rows.length > 0) {
          const row = bizUserRes.rows[0];
          sessionUser = {
            id: row.id,
            businessId: row.business_id,
            name: row.name,
            email: row.email,
            role: 'business',
            oauthProvider: 'microsoft'
          };
          finalRole = 'business';
          returnTo = '/panel-negocio';
        } else {
          // Registrar nuevo cliente con datos de Microsoft
          const newClientId = `cli-${Date.now()}`;
          const clientPhone = phoneFromMs || '';
          await pool.query(
            `INSERT INTO reservas_clients (id, name, phone, email, password, whatsapp_opt_in, oauth_provider, avatar_url)
             VALUES ($1, $2, $3, $4, 'OAUTH_MICROSOFT', true, 'microsoft', $5)`,
            [newClientId, fullName, clientPhone, cleanEmail, avatarUrl]
          );
          sessionUser = {
            id: newClientId,
            name: fullName,
            phone: clientPhone,
            email: cleanEmail,
            avatarUrl: avatarUrl,
            whatsappOptIn: true,
            role: 'client',
            oauthProvider: 'microsoft',
            needsPhone: !clientPhone || clientPhone.trim() === ''
          };
          console.log(`✅ [Microsoft OAuth] Nuevo cliente registrado con Microsoft: ${cleanEmail}`);
        }
      }
    }

    // 4. Generar token JWT seguro de sesión
    const authToken = generateToken({
      id: sessionUser.id,
      name: sessionUser.name,
      email: sessionUser.email,
      role: finalRole,
      ...(finalRole === 'business' ? { businessId: sessionUser.businessId } : { phone: sessionUser.phone || '' })
    });

    let redirectTarget = returnTo || (finalRole === 'business' ? '/panel-negocio' : '/mis-reservas');
    const separator = redirectTarget.includes('?') ? '&' : (redirectTarget.includes('#') ? '?' : '?');
    redirectTarget = `${redirectTarget}${separator}oauth_login=success${sessionUser.needsPhone ? '&needs_phone=1' : ''}&oauth_provider=microsoft`;

    function escapeHtml(s) {
      return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    res.send(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Iniciando sesión con Microsoft...</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: #0f172a;
            color: #ffffff;
          }
          .card {
            background: #1e293b;
            padding: 2.5rem;
            border-radius: 1.5rem;
            text-align: center;
            border: 1px solid rgba(255,255,255,0.1);
            box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);
            max-width: 400px;
            width: 90%;
          }
          .avatar-wrap {
            position: relative;
            width: 64px;
            height: 64px;
            margin: 0 auto 1.25rem;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .avatar {
            width: 64px;
            height: 64px;
            border-radius: 50%;
            object-fit: cover;
            border: 2px solid #00a4ef;
          }
          .avatar-svg {
            width: 56px;
            height: 56px;
          }
          .spinner {
            width: 48px;
            height: 48px;
            border: 4px solid rgba(0,164,239,0.2);
            border-top-color: #00a4ef;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 1.5rem;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
          h2 { margin: 0 0 0.5rem; font-size: 1.25rem; font-weight: 800; color: #f8fafc; }
          p { margin: 0; color: #94a3b8; font-size: 0.875rem; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="avatar-wrap">
            ${avatarUrl ? `
              <img src="${escapeHtml(avatarUrl)}" alt="Avatar" class="avatar">
            ` : `
              <svg class="avatar-svg" viewBox="0 0 21 21">
                <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
                <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
                <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
                <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
              </svg>
            `}
          </div>
          <div class="spinner"></div>
          <h2>¡Bienvenido, ${escapeHtml(sessionUser.name)}!</h2>
          <p>Iniciando sesión con tu cuenta de Microsoft (${escapeHtml(cleanEmail)})...</p>
        </div>
        <script>
          try {
            const role = ${JSON.stringify(finalRole)};
            const token = ${JSON.stringify(authToken)};
            const sessionData = ${JSON.stringify(sessionUser)};

            if (token) {
              localStorage.setItem('reservas_auth_token_v1', token);
            }
            if (role === 'business') {
              localStorage.setItem('directorio_biz_user_session', JSON.stringify(sessionData));
              if (sessionData.businessId) {
                localStorage.setItem('directorio_active_biz_id', sessionData.businessId);
              }
            } else {
              localStorage.setItem('directorio_client_user_session', JSON.stringify(sessionData));
            }

            if (window.opener && !window.opener.closed) {
              window.opener.postMessage({ type: 'MICROSOFT_OAUTH_SUCCESS', provider: 'Microsoft', role: role, token: token, user: sessionData, needsPhone: Boolean(sessionData && sessionData.needsPhone) }, '*');
              setTimeout(() => { window.close(); }, 300);
            } else {
              window.location.href = ${JSON.stringify(redirectTarget)};
            }
          } catch(e) {
            console.error('Error al guardar sesión:', e);
            window.location.href = '/directorio';
          }
        </script>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('❌ Error en Microsoft OAuth callback:', err);
    res.redirect(`/directorio?oauth_error=${encodeURIComponent(err.message)}`);
  }
});

// ==========================================
// 1.3 SINCRONIZACIÓN Y CONEXIÓN DIRECTA DE CALENDARIOS (GOOGLE & MICROSOFT)
// ==========================================

// Iniciar autenticación directa para sincronización de calendario de un comercio
app.get(['/api/calendar/auth', '/api/nylas/auth'], (req, res) => {
  const { businessId, provider = 'google' } = req.query;
  const isGoogle = (provider || '').toLowerCase().includes('google');
  const target = isGoogle ? '/api/auth/google' : '/api/auth/microsoft';
  return res.redirect(`${target}?role=business&businessId=${encodeURIComponent(businessId || '')}&action=connect_calendar&returnTo=${encodeURIComponent('/panel-negocio?tab=integrations')}`);
});

// Desconectar calendario del comercio
app.post(['/api/calendar/disconnect', '/api/nylas/disconnect'], async (req, res) => {
  try {
    const { businessId } = req.body;
    if (!businessId) {
      return res.status(400).json({ error: 'businessId es requerido.' });
    }

    await pool.query(
      `UPDATE reservas_businesses 
       SET nylas_grant_id = NULL, nylas_email = NULL, nylas_provider = NULL, nylas_connected_at = NULL, nylas_calendar_id = NULL 
       WHERE id = $1`,
      [businessId]
    );

    console.log(`🔌 [Calendar Direct] Calendario desconectado para el negocio ${businessId}`);
    res.json({ success: true, message: 'Calendario desconectado exitosamente.' });
  } catch (err) {
    console.error('Error desconectando calendario:', err);
    res.status(500).json({ error: err.message || 'Error al desconectar calendario' });
  }
});

// Consultar estado de conexión de calendario para un comercio
app.get(['/api/calendar/status/:businessId', '/api/nylas/status/:businessId'], async (req, res) => {
  try {
    const { businessId } = req.params;
    const bizRes = await pool.query(
      'SELECT nylas_grant_id, nylas_email, nylas_provider, nylas_connected_at FROM reservas_businesses WHERE id = $1',
      [businessId]
    );

    if (bizRes.rows.length === 0) {
      return res.status(404).json({ error: 'Negocio no encontrado' });
    }

    const row = bizRes.rows[0];
    res.json({
      isConnected: !!row.nylas_grant_id,
      email: row.nylas_email || null,
      provider: row.nylas_provider || null,
      connectedAt: row.nylas_connected_at || null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// PÁGINAS LEGALES INDEPENDIENTES (CUMPLIMIENTO GOOGLE OAUTH Y PRODHAB)
// ==========================================
app.get(['/privacidad', '/privacy', '/politica-de-privacidad'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'privacidad.html'));
});

app.get(['/terminos', '/terms', '/terminos-y-condiciones', '/terminos-de-servicio'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'terminos.html'));
});

// ==========================================
// VERIFICACIÓN DE DOMINIO DE EDITOR MICROSOFT ENTRA / AZURE (.WELL-KNOWN)
// ==========================================
app.get([
  '/.well-known/microsoft-identity-association',
  '/.well-known/microsoft-identity-association.json'
], (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).json({
    associatedApplications: [
      {
        applicationId: process.env.MICROSOFT_CLIENT_ID || '18cb090d-8521-4e1a-91d9-89a1499365d7'
      }
    ]
  });
});

// Middleware Catch-All para SPA (Cualquier ruta no capturada por API sirve index.html)
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Endpoint de API no encontrado' });
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Iniciar base de datos, servidor y worker de reseñas
async function startServer() {
  await initDatabase();
  await initPushService(pool);
  app.listen(PORT, () => {
    console.log(`🚀 Servidor de Reservas corriendo en http://localhost:${PORT}`);
    console.log(`🐘 Conectado a Neon PostgreSQL`);

    // Iniciar worker de correos de reseñas automáticos cada 5 minutos
    setInterval(processPendingReviewEmails, 5 * 60 * 1000);
    // Ejecutar chequeo inicial 10 segundos después del arranque
    setTimeout(processPendingReviewEmails, 10000);

    // Iniciar worker de recordatorios automáticos por WhatsApp cada 5 minutos
    setInterval(processPendingWhatsAppReminders, 5 * 60 * 1000);
    // Ejecutar chequeo inicial 20 segundos después del arranque
    setTimeout(processPendingWhatsAppReminders, 20000);

    // Iniciar worker de lectura automática de SINPE Móvil (cada 15 segundos)
    try {
      startSinpeImapWorker(15000);
    } catch (sinpeErr) {
      console.warn('⚠️ No se pudo iniciar el worker de SINPE IMAP:', sinpeErr.message);
    }
  });
}

startServer();

