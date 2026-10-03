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
let dbPool = null;
let isStarting = false;

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
          // Ignorar mensajes enviados por nosotros mismos o de grupos
          if (m.key.fromMe) continue;
          if (!m.message) continue;
          if (m.key.remoteJid === 'status@broadcast') continue;
          if (m.key.remoteJid.endsWith('@g.us')) continue; // Solo chats directos 1 a 1

          const text = (
            m.message.conversation || 
            m.message.extendedTextMessage?.text || 
            m.message.imageMessage?.caption || 
            ''
          ).trim();

          if (!text) continue;

          const remoteJid = m.key.remoteJid;
          const senderPhone = remoteJid.replace(/@.*$/, '').replace(/:.*$/, '');
          const senderName = m.pushName || 'Cliente';

          console.log(`📥 [WhatsApp QR] Mensaje de ${senderName} (+${senderPhone}): "${text}"`);

          // Extraer posible ID o nombre de comercio del mensaje si viene desde un enlace web
          let businessId = null;
          const bizRefMatch = text.match(/\[(?:Ref|ID):\s*([a-zA-Z0-9_\-]+)\]/i);
          if (bizRefMatch && bizRefMatch[1]) {
            businessId = bizRefMatch[1].trim();
          }

          // Indicar "Escribiendo..." en el chat de WhatsApp
          try {
            await sock.sendPresenceUpdate('composing', remoteJid);
          } catch (_) {}

          // Procesar con la IA de Gemini conectada a PostgreSQL
          const aiResponse = await processCustomerMessageWithGemini(dbPool, {
            businessId,
            customerPhone: senderPhone,
            customerName: senderName,
            messageText: text
          });

          // Pequeña pausa de 1.2 segundos para simular respuesta humana natural
          await new Promise(r => setTimeout(r, 1200));

          if (aiResponse?.reply) {
            await sock.sendMessage(remoteJid, { text: aiResponse.reply });
            console.log(`📤 [WhatsApp QR] Respuesta IA enviada a +${senderPhone}`);
          }

          try {
            await sock.sendPresenceUpdate('paused', remoteJid);
          } catch (_) {}

        } catch (msgErr) {
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
    error: lastError
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
