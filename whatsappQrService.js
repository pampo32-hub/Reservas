/**
 * WHATSAPP QR SERVICE - RESERVAS CR
 * Conexión rápida oficial por Código QR (WhatsApp Web Multi-Device)
 * Permite al negocio vincular su WhatsApp escaneando un código QR con su celular.
 * Integra las respuestas inteligentes de Google Gemini y agendamiento automático.
 */

import makeWASocket, { 
  useMultiFileAuthState, 
  DisconnectReason, 
  Browsers 
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { processCustomerMessageWithGemini } from './aiBookingAgent.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SESSIONS_DIR = path.join(__dirname, 'whatsapp_sessions', 'central');

// Estado en memoria
let sock = null;
let currentQrRaw = null;
let currentQrDataUrl = null;
let connectionStatus = 'disconnected'; // 'disconnected' | 'connecting' | 'qr_ready' | 'connected'
let connectedUser = null;
let lastError = null;
let lastMessageError = null;
let dbPool = null;
let isStarting = false;

// Memoria de sesiones conversacionales por número de teléfono (expira tras 2 horas de inactividad)
const phoneSessions = new Map();
const SESSION_EXPIRATION_MS = 2 * 60 * 60 * 1000;

// Registro de IDs de mensajes enviados por el bot para prevenir bucles de respuesta
const botSentMessageIds = new Set();

// Historial de actividad reciente para monitoreo en vivo (últimos 30 eventos)
const recentActivityLogs = [];
function logActivity(msg) {
  const ts = new Date().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  console.log(`[WhatsApp QR] [${ts}] ${msg}`);
  recentActivityLogs.unshift(`[${ts}] ${msg}`);
  if (recentActivityLogs.length > 30) recentActivityLogs.pop();
}

// Normalizador de texto para detección flexible de nombres sin importar tildes ni mayúsculas
function normalizeText(str) {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Inicializa el servicio de WhatsApp por QR
 */
export async function initWhatsAppQrService(pool) {
  dbPool = pool;

  // Si ya existe sesión previa guardada en disco, reconectar automáticamente en segundo plano
  if (fs.existsSync(SESSIONS_DIR) && fs.readdirSync(SESSIONS_DIR).length > 0) {
    console.log('🔄 [WhatsApp QR] Sesión previa detectada en disco, intentando reconexión automática...');
    startWhatsAppQrConnection().catch(e => {
      console.warn('⚠️ [WhatsApp QR] No se pudo reanudar sesión previa:', e.message);
    });
  }
}

/**
 * Inicia la conexión con WhatsApp y genera el código QR
 */
export async function startWhatsAppQrConnection() {
  if (sock && connectionStatus === 'connected') {
    return getWhatsAppQrStatus();
  }

  if (isStarting) {
    return getWhatsAppQrStatus();
  }

  isStarting = true;
  connectionStatus = 'connecting';
  lastError = null;

  try {
    if (!fs.existsSync(SESSIONS_DIR)) {
      fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(SESSIONS_DIR);

    sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }),
      browser: Browsers.macOS('Chrome'),
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 25000
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        currentQrRaw = qr;
        try {
          currentQrDataUrl = await qrcode.toDataURL(qr, {
            width: 280,
            margin: 2,
            color: { dark: '#0F172A', light: '#FFFFFF' }
          });
          connectionStatus = 'qr_ready';
          console.log('📲 [WhatsApp QR] Nuevo código QR listo para escanear.');
        } catch (qrErr) {
          console.error('Error generando imagen QR:', qrErr);
        }
      }

      if (connection === 'open') {
        connectionStatus = 'connected';
        currentQrRaw = null;
        currentQrDataUrl = null;
        isStarting = false;

        const rawPhone = (sock.user?.id || '').replace(/@.*$/, '').replace(/:.*$/, '');
        connectedUser = {
          id: sock.user?.id,
          phone: rawPhone,
          name: sock.user?.name || 'WhatsApp Central Reservas CR'
        };

        console.log(`🟢 [WhatsApp QR] ¡Conectado exitosamente con el número +${rawPhone}!`);

        // Guardar teléfono conectado en reservas_system_settings
        if (dbPool) {
          try {
            await dbPool.query(`
              INSERT INTO reservas_system_settings (key, value, updated_at)
              VALUES ('WHATSAPP_CENTRAL_PHONE', $1, NOW())
              ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
            `, [rawPhone]);
          } catch (_) {}
        }
      }

      if (connection === 'close') {
        isStarting = false;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        console.warn(`⚠️ [WhatsApp QR] Conexión cerrada (Código: ${statusCode || 'desc'}). Reconectar: ${shouldReconnect}`);

        if (statusCode === DisconnectReason.loggedOut) {
          connectionStatus = 'disconnected';
          connectedUser = null;
          currentQrDataUrl = null;
          currentQrRaw = null;
          cleanSessionFiles();
        } else if (shouldReconnect) {
          connectionStatus = 'connecting';
          setTimeout(() => {
            startWhatsAppQrConnection().catch(console.error);
          }, 4000);
        } else {
          connectionStatus = 'disconnected';
        }
      }
    });

    // Escuchar mensajes entrantes y responder con la IA de Gemini
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const m of messages) {
        try {
          if (!m.message) continue;
          if (m.key.remoteJid === 'status@broadcast') continue;
          if (m.key.remoteJid.endsWith('@g.us')) continue; // Solo chats directos 1 a 1

          const remoteJid = m.key.remoteJid;
          const senderPhone = remoteJid.replace(/@.*$/, '').replace(/:.*$/, '');
          const myPhone = connectedUser?.phone || '';
          const isSelfChat = Boolean(myPhone && (senderPhone === myPhone || remoteJid.startsWith(myPhone)));

          if (m.key.fromMe) {
            // Ignorar siempre si el mensaje fue enviado por el bot para evitar bucles
            if (botSentMessageIds.has(m.key.id)) continue;
            // Si no es un mensaje en el chat consigo mismo (Note to self), ignorar
            if (!isSelfChat) continue;
          }

          const text = (
            m.message.conversation || 
            m.message.extendedTextMessage?.text || 
            m.message.imageMessage?.caption || 
            ''
          ).trim();

          if (!text) continue;

          const senderName = m.pushName || 'Cliente';
          logActivity(`📥 Mensaje de ${senderName} (+${senderPhone}): "${text}"`);

          // Obtener o inicializar sesión para este número telefónico
          let session = phoneSessions.get(senderPhone);
          const now = Date.now();
          if (!session || (now - session.lastActive > SESSION_EXPIRATION_MS)) {
            session = {
              businessId: null,
              businessName: null,
              history: [],
              lastActive: now
            };
            phoneSessions.set(senderPhone, session);
          }
          session.lastActive = now;

          // 1. Detección por tag [Ref: id] si existiera (retrocompatibilidad)
          let businessId = null;
          const bizRefMatch = text.match(/\[(?:Ref|ID):\s*([a-zA-Z0-9_\-]+)\]/i);
          if (bizRefMatch && bizRefMatch[1]) {
            businessId = bizRefMatch[1].trim();
          }

          // 2. Si no tiene tag [Ref: ...], detectar el nombre del comercio directamente en el texto
          if (!businessId && dbPool) {
            try {
              const bizListRes = await dbPool.query(`
                SELECT id, name, slug FROM reservas_businesses 
                WHERE is_blocked = false 
                ORDER BY LENGTH(name) DESC
              `);

              const normText = normalizeText(text);

              // Buscar comercio cuyo nombre normalizado o slug esté contenido en el texto recibido
              for (const biz of bizListRes.rows) {
                const normName = normalizeText(biz.name);
                const normSlug = biz.slug ? normalizeText(biz.slug.replace(/-/g, ' ')) : '';

                if ((normName && normText.includes(normName)) || (normSlug && normText.includes(normSlug))) {
                  businessId = biz.id;
                  session.businessId = businessId;
                  session.businessName = biz.name;
                  logActivity(`🎯 Negocio detectado por nombre: "${biz.name}" (ID: ${businessId})`);
                  break;
                }
              }

              // Si aún no hace match exacto, verificar si al menos contiene las 2 palabras clave más representativas
              if (!businessId) {
                for (const biz of bizListRes.rows) {
                  const words = normalizeText(biz.name).split(' ').filter(w => w.length > 3);
                  if (words.length >= 2) {
                    const matchedWords = words.filter(w => normText.includes(w));
                    if (matchedWords.length >= 2) {
                      businessId = biz.id;
                      session.businessId = businessId;
                      session.businessName = biz.name;
                      logActivity(`🎯 Negocio detectado por palabras clave: "${biz.name}" (ID: ${businessId})`);
                      break;
                    }
                  }
                }
              }
            } catch (err) {
              logActivity(`⚠️ Error buscando negocio en DB: ${err.message}`);
            }
          }

          // 3. Si el cliente no repite el nombre en su segundo/tercer mensaje, recordar el negocio activo de su sesión
          if (!businessId && session.businessId) {
            businessId = session.businessId;
          } else if (businessId) {
            session.businessId = businessId;
          }

          // 4. Limpiar cualquier tag técnico residual del texto para procesar
          const cleanUserText = text.replace(/\[(?:Ref|ID):\s*([a-zA-Z0-9_\-]+)\]/gi, '').trim();

          // Indicar "Escribiendo..." en el chat de WhatsApp
          try {
            await sock.sendPresenceUpdate('composing', remoteJid);
          } catch (_) {}

          logActivity(`🤖 Procesando con Gemini para: ${session.businessName || businessId || 'General'}...`);

          // Procesar con la IA de Gemini conectada a PostgreSQL con memoria conversacional
          const aiResponse = await processCustomerMessageWithGemini(dbPool, {
            businessId,
            customerPhone: senderPhone,
            customerName: senderName,
            messageText: cleanUserText,
            conversationHistory: session.history.slice(-8)
          });

          // Registrar en la memoria conversacional de este cliente
          session.history.push({ role: 'user', text: cleanUserText });
          if (aiResponse?.reply) {
            session.history.push({ role: 'assistant', text: aiResponse.reply });
            if (session.history.length > 16) {
              session.history = session.history.slice(-16);
            }
          }


          if (aiResponse?.reply) {
            const sent = await sock.sendMessage(remoteJid, { text: aiResponse.reply });
            if (sent?.key?.id) {
              botSentMessageIds.add(sent.key.id);
              if (botSentMessageIds.size > 200) {
                const firstKey = botSentMessageIds.values().next().value;
                botSentMessageIds.delete(firstKey);
              }
            }
            logActivity(`📤 Respuesta enviada a +${senderPhone}`);
          } else {
            logActivity(`⚠️ Gemini no devolvió respuesta para +${senderPhone}`);
          }

          try {
            await sock.sendPresenceUpdate('paused', remoteJid);
          } catch (_) {}

        } catch (msgErr) {
          lastMessageError = msgErr.message;
          logActivity(`💥 ERROR en mensaje: ${msgErr.message}`);
          console.error('Error procesando mensaje entrante en WhatsApp QR:', msgErr);
        }
      }
    });

  } catch (err) {
    isStarting = false;
    connectionStatus = 'disconnected';
    lastError = err.message;
    console.error('Error iniciando socket WhatsApp QR:', err);
  }

  return getWhatsAppQrStatus();
}

