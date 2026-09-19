import imapSimple from 'imap-simple';
import { simpleParser } from 'mailparser';
import { pool } from './db.js';
import { parseSinpeEmail } from './src/services/sinpeParser.js';
import dotenv from 'dotenv';

dotenv.config();

let isChecking = false;
let pollingTimer = null;

const getImapConfig = () => {
  const cleanPassword = (process.env.SINPE_EMAIL_PASSWORD || '').replace(/\s+/g, '');
  return {
    imap: {
      user: process.env.SINPE_EMAIL_USER || 'pampo32@gmail.com',
      password: cleanPassword,
      host: process.env.SINPE_IMAP_HOST || 'imap.gmail.com',
      port: parseInt(process.env.SINPE_IMAP_PORT || '993', 10),
      tls: true,
      authTimeout: 10000,
      tlsOptions: { rejectUnauthorized: false }
    }
  };
};

/**
 * Escanea la bandeja de entrada buscando los correos más recientes de notificación SINPE Móvil
 */
export async function checkSinpeEmailsOnce() {
  if (isChecking) return;
  isChecking = true;

  let connection = null;
  try {
    const config = getImapConfig();
    if (!config.imap.password) {
      console.warn('⚠️ [SINPE IMAP] No se ha configurado SINPE_EMAIL_PASSWORD');
      return;
    }

    connection = await imapSimple.connect(config);
    const box = await connection.openBox('INBOX');

    const totalMessages = (box && box.messages && box.messages.total) || 0;
    if (totalMessages === 0) {
      return;
    }

    // Consultamos únicamente los últimos 15 correos por rango de secuencia (ultra rápido)
    const startSeq = Math.max(1, totalMessages - 14);
    const searchCriteria = [`${startSeq}:${totalMessages}`];
    
    const fetchOptions = {
      bodies: ['HEADER', 'TEXT', ''],
      markSeen: false,
      struct: true
    };

    const messages = await connection.search(searchCriteria, fetchOptions);

    if (messages && messages.length > 0) {
      for (const msg of messages) {
        try {
          const headerPart = msg.parts.find(p => p.which === 'HEADER');
          const rawHeader = headerPart ? headerPart.body : {};
          const subject = Array.isArray(rawHeader.subject) ? rawHeader.subject[0] : (rawHeader.subject || '');
          const from = Array.isArray(rawHeader.from) ? rawHeader.from[0] : (rawHeader.from || '');

          const allPart = msg.parts.find(p => p.which === '' || p.which === 'TEXT');
          let bodyText = '';
          let bodyHtml = '';

          if (allPart && allPart.body) {
            const parsed = await simpleParser(allPart.body);
            bodyText = parsed.text || '';
            bodyHtml = parsed.html || '';
          }

          const fullContent = `${subject} ${bodyText} ${from}`.toLowerCase();
          const isBankLike = fullContent.includes('sinpe') || 
                             fullContent.includes('bac') || 
                             fullContent.includes('bncr') || 
                             fullContent.includes('banco') || 
                             fullContent.includes('transferencia') || 
                             fullContent.includes('comprobante') ||
                             fullContent.includes('pase') ||
                             fullContent.includes('wink') ||
                             fullContent.includes('promerica') ||
                             fullContent.includes('scotiabank');

          if (isBankLike) {
            const parsedSinpe = parseSinpeEmail(subject, bodyText, bodyHtml, from);

            if (parsedSinpe.isSinpe && parsedSinpe.amountCrc > 0 && parsedSinpe.referenceNumber) {
              const txId = `sinpe_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
              
              const insertResult = await pool.query(`
                INSERT INTO reservas_sinpe_transactions 
                  (id, reference_number, sender_phone, sender_name, amount_crc, origin_bank, target_phone, detail, status, raw_data, received_at)
                VALUES 
                  ($1, $2, $3, $4, $5, $6, '71433852', $7, 'unclaimed', $8, NOW())
                ON CONFLICT (reference_number) DO UPDATE
                  SET sender_phone = COALESCE(EXCLUDED.sender_phone, reservas_sinpe_transactions.sender_phone),
                      sender_name = COALESCE(EXCLUDED.sender_name, reservas_sinpe_transactions.sender_name),
                      detail = COALESCE(EXCLUDED.detail, reservas_sinpe_transactions.detail)
                RETURNING id, reference_number, amount_crc, status
              `, [
                txId, 
                parsedSinpe.referenceNumber, 
                parsedSinpe.senderPhone, 
                parsedSinpe.senderName, 
                parsedSinpe.amountCrc, 
                parsedSinpe.originBank, 
                parsedSinpe.detail, 
                JSON.stringify({ from, subject, summary: parsedSinpe.rawSummary })
              ]);

              if (insertResult.rowCount > 0) {
                console.log(`💵 [SINPE IMAP] Notificación registrada: ₡${parsedSinpe.amountCrc} de ${parsedSinpe.senderName} (${parsedSinpe.senderPhone}) | Ref: #${parsedSinpe.referenceNumber} | Banco: ${parsedSinpe.originBank}`);
              }
            }
          }
        } catch (msgErr) {
          console.warn('⚠️ [SINPE IMAP] Error procesando mensaje:', msgErr.message);
        }
      }
    }
  } catch (error) {
    console.error('❌ [SINPE IMAP] Error al conectar/revisar buzón Gmail:', error.message);
  } finally {
    if (connection) {
      try {
        connection.end();
      } catch (e) {}
    }
    isChecking = false;
  }
}

/**
 * Inicia el polling recurrente del servicio IMAP
 * @param {number} intervalMs Intervalo en milisegundos (por defecto 15 segundos)
 */
export function startSinpeImapWorker(intervalMs = 15000) {
  console.log(`🚀 [SINPE IMAP] Lector automático de SINPE iniciado (revisión cada ${intervalMs / 1000}s)`);
  
  checkSinpeEmailsOnce();

  if (pollingTimer) clearInterval(pollingTimer);
  pollingTimer = setInterval(() => {
    checkSinpeEmailsOnce();
  }, intervalMs);
}

export function stopSinpeImapWorker() {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
    console.log('🛑 [SINPE IMAP] Servicio de lectura detenido.');
  }
}
