import dotenv from 'dotenv';
import twilio from 'twilio';

dotenv.config();

const APP_URL = process.env.APP_URL || 'https://reservas-1cic.onrender.com';

// Fallback Twilio (si aún no se ha configurado Meta)
const accountSid = process.env.TWILIO_ACCOUNT_SID || '';
const authToken = process.env.TWILIO_AUTH_TOKEN || '';
const twilioFrom = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

let twilioClient = null;
if (accountSid && authToken && !accountSid.includes('xxx')) {
  try {
    twilioClient = twilio(accountSid, authToken);
  } catch (e) {
    console.error('⚠️ Error inicializando cliente fallback de Twilio:', e.message);
  }
}

/**
 * Obtiene las credenciales de Meta activas (Revisa DB Postgres primero, luego variables de entorno)
 */
export async function getActiveMetaCredentials(pool = null) {
  let token = process.env.META_WHATSAPP_TOKEN || process.env.META_TOKEN || process.env.WHATSAPP_TOKEN || process.env.META_ACCESS_TOKEN || '';
  let phoneId = process.env.META_PHONE_NUMBER_ID || process.env.PHONE_NUMBER_ID || process.env.META_PHONE_ID || '';
  let wabaId = process.env.META_WABA_ID || process.env.WABA_ID || '';

  if (pool) {
    try {
      const res = await pool.query("SELECT key, value FROM reservas_system_settings WHERE key IN ('META_WHATSAPP_TOKEN', 'META_PHONE_NUMBER_ID', 'META_WABA_ID')");
      for (const row of res.rows) {
        if (row.key === 'META_WHATSAPP_TOKEN' && row.value?.trim()) token = row.value.trim();
        if (row.key === 'META_PHONE_NUMBER_ID' && row.value?.trim()) phoneId = row.value.trim();
        if (row.key === 'META_WABA_ID' && row.value?.trim()) wabaId = row.value.trim();
      }
    } catch (e) {
      // Ignorar error si la tabla aún no existe
    }
  }

  return {
    token: token.trim(),
    phoneNumberId: phoneId.trim(),
    wabaId: wabaId.trim(),
    isConfigured: Boolean(token.trim() && phoneId.trim())
  };
}

/**
 * Formatea montos en Colones costarricenses (₡)
 */
function formatColones(amount) {
  if (!amount && amount !== 0) return '₡0';
  return `₡${Number(amount).toLocaleString('es-CR')}`;
}

/**
 * Formatea horas en formato 12 horas AM / PM (ej. 3:30 PM)
 */
