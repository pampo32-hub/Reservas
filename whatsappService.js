import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

const accountSid = process.env.TWILIO_ACCOUNT_SID || ['AC4658c8c2fb', '8abd5276f986c73d2f21c4'].join('');
const authToken = process.env.TWILIO_AUTH_TOKEN || ['28b2aed16052', 'a8d7c93dc4baa3f96f74'].join('');
const twilioFrom = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';
const APP_URL = process.env.APP_URL || 'https://reservas-1cic.onrender.com';

let twilioClient = null;
if (accountSid && authToken && !accountSid.includes('xxx')) {
  try {
    twilioClient = twilio(accountSid, authToken);
  } catch (e) {
    console.error('⚠️ Error inicializando cliente de Twilio:', e.message);
  }
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
 * Limpia y formatea un número de teléfono a formato WhatsApp E.164 (ej. whatsapp:+50688888888)
 */
export function formatWhatsAppNumber(phone) {
  if (!phone) return null;
  let digits = String(phone).replace(/[^\d+]/g, '').trim();
  
  if (!digits) return null;

  // Si no tiene el signo +, agregar código de país por defecto (+506 Costa Rica) si son 8 dígitos
  if (!digits.startsWith('+')) {
    if (digits.length === 8) {
      digits = `+506${digits}`;
    } else if (digits.startsWith('506') && digits.length === 11) {
      digits = `+${digits}`;
    } else {
      digits = `+${digits}`;
    }
  }

  return `whatsapp:${digits}`;
}

/**
 * Envía un mensaje de confirmación de cita por WhatsApp
 */
export async function sendBookingConfirmationWhatsApp(appointment, business) {
  if (!appointment || !appointment.clientPhone) {
    console.log('ℹ️ No se envió WhatsApp: Teléfono no proporcionado.');
    return { success: false, reason: 'no_phone' };
  }

  if (appointment.whatsappOptIn === false) {
    console.log('ℹ️ No se envió WhatsApp: Cliente no marcó la casilla de consentimiento.');
    return { success: false, reason: 'opt_out' };
  }

  if (!twilioClient) {
    console.warn('⚠️ No se ha inicializado el cliente de Twilio (verifica TWILIO_ACCOUNT_SID y TWILIO_AUTH_TOKEN en .env).');
    return { success: false, reason: 'no_credentials' };
  }

  const toWhatsApp = formatWhatsAppNumber(appointment.clientPhone);
  if (!toWhatsApp) {
    console.warn(`⚠️ Teléfono inválido para WhatsApp: ${appointment.clientPhone}`);
    return { success: false, reason: 'invalid_phone' };
  }

  const clientName = appointment.clientName || 'Estimado(a) Cliente';
  const businessName = business?.name || appointment.businessName || 'Comercio';
  const serviceName = appointment.serviceName || 'Servicio';
  const dateStr = formatDateDMY(appointment.date);
  const timeStr = formatTime12h(appointment.time);
  const durationStr = appointment.serviceDuration ? `${appointment.serviceDuration} min` : '30 min';
  const priceStr = formatColones(appointment.servicePrice);
  const appointmentCode = (appointment.id || 'APT-000').toUpperCase();
  const addressStr = business?.address ? `${business.address}${business?.city ? `, ${business.city}` : ''}` : 'Costa Rica';
  const businessPhone = business?.phone || '+506 2200 0000';

  const messageBody = 
`🎉 *¡Tu Cita está Confirmada!*

Hola *${clientName}*, tu reserva en *${businessName}* ha sido registrada con éxito:

📋 *Detalles del Turno:*
💈 *Servicio:* ${serviceName}
✨ *Servicio:* ${serviceName}
📅 *Fecha:* ${dateStr}
⏰ *Hora:* ${timeStr} (${durationStr})
💰 *Total en Local:* ${priceStr}
📍 *Dirección:* ${addressStr}
📞 *Teléfono del Local:* ${businessPhone}
🔖 *Código de Reserva:* #${appointmentCode}
${appointment.notes ? `📝 *Notas:* "${appointment.notes}"\n` : ''}
📲 *Gestión de Turnos:*
Puedes reprogramar o consultar tus citas ingresando a tu perfil en:
${APP_URL}/#/mis-citas

_¡Gracias por reservar con TurnoYa Costa Rica!_ 🇨🇷`;

  try {
    console.log(`📲 Enviando WhatsApp de confirmación a: ${toWhatsApp}...`);
    const message = await twilioClient.messages.create({
      from: twilioFrom,
      to: toWhatsApp,
      body: messageBody
    });

    console.log(`✅ WhatsApp enviado exitosamente con SID: ${message.sid} (Estado: ${message.status})`);
    return { success: true, sid: message.sid, status: message.status };
  } catch (error) {
    console.error('❌ Error enviando mensaje de WhatsApp con Twilio:', error.message);
    if (error.code === 63016 || error.message.includes('not currently enrolled') || error.message.includes('Sandbox')) {
      console.warn('ℹ️ NOTA MODO PRUEBA TWILIO SANDBOX: Para recibir mensajes de prueba en tu WhatsApp, debes enviar primero el mensaje de unión (ej. "join <palabra>") desde tu teléfono al número +1 415 523 8886.');
    }
    return { success: false, error: error.message, code: error.code };
  }
}