/**
 * Cierra la sesión y borra las credenciales en disco
 */
export async function disconnectWhatsAppQr() {
  try {
    if (sock) {
      try {
        await sock.logout();
      } catch (_) {}
      try {
        sock.end();
      } catch (_) {}
      sock = null;
    }
    cleanSessionFiles();
    connectionStatus = 'disconnected';
    connectedUser = null;
    currentQrRaw = null;
    currentQrDataUrl = null;
    console.log('🔌 [WhatsApp QR] Sesión cerrada y desconectada por el usuario.');
    return { success: true, message: 'WhatsApp desconectado exitosamente.' };
  } catch (err) {
    console.error('Error desconectando WhatsApp QR:', err);
    throw err;
  }
}

/**
 * Retorna el estado actual para el frontend
 */
export function getWhatsAppQrStatus() {
  return {
    status: connectionStatus,
    isConnected: connectionStatus === 'connected',
    qr: currentQrDataUrl,
    user: connectedUser,
    error: lastError,
    lastMessageError,
    logs: recentActivityLogs.slice(0, 15)
  };
}

/**
 * Borra los archivos de la sesión de WhatsApp en disco
 */
function cleanSessionFiles() {
  if (fs.existsSync(SESSIONS_DIR)) {
    try {
      const files = fs.readdirSync(SESSIONS_DIR);
      for (const file of files) {
        fs.unlinkSync(path.join(SESSIONS_DIR, file));
      }
    } catch (e) {
      console.warn('Advertencia limpiando archivos de sesión:', e.message);
    }
  }
}