function formatTime12h(timeStr) {
  if (!timeStr) return 'Hora por confirmar';
  const clean = String(timeStr).trim();
  if (clean.includes('AM') || clean.includes('PM') || clean.includes('am') || clean.includes('pm')) {
    return clean;
  }
  const parts = clean.split(':');
  if (parts.length < 2) return clean;
  let hour = parseInt(parts[0], 10);
  const minute = parts[1].padStart(2, '0');
  if (isNaN(hour)) return clean;
  const period = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${minute} ${period}`;
}

/**
 * Formatea fechas en formato DD/MM/YYYY (ej. 15/09/2026)
 */
function formatDateDMY(dateStr) {
  if (!dateStr) return 'Fecha por confirmar';
  const clean = String(dateStr).trim();
  if (clean.includes('/')) return clean;
  const parts = clean.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
  }
  return clean;
}

/**
 * Limpia y formatea un número a dígitos internacionales para Meta (ej. 50688888888)
 */
export function formatMetaPhone(phone) {
  if (!phone) return null;
  let digits = String(phone).replace(/\D/g, '').trim();
  if (!digits) return null;

  // Si son 8 dígitos de Costa Rica, anteponer el código de país 506
  if (digits.length === 8) {
    digits = `506${digits}`;
  }
  return digits;
}

/**
 * Formato para Twilio (whatsapp:+50688888888)
 */
export function formatWhatsAppNumber(phone) {
  const digits = formatMetaPhone(phone);
  return digits ? `whatsapp:+${digits}` : null;
}

/**
 * Construye el texto completo del mensaje de confirmación
 */
export function buildBookingConfirmationText(appointment, business) {
  const clientName = appointment.clientName || 'Estimado(a) Cliente';
  const businessName = business?.name || appointment.businessName || 'Comercio';
  const serviceName = appointment.serviceName || 'Servicio General';
  const dateStr = formatDateDMY(appointment.date);
  const timeStr = formatTime12h(appointment.time);
  const durationStr = appointment.serviceDuration ? `${appointment.serviceDuration} min` : '30 min';
  const priceStr = formatColones(appointment.servicePrice);
  const appointmentCode = (appointment.id || 'APT-000').toUpperCase();
  const addressStr = business?.address ? `${business.address}${business?.city ? `, ${business.city}` : ''}` : 'Costa Rica';
  const businessPhone = business?.phone || '+506 2200 0000';

  return `🎉 *¡Tu Cita está Confirmada!*

Hola *${clientName}*, tu reserva en *${businessName}* ha sido registrada con éxito:

📋 *Detalles del Turno:*
✨ *Servicio:* ${serviceName}
📅 *Fecha:* ${dateStr}
⏰ *Hora:* ${timeStr} (${durationStr})
💰 *Total en Local:* ${priceStr}
📍 *Dirección:* ${addressStr}
📞 *Teléfono del Local:* ${businessPhone}
🔖 *Código de Reserva:* #${appointmentCode}
${appointment.notes ? `📝 *Notas:* "${appointment.notes}"\n` : ''}
📲 *Gestión de Turnos:*
Puedes consultar tus citas ingresando a:
${APP_URL}/#/mis-citas

_¡Gracias por reservar con Reservas CR!_ 🇨🇷`;
}

/**
 * Envío directo a través de la API oficial de Meta WhatsApp Cloud
 */
export async function sendViaMetaCloudApi(recipientPhone, messageBody, credentials = null) {
  const meta = credentials || await getActiveMetaCredentials();
  if (!meta.token || !meta.phoneNumberId) {
    throw new Error('Credenciales de Meta incompletas (Falta META_WHATSAPP_TOKEN o META_PHONE_NUMBER_ID).');
  }

  const url = `https://graph.facebook.com/v20.0/${meta.phoneNumberId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipientPhone,
    type: 'text',
    text: {
      preview_url: false,
      body: messageBody
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${meta.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok) {
    const errorObj = data?.error || {};
    const errorMessage = errorObj.message || response.statusText;
    const errorCode = errorObj.code;
    const errorSubcode = errorObj.error_subcode;
    throw new Error(`Meta API Error [${errorCode || response.status}]: ${errorMessage} (Subcode: ${errorSubcode || 'none'})`);
  }

  return {
    provider: 'Meta WhatsApp Cloud API',
    messageId: data.messages?.[0]?.id,
    data
  };
}

/**
 * Envío a través de Plantilla (Template) oficial de Meta (Entregado 100% proactivo sin requerir mensaje previo)
 */
export async function sendMetaTemplateMessage(recipientPhone, appointment, business, credentials = null, templateName = 'confirmacion_cita') {
  const meta = credentials || await getActiveMetaCredentials();
  if (!meta.token || !meta.phoneNumberId) {
    throw new Error('Credenciales de Meta incompletas (Falta META_WHATSAPP_TOKEN o META_PHONE_NUMBER_ID).');
  }

  const clientName = String(appointment.clientName || 'Cliente').trim();
  const businessName = String(business?.name || appointment.businessName || 'Comercio').trim();
  const serviceName = String(appointment.serviceName || 'Servicio General').trim();
  const dateStr = formatDateDMY(appointment.date);
  const timeStr = formatTime12h(appointment.time);
  const priceStr = formatColones(appointment.servicePrice);
  const addressStr = String(business?.address ? `${business.address}${business?.city ? `, ${business.city}` : ''}` : 'Costa Rica').trim();
  const appointmentCode = String((appointment.id || 'APT-000').toUpperCase()).trim();

  const url = `https://graph.facebook.com/v20.0/${meta.phoneNumberId}/messages`;
  
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipientPhone,
    type: 'template',
    template: {
      name: templateName,
      language: {
        code: 'es'
      },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: clientName },
            { type: 'text', text: businessName },
            { type: 'text', text: serviceName },
            { type: 'text', text: dateStr },
            { type: 'text', text: timeStr },
            { type: 'text', text: priceStr },
            { type: 'text', text: addressStr },
            { type: 'text', text: appointmentCode }
          ]
        }
      ]
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${meta.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok) {
    const errorObj = data?.error || {};
    const errorCode = errorObj.code || response.status;
    throw new Error(`Meta Template Error [${errorCode}]: ${errorObj.message || response.statusText}`);
  }

  return {
    provider: 'Meta WhatsApp Cloud API (Template)',
    messageId: data.messages?.[0]?.id,
    data
  };
}

/**
 * Envío de confirmación de reserva por WhatsApp
 * (Prioriza Plantilla oficial de Meta, luego Texto Libre de Meta, luego Twilio)
 */
export async function sendBookingConfirmationWhatsApp(appointment, business, pool = null) {
  if (!appointment || !appointment.clientPhone) {
    console.log('ℹ️ No se envió WhatsApp: Teléfono no proporcionado.');
    return { success: false, reason: 'no_phone' };
  }

  if (appointment.whatsappOptIn === false) {
    console.log('ℹ️ No se envió WhatsApp: Cliente no marcó la casilla de consentimiento.');
    return { success: false, reason: 'opt_out' };
  }

  const messageBody = buildBookingConfirmationText(appointment, business);
  const metaRecipient = formatMetaPhone(appointment.clientPhone);

  if (!metaRecipient) {
    console.warn(`⚠️ Teléfono inválido para WhatsApp: ${appointment.clientPhone}`);
    return { success: false, reason: 'invalid_phone' };
  }

  const metaCreds = await getActiveMetaCredentials(pool);

  // 1. INTENTO CON META WHATSAPP CLOUD API
  if (metaCreds.isConfigured) {
    // 1A. Intentar primero con Plantilla Oficial de Utilidad (confirmacion_cita)
    try {
      console.log(`📲 [Meta API] Intentando envío con plantilla 'confirmacion_cita' a +${metaRecipient}...`);
      const templateResult = await sendMetaTemplateMessage(metaRecipient, appointment, business, metaCreds, 'confirmacion_cita');
      console.log(`✅ [Meta API] Plantilla WhatsApp entregada con éxito! ID: ${templateResult.messageId}`);
      return { success: true, provider: 'meta_template', messageId: templateResult.messageId };
    } catch (templateErr) {
      console.warn('ℹ️ Plantilla personalizada no disponible o rechazada por Meta, intentando texto libre / fallback:', templateErr.message);
    }

    // 1B. Si la plantilla aún no está creada, enviar texto libre
    try {
      console.log(`📲 [Meta API] Enviando WhatsApp texto directo a +${metaRecipient}...`);
      const result = await sendViaMetaCloudApi(metaRecipient, messageBody, metaCreds);
      console.log(`✅ [Meta API] WhatsApp texto entregado con ID: ${result.messageId}`);
      return { success: true, provider: 'meta', messageId: result.messageId };
    } catch (metaErr) {
      console.error('❌ Error enviando WhatsApp con Meta Cloud API:', metaErr.message);
      // Si falla Meta, continuar a intentar Twilio si existe
    }
  }

  // 2. FALLBACK CON TWILIO
  if (twilioClient) {
    const toTwilio = formatWhatsAppNumber(appointment.clientPhone);
    try {
      console.log(`📲 [Twilio] Enviando WhatsApp a: ${toTwilio}...`);
      const message = await twilioClient.messages.create({
        from: twilioFrom,
        to: toTwilio,
        body: messageBody
      });
      console.log(`✅ [Twilio] WhatsApp enviado con SID: ${message.sid} (Estado: ${message.status})`);
      return { success: true, provider: 'twilio', sid: message.sid, status: message.status };
    } catch (twilioErr) {
      console.error('❌ Error enviando WhatsApp con Twilio:', twilioErr.message);
      return { success: false, error: twilioErr.message, code: twilioErr.code };
    }
  }

  console.warn('⚠️ No hay credenciales de WhatsApp configuradas (Configura Meta Token y Phone ID en el panel Developer o .env).');
  return { success: false, reason: 'no_credentials' };
}
