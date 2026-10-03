import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

const brevoApiKey = process.env.BREVO_API_KEY || '';
const DEFAULT_FROM_EMAIL = process.env.BREVO_FROM_EMAIL || 'notificaciones@reservascr.app';
const DEFAULT_FROM_NAME = process.env.BREVO_FROM_NAME || 'Reservas CR';
const DEFAULT_FROM = `${DEFAULT_FROM_NAME} <${DEFAULT_FROM_EMAIL}>`;

const resendApiKey = process.env.RESEND_API_KEY || '';
const resend = resendApiKey ? new Resend(resendApiKey) : null;
const APP_URL = process.env.APP_URL || 'https://reservascr.app';
export const ADMIN_NOTIFICATION_EMAILS = (process.env.ADMIN_NOTIFICATION_EMAIL 
  ? process.env.ADMIN_NOTIFICATION_EMAIL.split(',') 
  : ['reservascr.app@gmail.com', 'pampo32@gmail.com']
).map(e => e.trim()).filter(Boolean);

export const ADMIN_NOTIFICATION_EMAIL = ADMIN_NOTIFICATION_EMAILS.join(', ');

/**
 * Motor central de envío de correos (Brevo API REST con fallback a Resend)
 */
export async function sendEmailCore({ to, subject, html, fromName = DEFAULT_FROM_NAME, fromEmail = DEFAULT_FROM_EMAIL }) {
  const recipients = (Array.isArray(to) ? to : [to])
    .map(email => String(email || '').trim())
    .filter(email => email.includes('@'));

  if (recipients.length === 0) {
    return { success: false, reason: 'no_valid_recipient' };
  }

  // 1. Envío prioritario con Brevo REST API (HTTPS puerto 443)
  if (brevoApiKey) {
    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': brevoApiKey,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          sender: { name: fromName, email: fromEmail },
          to: recipients.map(email => ({ email })),
          subject: subject,
          htmlContent: html
        })
      });

      const data = await response.json();
      if (response.ok && data?.messageId) {
        console.log(`✅ [Brevo] Correo entregado exitosamente a ${recipients.join(', ')} (ID: ${data.messageId})`);
        return { success: true, data: { id: data.messageId, provider: 'brevo' } };
      } else {
        console.warn(`⚠️ [Brevo] Error o aviso en envío (${response.status}):`, data?.message || data);
      }
    } catch (err) {
      console.error('❌ [Brevo] Excepción en llamada HTTP:', err.message);
    }
  }

  // 2. Fallback a Resend si Brevo no está configurado o falla
  if (resend) {
    try {
      const { data, error } = await resend.emails.send({
        from: `${fromName} <onboarding@resend.dev>`,
        to: recipients,
        subject: subject,
        html: html
      });
      if (!error && data?.id) {
        console.log(`✅ [Resend] Correo enviado exitosamente (ID: ${data.id})`);
        return { success: true, data: { id: data.id, provider: 'resend' } };
      }
      if (error) {
        console.warn('⚠️ [Resend] Error:', error.message || error);
        return { success: false, error };
      }
    } catch (err) {
      console.error('❌ [Resend] Excepción:', err.message);
      return { success: false, error: err.message };
    }
  }

  return { success: false, reason: 'no_email_service_available' };
}

/**
 * Formatea montos en Colones costarricenses (₡)
 */
function formatColones(amount) {
  if (!amount && amount !== 0) return '₡0';
  return `₡${Number(amount).toLocaleString('es-CR')}`;
}

/**
 * Formatea horas en formato 12 horas AM / PM (ej. 3:00 PM)
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
 * Normaliza y formatea un teléfono para enlaces directos de WhatsApp
 */
export function formatWhatsAppPhone(phone) {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '').trim();
  if (!digits) return '';

  while (digits.startsWith('506506')) {
    digits = digits.slice(3);
  }

  if (digits.startsWith('506') && digits.length >= 11) {
    return digits;
  }

  if (digits.length === 8) {
    return '506' + digits;
  }

  return digits;
}

/**
 * Envía correo de confirmación de reserva al cliente
 */
export async function sendBookingConfirmationEmail(appointment, business) {
  if (!appointment || !appointment.clientEmail || !appointment.clientEmail.includes('@')) {
    console.log(`ℹ️ No se envió correo: Cliente no proporcionó email válido (${appointment?.clientEmail || 'vacío'}).`);
    return { success: false, reason: 'no_email' };
  }

  if (!brevoApiKey && !resend) {
    console.warn('⚠️ No se ha configurado ningún servicio de correo (BREVO_API_KEY o RESEND_API_KEY).');
    return { success: false, reason: 'no_api_key' };
  }

  const clientName = appointment.clientName || 'Estimado(a) Cliente';
  const businessName = business?.name || appointment.businessName || 'Comercio Asociado';
  const serviceName = appointment.serviceName || 'Servicio';
  const dateStr = formatDateDMY(appointment.date);
  const timeStr = formatTime12h(appointment.time);
  const durationStr = appointment.serviceDuration ? `${appointment.serviceDuration} min` : '30 min';
  const priceStr = formatColones(appointment.servicePrice);
  const appointmentCode = (appointment.id || 'APT-000').toUpperCase();
  const businessAddress = business?.address ? `${business.address}${business?.city ? `, ${business.city}` : ''}` : 'Costa Rica';
  const businessPhone = business?.phone || '+506 2200 0000';

  const depositPaid = Boolean(appointment.depositPaid || appointment.deposit_paid);
  const depositAmount = parseFloat(appointment.depositAmount || appointment.deposit_amount || 0);
  const totalAmount = parseFloat(appointment.servicePrice || 0);
  const remainingAmount = Math.max(0, totalAmount - depositAmount);
  const policiesText = appointment.depositPoliciesSnapshot || appointment.deposit_policies_snapshot || '';

  // Generación de Enlaces de Calendario y Rutas de Navegación
  const pad = (n) => String(n).padStart(2, '0');
  const formatCalDate = (dt) => `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}00`;
  const [y, m, d] = String(appointment.date).split('-').map(Number);
  let hh = 9, mm = 0;
  if (appointment.time) {
    const isPM = /pm/i.test(appointment.time);
    const isAM = /am/i.test(appointment.time);
    const cleanTime = String(appointment.time).replace(/[^0-9:]/g, '');
    const parts = cleanTime.split(':').map(Number);
    if (parts.length >= 1 && !isNaN(parts[0])) {
      hh = parts[0];
      if (isPM && hh < 12) hh += 12;
      if (isAM && hh === 12) hh = 0;
    }
    if (parts.length >= 2 && !isNaN(parts[1])) mm = parts[1];
  }
  const duration = parseInt(appointment.serviceDuration || 30, 10);
  const startDt = new Date(y, m - 1, d, hh, mm, 0);
  const endDt = new Date(startDt.getTime() + duration * 60000);
  const datesStr = `${formatCalDate(startDt)}/${formatCalDate(endDt)}`;

  const calTitle = `Cita: ${serviceName} en ${businessName}`;
  const calLocation = `${businessName}, ${businessAddress}`;
  const calDetails = `Turno agendado en ${businessName}\nServicio: ${serviceName}\nCódigo: #${appointmentCode}\nDirección: ${businessAddress}\nTeléfono: ${businessPhone}\nGestionado por Reservas CR (https://reservascr.app)`;

  const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(calTitle)}&dates=${datesStr}&ctz=America/Costa_Rica&details=${encodeURIComponent(calDetails)}&location=${encodeURIComponent(calLocation)}`;
  const icsDownloadUrl = `${APP_URL}/api/appointments/${appointment.id || appointmentCode}/calendar.ics`;
  
  const navQuery = [businessName, businessAddress, 'Costa Rica'].filter(Boolean).join(', ');
  const wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(navQuery)}&navigate=yes`;
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(navQuery)}`;

  const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmación de Reserva</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 0; }
    .container { max-width: 580px; margin: 20px auto; background-color: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 32px 24px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
    .header p { margin: 6px 0 0 0; font-size: 13px; opacity: 0.9; }
    .badge { display: inline-block; background-color: rgba(255,255,255,0.2); padding: 6px 14px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-top: 12px; letter-spacing: 0.5px; }
    .content { padding: 30px 24px; }
    .greeting { font-size: 16px; font-weight: 600; color: #0f172a; margin-bottom: 8px; }
    .message { font-size: 14px; color: #475569; line-height: 1.5; margin-bottom: 24px; }
    .card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; margin-bottom: 20px; }
    .card-title { font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 14px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
    .whatsapp-badge { background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 12px 16px; font-size: 12px; color: #065f46; margin-bottom: 20px; display: flex; align-items: center; }
    .policy-box { background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 14px; padding: 14px 16px; margin-bottom: 20px; font-size: 12px; color: #475569; line-height: 1.5; }
    .btn-container { text-align: center; margin: 26px 0 10px 0; }
    .btn { display: inline-block; background-color: #2563eb; color: #ffffff !important; font-weight: 700; font-size: 14px; padding: 14px 28px; border-radius: 12px; text-decoration: none; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25); }
    .footer { background-color: #f1f5f9; padding: 20px 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>¡Tu Reserva está Confirmada!</h1>
      <p>Gracias por agendar con Reservas Costa Rica</p>
      <div class="badge">Código: #${appointmentCode}</div>
    </div>
    
    <div class="content">
      <div class="greeting">¡Hola, ${clientName}! 👋</div>
      <div class="message">
        Tu turno ha sido confirmado exitosamente en <strong>${businessName}</strong>. A continuación encontrarás todos los detalles de tu reserva:
      </div>

      <div class="card">
        <div class="card-title">Resumen del Turno</div>
        
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 6px 0; color: #64748b;">Establecimiento:</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 700; color: #0f172a;">${businessName}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 6px 0; color: #64748b;">Servicio:</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 700; color: #0f172a;">${serviceName}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 6px 0; color: #64748b;">Fecha:</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 700; color: #2563eb;">📅 ${dateStr}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 6px 0; color: #64748b;">Hora:</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 700; color: #2563eb;">⏰ ${timeStr} (${durationStr})</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 6px 0; color: #64748b;">Dirección:</td>
            <td style="padding: 6px 0; text-align: right; color: #334155;">📍 ${businessAddress}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 6px 0; color: #64748b;">Teléfono del Local:</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #334155;">📞 ${businessPhone}</td>
          </tr>
          ${appointment.notes ? `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 6px 0; color: #64748b;">Notas:</td>
            <td style="padding: 6px 0; text-align: right; font-style: italic; color: #64748b;">"${appointment.notes}"</td>
          </tr>
          ` : ''}
          ${depositPaid && depositAmount > 0 ? `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 6px 0; color: #64748b;">Total del Servicio:</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 700; color: #0f172a;">${formatColones(totalAmount)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 6px 0; color: #059669; font-weight: 700;">Adelanto SINPE Verificado:</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 800; color: #059669;">✓ ${formatColones(depositAmount)} pagado</td>
          </tr>
          <tr>
            <td style="padding: 10px 0 4px 0; font-weight: 800; color: #0f172a;">Saldo restante a pagar en el local:</td>
            <td style="padding: 10px 0 4px 0; text-align: right; font-size: 15px; font-weight: 900; color: #2563eb;">${formatColones(remainingAmount)}</td>
          </tr>
          ` : `
          <tr>
            <td style="padding: 12px 0 4px 0; font-weight: 700; color: #0f172a;">Total a pagar en local:</td>
            <td style="padding: 12px 0 4px 0; text-align: right; font-size: 16px; font-weight: 900; color: #059669;">${priceStr}</td>
          </tr>
          `}
        </table>
      <!-- Acciones Rápidas: Calendario y Navegación Waze / Maps -->
      <div style="background: #f8fafc; border-radius: 16px; padding: 18px; margin-bottom: 20px; border: 1px solid #e2e8f0;">
        <div style="font-size: 12px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">
          📅 Añadir a tu Calendario Personal
        </div>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
          <tr>
            <td style="width: 50%; padding-right: 5px;">
              <a href="${googleCalendarUrl}" target="_blank" style="display: block; background: #ffffff; border: 1px solid #cbd5e1; color: #1e293b; text-decoration: none; font-weight: 700; font-size: 12px; padding: 10px 8px; border-radius: 10px; text-align: center; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                <span style="color: #ea4335; font-weight: 900;">G</span> Google Calendar
              </a>
            </td>
            <td style="width: 50%; padding-left: 5px;">
              <a href="${icsDownloadUrl}" target="_blank" style="display: block; background: #ffffff; border: 1px solid #cbd5e1; color: #1e293b; text-decoration: none; font-weight: 700; font-size: 12px; padding: 10px 8px; border-radius: 10px; text-align: center; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                🍏 Apple / Outlook (.ics)
              </a>
            </td>
          </tr>
        </table>

        <div style="font-size: 12px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">
          🚗 ¿Cómo llegar a tu cita? (Ruta en Vivo)
        </div>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="width: 50%; padding-right: 5px;">
              <a href="${wazeUrl}" target="_blank" style="display: block; background: #0284c7; color: #ffffff !important; text-decoration: none; font-weight: 700; font-size: 12px; padding: 10px 8px; border-radius: 10px; text-align: center; box-shadow: 0 2px 6px rgba(2, 132, 199, 0.25);">
                🚗 Abrir en Waze
              </a>
            </td>
            <td style="width: 50%; padding-left: 5px;">
              <a href="${googleMapsUrl}" target="_blank" style="display: block; background: #059669; color: #ffffff !important; text-decoration: none; font-weight: 700; font-size: 12px; padding: 10px 8px; border-radius: 10px; text-align: center; box-shadow: 0 2px 6px rgba(5, 150, 105, 0.25);">
                📍 Google Maps
              </a>
            </td>
          </tr>
        </table>
      </div>

      ${policiesText ? `
      <div class="policy-box">
        <strong style="color: #0f172a; display: block; margin-bottom: 6px;">📜 Políticas de Cancelación y Reprogramación del Negocio:</strong>
        <div style="white-space: pre-line;">${policiesText}</div>
      </div>
      ` : ''}

      <div class="whatsapp-badge">
        <span>📲 <strong>Notificaciones y Recordatorios:</strong> Hemos activado tu cita. Recibirás recordatorios previos a tu turno.</span>
      </div>

      <div class="btn-container">
        <a href="${APP_URL}/#/mis-reservas" class="btn">Ver Mis Reservas en Línea</a>
      </div>
    </div>

    <div class="footer">
      <p style="margin: 0 0 6px 0;">Este es un mensaje automático de confirmación generado por el sistema de Reservas de Costa Rica.</p>
      <p style="margin: 0;">¿Necesitas reprogramar o cancelar? Ingresa a tu perfil con tu número telefónico.</p>
    </div>
  </div>
</body>
</html>
  `;

  try {
    console.log(`📧 Enviando correo de confirmación a: ${appointment.clientEmail}...`);
    return await sendEmailCore({
      to: appointment.clientEmail,
      subject: `✅ Cita Confirmada en ${businessName} (Código: #${appointmentCode})`,
      html: htmlContent
    });
  } catch (err) {
    console.error('❌ Error inesperado enviando correo de confirmación:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Envía correo preliminar al cliente cuando envía una solicitud de reserva con adelanto por SINPE Móvil
 */
export async function sendBookingPendingDepositEmail(appointment, business) {
  if (!appointment || !appointment.clientEmail || !appointment.clientEmail.includes('@')) {
    return { success: false, reason: 'no_email' };
  }

  const clientName = appointment.clientName || 'Estimado(a) Cliente';
  const businessName = business?.name || appointment.businessName || 'Comercio Asociado';
  const serviceName = appointment.serviceName || 'Servicio';
  const dateStr = formatDateDMY(appointment.date);
  const timeStr = formatTime12h(appointment.time);
  const durationStr = appointment.serviceDuration ? `${appointment.serviceDuration} min` : '30 min';
  const appointmentCode = (appointment.id || 'APT-000').toUpperCase();
  const businessAddress = business?.address ? `${business.address}${business?.city ? `, ${business.city}` : ''}` : 'Costa Rica';
  const businessPhone = business?.phone || '+506 2200 0000';

  const depositPercentage = parseInt(appointment.depositPercentage || business?.depositPercentage || business?.deposit_percentage || 25, 10);
  const depositAmount = parseFloat(appointment.depositAmount || appointment.deposit_amount || 0);
  const totalAmount = parseFloat(appointment.servicePrice || 0);
  const remainingAmount = Math.max(0, totalAmount - depositAmount);
  const sinpePhone = business?.sinpePhone || business?.sinpe_phone || businessPhone;
  const sinpeHolder = business?.sinpeHolderName || business?.sinpe_holder_name || businessName;
  const depositRef = appointment.depositReference || appointment.deposit_reference || '';
  const policiesText = appointment.depositPoliciesSnapshot || appointment.deposit_policies_snapshot || '';

  const navQuery = [businessName, businessAddress, 'Costa Rica'].filter(Boolean).join(', ');
  const wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(navQuery)}&navigate=yes`;
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(navQuery)}`;

  const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Solicitud de Reserva Recibida</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 0; }
    .container { max-width: 580px; margin: 20px auto; background-color: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { background: linear-gradient(135deg, #d97706, #b45309); padding: 32px 24px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
    .header p { margin: 6px 0 0 0; font-size: 13px; opacity: 0.9; }
    .badge { display: inline-block; background-color: rgba(255,255,255,0.25); padding: 6px 14px; border-radius: 20px; font-size: 11px; font-weight: 800; text-transform: uppercase; margin-top: 12px; letter-spacing: 0.5px; }
    .content { padding: 30px 24px; }
    .greeting { font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 8px; }
    .message { font-size: 14px; color: #475569; line-height: 1.5; margin-bottom: 20px; }
    .status-alert { background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 16px; padding: 16px; margin-bottom: 20px; color: #92400e; font-size: 13px; line-height: 1.5; }
    .card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; margin-bottom: 20px; }
    .card-title { font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 14px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
    .policy-box { background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 14px; padding: 14px 16px; margin-bottom: 20px; font-size: 12px; color: #475569; line-height: 1.5; }
    .footer { background-color: #f1f5f9; padding: 20px 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Solicitud de Cita Recibida 🇨🇷</h1>
      <p>Pendiente de validación de adelanto por SINPE Móvil</p>
      <div class="badge">Código: #${appointmentCode}</div>
    </div>
    
    <div class="content">
      <div class="greeting">¡Hola, ${clientName}! 👋</div>
      <div class="message">
        Hemos recibido tu solicitud para agendar un turno en <strong>${businessName}</strong>. Tu horario se encuentra <strong>temporalmente apartado</strong> mientras el establecimiento valida la recepción de tu adelanto.
      </div>

      <div class="status-alert">
        <strong style="display: block; margin-bottom: 4px;">⏳ Próximo Paso:</strong>
        El comercio validará el depósito de <strong>${formatColones(depositAmount)}</strong> al SINPE Móvil <strong>${sinpePhone}</strong> (${sinpeHolder}). En cuanto lo confirme, recibirás un mensaje de WhatsApp y correo oficial con la cita 100% confirmada.
        ${depositRef ? `<br><span style="font-size: 11px; opacity: 0.9;">Comprobante reportado: <strong>#${depositRef}</strong></span>` : ''}
      </div>

      <div class="card">
        <div class="card-title">Detalles de la Cita Solicitada</div>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 6px 0; color: #64748b;">Establecimiento:</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 700; color: #0f172a;">${businessName}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 6px 0; color: #64748b;">Servicio:</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 700; color: #0f172a;">${serviceName}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 6px 0; color: #64748b;">Fecha y Hora:</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 700; color: #d97706;">📅 ${dateStr} a las ${timeStr}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 6px 0; color: #64748b;">Total del Servicio:</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 700; color: #0f172a;">${formatColones(totalAmount)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 6px 0; color: #d97706; font-weight: 700;">Adelanto Requerido (${depositPercentage}%):</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 800; color: #d97706;">${formatColones(depositAmount)}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0 4px 0; font-weight: 700; color: #64748b;">Saldo a pagar en local:</td>
            <td style="padding: 10px 0 4px 0; text-align: right; font-weight: 800; color: #0f172a;">${formatColones(remainingAmount)}</td>
          </tr>
        </table>
      <!-- ¿Cómo llegar? (Ruta Waze / Maps) -->
      <div style="background: #f8fafc; border-radius: 16px; padding: 18px; margin-bottom: 20px; border: 1px solid #e2e8f0;">
        <div style="font-size: 12px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">
          🚗 ¿Cómo llegar al local? (Ruta en Vivo)
        </div>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="width: 50%; padding-right: 5px;">
              <a href="${wazeUrl}" target="_blank" style="display: block; background: #0284c7; color: #ffffff !important; text-decoration: none; font-weight: 700; font-size: 12px; padding: 10px 8px; border-radius: 10px; text-align: center; box-shadow: 0 2px 6px rgba(2, 132, 199, 0.25);">
                🚗 Abrir en Waze
              </a>
            </td>
            <td style="width: 50%; padding-left: 5px;">
              <a href="${googleMapsUrl}" target="_blank" style="display: block; background: #059669; color: #ffffff !important; text-decoration: none; font-weight: 700; font-size: 12px; padding: 10px 8px; border-radius: 10px; text-align: center; box-shadow: 0 2px 6px rgba(5, 150, 105, 0.25);">
                📍 Google Maps
              </a>
            </td>
          </tr>
        </table>
      </div>

      ${policiesText ? `
      <div class="policy-box">
        <strong style="color: #0f172a; display: block; margin-bottom: 6px;">📜 Políticas de Cancelación y Reprogramación:</strong>
        <div style="white-space: pre-line;">${policiesText}</div>
      </div>
      ` : ''}

      <div style="text-align: center; margin: 24px 0 8px 0;">
        <p style="font-size: 12px; color: #64748b; margin: 0;">¿Tienes dudas sobre tu transferencia? Puedes comunicarte al <strong>${businessPhone}</strong>.</p>
      </div>
    </div>

    <div class="footer">
      <p style="margin: 0 0 6px 0;">Notificación automática de solicitud de turno - Reservas Costa Rica 🇨🇷</p>
      <p style="margin: 0;">Ningún cargo final se procesa hasta que el negocio apruebe tu cita.</p>
    </div>
  </div>
</body>
</html>
  `;

  try {
    console.log(`📧 Enviando correo de solicitud pendiente de adelanto a: ${appointment.clientEmail}...`);
    return await sendEmailCore({
      to: appointment.clientEmail,
      subject: `⏳ Solicitud Recibida en ${businessName} - Pendiente Validación SINPE (Código: #${appointmentCode})`,
      html: htmlContent
    });
  } catch (err) {
    console.error('❌ Error enviando correo de solicitud pendiente:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Envía correo solicitando calificación y reseña verificada al cliente (1 hora post-servicio)
 */
export async function sendReviewRequestEmail(appointment, business) {
  if (!appointment || !appointment.clientEmail || !appointment.clientEmail.includes('@')) {
    console.log(`ℹ️ No se envió correo de valoración: Cliente sin email válido (${appointment?.clientEmail || 'vacío'}).`);
    return { success: false, reason: 'no_email' };
  }

  if (!brevoApiKey && !resend) {
    console.warn('⚠️ No se ha configurado ningún servicio de correo (BREVO_API_KEY o RESEND_API_KEY).');
    return { success: false, reason: 'no_api_key' };
  }

  const clientName = appointment.clientName || 'Estimado(a) Cliente';
  const businessName = business?.name || appointment.businessName || 'el establecimiento';
  const serviceName = appointment.serviceName || 'tu servicio';
  const appointmentCode = (appointment.id || 'APT-000').toUpperCase();
  const dateStr = formatDateDMY(appointment.date);
  const reviewUrlBase = `${APP_URL}/#/calificar/${appointment.id}`;

  const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>¿Cómo fue tu experiencia?</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 0; }
    .container { max-width: 580px; margin: 20px auto; background-color: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { background: linear-gradient(135deg, #1e293b, #0f172a); padding: 32px 24px; text-align: center; color: #ffffff; }
    .header .stars-top { font-size: 28px; margin-bottom: 6px; letter-spacing: 4px; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
    .header p { margin: 6px 0 0 0; font-size: 13px; color: #94a3b8; }
    .content { padding: 32px 24px; }
    .greeting { font-size: 16px; font-weight: 600; color: #0f172a; margin-bottom: 8px; }
    .message { font-size: 14px; color: #475569; line-height: 1.6; margin-bottom: 24px; }
    .card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 18px; margin-bottom: 24px; text-align: center; }
    .card-service { font-size: 15px; font-weight: 800; color: #0f172a; margin-bottom: 4px; }
    .card-biz { font-size: 13px; color: #2563eb; font-weight: 700; margin-bottom: 4px; }
    .card-date { font-size: 12px; color: #64748b; }
    .stars-selector { text-align: center; margin: 28px 0; }
    .stars-title { font-size: 13px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
    .stars-container { display: inline-flex; gap: 8px; justify-content: center; }
    .star-btn { display: inline-block; text-decoration: none; font-size: 32px; line-height: 1; transition: transform 0.2s; padding: 6px; }
    .star-btn:hover { transform: scale(1.2); }
    .badge-verified { display: inline-flex; align-items: center; gap: 6px; background-color: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8; padding: 6px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; margin-top: 14px; }
    .btn-container { text-align: center; margin: 24px 0 10px 0; }
    .btn { display: inline-block; background-color: #2563eb; color: #ffffff !important; font-weight: 700; font-size: 14px; padding: 14px 32px; border-radius: 12px; text-decoration: none; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25); }
    .footer { background-color: #f1f5f9; padding: 20px 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="stars-top">⭐⭐⭐⭐⭐</div>
      <h1>¿Cómo estuvo tu atención?</h1>
      <p>Tu opinión nos ayuda a mantener la mejor calidad en Costa Rica</p>
    </div>
    
    <div class="content">
      <div class="greeting">¡Hola, ${clientName}! 👋</div>
      <div class="message">
        Esperamos que hayas tenido una excelente experiencia con tu servicio de <strong>${serviceName}</strong> en <strong>${businessName}</strong>.
        ¿Nos regalas 30 segundos para contarnos cómo te fue?
      </div>

      <div class="card">
        <div class="card-biz">${businessName}</div>
        <div class="card-service">✨ ${serviceName}</div>
        <div class="card-date">Fecha de atención: ${dateStr} • Reserva #${appointmentCode}</div>
        <div>
          <span class="badge-verified">🛡️ Reseña Verificada por Reserva Real</span>
        </div>
      </div>

      <div class="stars-selector">
        <div class="stars-title">Toca una estrella para calificar:</div>
        <div class="stars-container">
          <a href="${reviewUrlBase}?rating=1" class="star-btn" title="1 estrella - Malo">⭐</a>
          <a href="${reviewUrlBase}?rating=2" class="star-btn" title="2 estrellas - Regular">⭐</a>
          <a href="${reviewUrlBase}?rating=3" class="star-btn" title="3 estrellas - Bueno">⭐</a>
          <a href="${reviewUrlBase}?rating=4" class="star-btn" title="4 estrellas - Muy Bueno">⭐</a>
          <a href="${reviewUrlBase}?rating=5" class="star-btn" title="5 estrellas - ¡Excelente!">⭐</a>
        </div>
      </div>

      <div class="btn-container">
        <a href="${reviewUrlBase}?rating=5" class="btn">⭐ Dejar mi Opinión y Comentario</a>
      </div>
    </div>

    <div class="footer">
      <p style="margin: 0 0 6px 0;">Solo los clientes que completaron una reserva real pueden dejar reseñas verificadas.</p>
      <p style="margin: 0;">Plataforma de Reservas de Costa Rica 🇨🇷</p>
    </div>
  </div>
</body>
</html>
  `;

  try {
    console.log(`⭐ Enviando correo de solicitud de calificación a: ${appointment.clientEmail}...`);
    return await sendEmailCore({
      to: appointment.clientEmail,
      subject: `⭐ ¿Cómo fue tu experiencia en ${businessName}? Califica tu experiencia`,
      html: htmlContent
    });
  } catch (err) {
    console.error('❌ Error enviando correo de calificación:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Envía correo con código de recuperación de contraseña
 */
export async function sendPasswordResetEmail({ to, code, name = 'Usuario', userType = 'client' }) {
  if (!to || !to.includes('@')) {
    console.log(`ℹ️ No se envió correo de restablecimiento: email inválido (${to || 'vacío'}).`);
    return { success: false, reason: 'invalid_email' };
  }

  if (!brevoApiKey && !resend) {
    console.warn('⚠️ No se ha configurado ningún servicio de correo (BREVO_API_KEY o RESEND_API_KEY).');
    return { success: false, reason: 'resend_not_configured' };
  }

  const roleLabel = userType === 'business' ? 'tu cuenta de Negocio' : 'tu cuenta de Cliente';

  const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Código de Recuperación de Contraseña</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      color: #1e293b;
      margin: 0;
      padding: 24px 12px;
    }
    .container {
      max-width: 520px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.08);
      border: 1px solid #e2e8f0;
    }
    .header {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: #ffffff;
      padding: 32px 24px;
      text-align: center;
    }
    .badge {
      display: inline-block;
      padding: 6px 14px;
      background: #3b82f6;
      color: #ffffff;
      font-size: 11px;
      font-weight: 800;
      border-radius: 20px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 12px;
    }
    .title {
      font-size: 22px;
      font-weight: 900;
      margin: 0;
      letter-spacing: -0.5px;
    }
    .content {
      padding: 32px 24px;
    }
    .greeting {
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 12px;
    }
    .message {
      font-size: 14px;
      line-height: 1.6;
      color: #475569;
      margin-bottom: 24px;
    }
    .code-box {
      background: #f1f5f9;
      border: 2px dashed #94a3b8;
      border-radius: 18px;
      padding: 24px 16px;
      text-align: center;
      margin: 24px 0;
    }
    .code-label {
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      color: #64748b;
      letter-spacing: 1px;
      margin-bottom: 8px;
    }
    .code-digits {
      font-size: 36px;
      font-weight: 900;
      letter-spacing: 8px;
      color: #0f172a;
      font-family: 'Courier New', Courier, monospace;
      display: inline-block;
    }
    .code-expiry {
      font-size: 12px;
      font-weight: 600;
      color: #ef4444;
      margin-top: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
    }
    .security-notice {
      background: #fef2f2;
      border-left: 4px solid #ef4444;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 12px;
      color: #991b1b;
      line-height: 1.5;
      margin-top: 24px;
    }
    .footer {
      background: #f8fafc;
      padding: 20px 24px;
      text-align: center;
      font-size: 11px;
      color: #94a3b8;
      border-top: 1px solid #e2e8f0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="badge">Seguridad Reservas CR</div>
      <h1 class="title">Recuperación de Contraseña</h1>
    </div>

    <div class="content">
      <div class="greeting">¡Hola, ${name}! 👋</div>
      <div class="message">
        Recibimos una solicitud para restablecer la contraseña de ${roleLabel} en <strong>Reservas Costa Rica 🇨🇷</strong>.
      </div>

      <div class="code-box">
        <div class="code-label">Tu Código de Verificación</div>
        <div class="code-digits">${code}</div>
        <div class="code-expiry">⏱️ Este código vence en 15 minutos</div>
      </div>

      <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
        Ingresa este código de 6 dígitos en la pantalla de recuperación de la plataforma para crear tu nueva contraseña.
      </p>

      <div class="security-notice">
        <strong>¿No solicitaste este cambio?</strong> Si no realizaste esta solicitud, puedes ignorar este correo con tranquilidad. Tu contraseña actual sigue estando protegida.
      </div>
    </div>

    <div class="footer">
      <p style="margin: 0 0 4px 0;">Plataforma de Reservas de Costa Rica 🇨🇷</p>
      <p style="margin: 0;">Este es un mensaje automático de seguridad. Por favor no respondas a este correo.</p>
    </div>
  </div>
</body>
</html>
  `;

  try {
    console.log(`🔐 Enviando correo de restablecimiento de contraseña a: ${to}...`);
    return await sendEmailCore({
      to: to,
      subject: `🔐 ${code} es tu código de recuperación de contraseña - Reservas CR`,
      html: htmlContent
    });
  } catch (err) {
    console.error('❌ Error enviando correo de recuperación:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Envía correo con código de verificación (OTP) para registro de negocio
 */
export async function sendBusinessEmailVerificationCode({ to, name = '', businessName = '', code }) {
  if (!to || !to.includes('@') || !code) {
    return { success: false, reason: 'invalid_recipient_or_code' };
  }

  const safeOwner = String(name || '').trim() || 'Emprendedor/a';
  const safeBiz = String(businessName || '').trim() || 'Tu Comercio';

  const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verifica tu correo electrónico</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f1f5f9;
      margin: 0;
      padding: 24px 12px;
      color: #0f172a;
    }
    .container {
      max-width: 560px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.08);
      border: 1px solid #e2e8f0;
    }
    .header {
      background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%);
      padding: 36px 28px;
      text-align: center;
      color: #ffffff;
    }
    .badge {
      display: inline-block;
      background: rgba(99, 102, 241, 0.25);
      color: #c7d2fe;
      border: 1px solid rgba(165, 180, 252, 0.3);
      font-size: 11px;
      font-weight: 800;
      padding: 5px 14px;
      border-radius: 9999px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      margin-bottom: 12px;
    }
    .title {
      margin: 0;
      font-size: 24px;
      font-weight: 900;
      letter-spacing: -0.5px;
      color: #ffffff;
    }
    .subtitle {
      margin: 8px 0 0 0;
      font-size: 13px;
      color: #cbd5e1;
      font-weight: 500;
    }
    .content {
      padding: 32px 28px;
    }
    .greeting {
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 12px;
    }
    .message {
      font-size: 14px;
      color: #334155;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .code-card {
      background: #f8fafc;
      border: 2px dashed #6366f1;
      border-radius: 20px;
      padding: 24px 16px;
      text-align: center;
      margin: 24px 0;
    }
    .code-label {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #4f46e5;
      margin-bottom: 8px;
    }
    .code-digits {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 40px;
      font-weight: 900;
      letter-spacing: 10px;
      color: #1e1b4b;
      padding-left: 10px;
      margin: 4px 0;
    }
    .code-expiry {
      font-size: 11px;
      color: #64748b;
      margin-top: 10px;
      font-weight: 700;
    }
    .info-card {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 14px;
      padding: 14px 16px;
      margin-bottom: 24px;
      font-size: 12px;
      color: #1e40af;
      line-height: 1.5;
    }
    .security-notice {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 14px 16px;
      font-size: 12px;
      color: #64748b;
      line-height: 1.5;
    }
    .footer {
      background: #f8fafc;
      padding: 20px 24px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
      font-size: 11px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="badge">Seguridad Reservas Costa Rica 🇨🇷</div>
      <h1 class="title">Verificación de Correo</h1>
      <p class="subtitle">Confirma tu correo para activar tu comercio</p>
    </div>

    <div class="content">
      <div class="greeting">¡Hola, ${safeOwner}! 👋</div>
      <div class="message">
        Recibimos tu solicitud para registrar tu negocio <strong>${safeBiz}</strong> en la plataforma oficial de <strong>Reservas Costa Rica</strong>. Para garantizar que todos los comercios cuenten con correos reales y verificados, ingresa el siguiente código:
      </div>

      <div class="code-card">
        <div class="code-label">Tu Código de Verificación</div>
        <div class="code-digits">${code}</div>
        <div class="code-expiry">⏱️ Este código es válido por 15 minutos</div>
      </div>

      <div class="info-card">
        <strong>💡 ¿Cómo usarlo?</strong> Escribe o pega este código de 6 dígitos en la pantalla de registro para verificar tu dirección y activar tu acceso inmediato al Panel de Negocio.
      </div>

      <div class="security-notice">
        <strong>¿No solicitaste este registro?</strong> Si tú no iniciaste el registro de <strong>${safeBiz}</strong>, puedes ignorar este mensaje con seguridad. Ninguna cuenta será activada sin este código.
      </div>
    </div>

    <div class="footer">
      <p style="margin: 0 0 4px 0; font-weight: 700; color: #475569;">Directorio & Sistema de Reservas de Costa Rica 🇨🇷</p>
      <p style="margin: 0;">Mensaje automático de verificación de identidad. Por favor no respondas a este correo.</p>
    </div>
  </div>
</body>
</html>
  `;

  try {
    console.log(`🔐 Enviando código de verificación de negocio (${code}) a: ${to}...`);
    return await sendEmailCore({
      to,
      subject: `🔐 ${code} es tu código de verificación para registrar tu negocio - Reservas CR`,
      html: htmlContent
    });
  } catch (err) {
    console.error('❌ Error enviando código de verificación a negocio:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Envía correo oficial de bienvenida y confirmación de negocio registrado
 */
export async function sendBusinessWelcomeEmail({ to, ownerName = '', businessName = '', provider = null }) {
  if (!to || !to.includes('@')) {
    return { success: false, reason: 'invalid_recipient' };
  }

  const safeOwner = String(ownerName || '').trim() || 'Emprendedor/a';
  const safeBiz = String(businessName || '').trim() || 'Tu Comercio';
  const verificationNote = provider
    ? `Tu cuenta ha sido verificada y vinculada exitosamente mediante tu inicio de sesión seguro con <strong>${provider}</strong>.`
    : `Tu dirección de correo ha sido confirmada y verificada exitosamente con tu código de seguridad.`;

  const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>¡Bienvenido/a a Reservas Costa Rica!</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f1f5f9;
      margin: 0;
      padding: 24px 12px;
      color: #0f172a;
    }
    .container {
      max-width: 580px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.08);
      border: 1px solid #e2e8f0;
    }
    .header {
      background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%);
      padding: 36px 28px;
      text-align: center;
      color: #ffffff;
    }
    .badge {
      display: inline-block;
      background: rgba(34, 197, 94, 0.2);
      color: #86efac;
      border: 1px solid rgba(134, 239, 172, 0.35);
      font-size: 11px;
      font-weight: 800;
      padding: 5px 14px;
      border-radius: 9999px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      margin-bottom: 12px;
    }
    .title {
      margin: 0;
      font-size: 24px;
      font-weight: 900;
      letter-spacing: -0.5px;
      color: #ffffff;
    }
    .subtitle {
      margin: 8px 0 0 0;
      font-size: 13px;
      color: #cbd5e1;
      font-weight: 500;
    }
    .content {
      padding: 32px 28px;
    }
    .greeting {
      font-size: 17px;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 12px;
    }
    .message {
      font-size: 14px;
      color: #334155;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .plan-card {
      background: #f8fafc;
      border: 1.5px solid #e2e8f0;
      border-radius: 20px;
      padding: 20px;
      margin: 20px 0;
    }
    .step-item {
      display: flex;
      gap: 12px;
      margin-bottom: 14px;
      font-size: 13px;
      color: #334155;
      line-height: 1.5;
    }
    .step-num {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: #4f46e5;
      color: #ffffff;
      font-size: 12px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-top: 1px;
    }
    .btn-container {
      text-align: center;
      margin: 28px 0 16px 0;
    }
    .btn-panel {
      display: inline-block;
      background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%);
      color: #ffffff !important;
      font-weight: 800;
      font-size: 14px;
      padding: 14px 32px;
      border-radius: 16px;
      text-decoration: none;
      box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35);
    }
    .footer {
      background: #f8fafc;
      padding: 20px 24px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
      font-size: 11px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="badge">Cuenta Verificada Oficial 🇨🇷</div>
      <h1 class="title">¡Bienvenido a Reservas CR!</h1>
      <p class="subtitle">Tu comercio está listo para recibir citas en línea</p>
    </div>

    <div class="content">
      <div class="greeting">¡Hola, ${safeOwner}! 👋</div>
      <div class="message">
        ¡Felicidades! Tu negocio <strong>${safeBiz}</strong> ha quedado registrado exitosamente en la plataforma oficial de <strong>Reservas Costa Rica</strong>.<br><br>
        ${verificationNote}
      </div>

      <div class="plan-card">
        <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #4f46e5; letter-spacing: 1px; margin-bottom: 4px;">Tu Plan Actual</div>
        <div style="font-size: 18px; font-weight: 900; color: #0f172a;">Plan Gratis de Por Vida 🇨🇷</div>
        <div style="font-size: 12px; color: #64748b; margin-top: 4px; line-height: 1.6;">
          ✓ Costo mensual: ₡0 / mes<br>
          ✓ Hasta 25 reservas mensuales incluidas<br>
          ✓ Catálogo digital y enlace directo para tus clientes
        </div>
      </div>

      <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin: 20px 0 12px 0;">
        🚀 Siguientes pasos recomendados:
      </div>

      <div class="step-item">
        <div class="step-num">1</div>
        <div><strong>Configura tus servicios:</strong> Agrega los tratamientos, cortes o servicios con su precio en colones y duración.</div>
      </div>
      <div class="step-item">
        <div class="step-num">2</div>
        <div><strong>Ajusta tus horarios:</strong> Define tus días y horas hábiles de atención en tu perfil de comercio.</div>
      </div>
      <div class="step-item">
        <div class="step-num">3</div>
        <div><strong>Comparte tu enlace:</strong> Pon el link de tu negocio en tu WhatsApp Business, biografía de Instagram o envíalo a tus clientes.</div>
      </div>
      <div class="step-item">
        <div class="step-num">4</div>
        <div><strong>Mejora cuando lo necesites:</strong> Si requieres citas ilimitadas o recordatorios por WhatsApp, puedes pasar a un plan de pago (Básico, Pro o Premium) desde tu panel con SINPE Móvil o tarjeta.</div>
      </div>

      <div class="btn-container">
        <a href="https://reservascr.app/panel-negocio" class="btn-panel">
          Abrir Mi Panel de Negocio →
        </a>
      </div>
    </div>

    <div class="footer">
      <p style="margin: 0 0 4px 0; font-weight: 700; color: #475569;">Directorio & Sistema de Reservas de Costa Rica 🇨🇷</p>
      <p style="margin: 0;">¿Necesitas ayuda para configurar tu negocio? Escríbenos directamente o responde a este correo.</p>
    </div>
  </div>
</body>
</html>
  `;

  try {
    console.log(`✉️ Enviando correo oficial de bienvenida a comercio (${to})...`);
    return await sendEmailCore({
      to,
      subject: `🎉 ¡Bienvenido/a a Reservas Costa Rica! Tu negocio "${safeBiz}" está listo 🇨🇷`,
      html: htmlContent
    });
  } catch (err) {
    console.error('❌ Error enviando correo de bienvenida a comercio:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Notificación por correo al administrador cuando un comercio hace PRE-REGISTRO
 */
export async function sendAdminPreRegistrationNotificationEmail(lead) {
  if (!brevoApiKey && !resend) {
    console.warn('⚠️ No se pudo enviar notificación de pre-registro: Ningún proveedor de correo configurado.');
    return { success: false, reason: 'no_email_service' };
  }

  const formattedPhone = formatWhatsAppPhone(lead.phone);
  const waLink = formattedPhone ? `https://wa.me/${formattedPhone}` : '#';

  const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); padding: 30px 24px; text-align: center; color: #ffffff; }
    .badge { display: inline-block; background: #f59e0b; color: #000000; font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 9999px; text-transform: uppercase; margin-bottom: 8px; }
    .content { padding: 28px 24px; }
    .info-box { background: #f1f5f9; border-radius: 14px; padding: 18px; margin: 18px 0; }
    .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
    .info-row:last-child { border-bottom: none; }
    .label { color: #64748b; font-weight: 600; }
    .val { color: #0f172a; font-weight: 700; text-align: right; }
    .btn { display: inline-block; background: #2563eb; color: #ffffff !important; font-weight: 700; padding: 12px 24px; border-radius: 12px; text-decoration: none; margin-top: 10px; }
    .btn-wa { background: #22c55e !important; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #94a3b8; background: #f8fafc; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <span class="badge">🚀 Nuevo Prospecto de Preventa</span>
      <h2 style="margin: 0; font-size: 22px; font-weight: 800;">¡Nuevo Comercio Pre-Registrado!</h2>
      <p style="margin: 6px 0 0 0; opacity: 0.9; font-size: 13px;">Un comercio acaba de solicitar sus 15 días gratis del Plan Pro</p>
    </div>
    <div class="content">
      <div class="info-box">
        <div class="info-row">
          <span class="label">🏢 Nombre del Negocio:</span>
          <span class="val">${lead.businessName || 'No especificado'}</span>
        </div>
        <div class="info-row">
          <span class="label">👤 Persona de Contacto:</span>
          <span class="val">${lead.contactName || 'No especificado'}</span>
        </div>
        <div class="info-row">
          <span class="label">📱 WhatsApp / Teléfono:</span>
          <span class="val">${lead.phone || 'No especificado'}</span>
        </div>
        <div class="info-row">
          <span class="label">✉️ Correo Electrónico:</span>
          <span class="val">${lead.email || 'No proporcionado'}</span>
        </div>
        <div class="info-row">
          <span class="label">🏷️ Categoría:</span>
          <span class="val">${lead.category || 'Servicios'}</span>
        </div>
        <div class="info-row">
          <span class="label">📍 Ciudad / Ubicación:</span>
          <span class="val">${lead.city || 'Costa Rica'}</span>
        </div>
        <div class="info-row">
          <span class="label">⭐ Plan de Interés:</span>
          <span class="val">${(lead.planInterest || 'pro').toUpperCase()} (15 Días Pro Gratis)</span>
        </div>
        ${lead.notes ? `
        <div class="info-row" style="flex-direction: column; align-items: flex-start;">
          <span class="label" style="margin-bottom: 4px;">📝 Notas / Mensaje:</span>
          <span class="val" style="text-align: left; font-weight: 500; font-style: italic; color: #334155;">"${lead.notes}"</span>
        </div>` : ''}
      </div>

      <div style="text-align: center; margin-top: 24px;">
        <a href="${waLink}" class="btn btn-wa" target="_blank" style="margin-right: 8px;">
          💬 Contactar por WhatsApp
        </a>
        <a href="${APP_URL}" class="btn" target="_blank">
          🌐 Ir a Reservas CR
        </a>
      </div>
    </div>
    <div class="footer">
      Reservas CR © 2026 • Notificaciones para ${ADMIN_NOTIFICATION_EMAIL}
    </div>
  </div>
</body>
</html>
  `;

  try {
    console.log(`📧 Enviando notificación de pre-registro a ${ADMIN_NOTIFICATION_EMAILS.join(', ')}...`);
    return await sendEmailCore({
      to: ADMIN_NOTIFICATION_EMAILS,
      subject: `🚀 [Nuevo Pre-Registro] ${lead.businessName} (${lead.contactName})`,
      html: htmlContent
    });
  } catch (err) {
    console.error('❌ Excepción enviando correo al admin:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Notificación por correo al administrador cuando un comercio inicia o completa su registro
 * (funciona tanto para comercio verificado como no verificado con OTP)
 */
export async function sendAdminBusinessRegistrationNotificationEmail({ 
  business = {}, 
  ownerName = '', 
  email = '', 
  isVerified = true, 
  verificationCode = null, 
  provider = null 
}) {
  if (!brevoApiKey && !resend) return { success: false, reason: 'no_email_service' };

  const bizName = business?.name || 'Comercio en Registro';
  const formattedPhone = formatWhatsAppPhone(business?.phone);
  const waLink = formattedPhone ? `https://wa.me/${formattedPhone}` : '#';

  const badgeStyle = isVerified 
    ? 'display: inline-block; background: #ffffff; color: #065f46; font-size: 11px; font-weight: 800; padding: 5px 14px; border-radius: 9999px; text-transform: uppercase; margin-bottom: 8px;'
    : 'display: inline-block; background: #fffbeb; color: #92400e; font-size: 11px; font-weight: 800; padding: 5px 14px; border-radius: 9999px; text-transform: uppercase; margin-bottom: 8px; border: 1px solid #fde68a;';

  const badgeText = isVerified 
    ? '🟢 Comercio Verificado y Activo' 
    : '⏳ Registro Iniciado (No Verificado - Código OTP)';

  const headerBg = isVerified 
    ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)' 
    : 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)';

  const headerTitle = isVerified 
    ? '¡Nuevo Negocio Creado y Verificado!' 
    : '¡Nuevo Registro de Negocio en Proceso!';

  const headerSubtitle = isVerified 
    ? `Cuenta de comercio creada y verificada exitosamente${provider ? ` mediante ${provider}` : ''}`
    : 'Un comercio ha llenado el formulario de registro y está pendiente de verificar su código OTP';

  const statusVal = isVerified 
    ? '<span style="color: #10b981; font-weight: 800;">✅ Correo Verificado (Cuenta Activa)</span>' 
    : '<span style="color: #d97706; font-weight: 800;">⏳ No verificado aún (Código OTP pendiente de ingreso)</span>';

  const otpBox = (!isVerified && verificationCode) ? `
        <div class="info-row" style="background: #fffbeb; border: 1px dashed #f59e0b; padding: 10px 14px; border-radius: 10px; margin: 10px 0;">
          <span class="label" style="color: #92400e; font-weight: 700;">🔑 Código OTP Enviado:</span>
          <span class="val" style="font-family: monospace; font-size: 17px; color: #b45309; font-weight: 900; letter-spacing: 3px;">${verificationCode}</span>
        </div>
  ` : '';

  const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0; }
    .header { background: ${headerBg}; padding: 30px 24px; text-align: center; color: #ffffff; }
    .content { padding: 28px 24px; }
    .info-box { background: #f1f5f9; border-radius: 14px; padding: 18px; margin: 18px 0; }
    .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
    .info-row:last-child { border-bottom: none; }
    .label { color: #64748b; font-weight: 600; }
    .val { color: #0f172a; font-weight: 700; text-align: right; }
    .btn { display: inline-block; background: #2563eb; color: #ffffff !important; font-weight: 700; padding: 12px 24px; border-radius: 12px; text-decoration: none; margin-top: 10px; }
    .btn-wa { background: #22c55e !important; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #94a3b8; background: #f8fafc; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <span style="${badgeStyle}">${badgeText}</span>
      <h2 style="margin: 0; font-size: 22px; font-weight: 800;">${headerTitle}</h2>
      <p style="margin: 6px 0 0 0; opacity: 0.95; font-size: 13px;">${headerSubtitle}</p>
    </div>
    <div class="content">
      <div class="info-box">
        <div class="info-row">
          <span class="label">🏢 Nombre del Negocio:</span>
          <span class="val">${bizName}</span>
        </div>
        <div class="info-row">
          <span class="label">👤 Dueño / Encargado:</span>
          <span class="val">${ownerName || bizName}</span>
        </div>
        <div class="info-row">
          <span class="label">✉️ Correo Electrónico:</span>
          <span class="val">${email || 'No especificado'}</span>
        </div>
        <div class="info-row">
          <span class="label">📋 Estado:</span>
          <span class="val">${statusVal}</span>
        </div>
        ${otpBox}
        <div class="info-row">
          <span class="label">📱 Teléfono / WhatsApp:</span>
          <span class="val">${business?.phone || 'No especificado'}</span>
        </div>
        <div class="info-row">
          <span class="label">🏷️ Categoría:</span>
          <span class="val">${business?.categoryLabel || business?.category || 'General'}</span>
        </div>
        <div class="info-row">
          <span class="label">📍 Ubicación:</span>
          <span class="val">${[business?.address, business?.city].filter(Boolean).join(', ') || 'Costa Rica'}</span>
        </div>
        <div class="info-row">
          <span class="label">⭐ Plan:</span>
          <span class="val">${(business?.plan || 'free').toUpperCase()}</span>
        </div>
      </div>

      <div style="text-align: center; margin-top: 24px;">
        ${formattedPhone ? `
        <a href="${waLink}" class="btn btn-wa" target="_blank" style="margin-right: 8px;">
          💬 Escribir por WhatsApp
        </a>` : ''}
        <a href="${APP_URL}" class="btn" target="_blank">
          🌐 Ver Directorio
        </a>
      </div>
    </div>
    <div class="footer">
      Reservas CR © 2026 • Notificaciones administrativas enviadas a ${ADMIN_NOTIFICATION_EMAILS.join(', ')}
    </div>
  </div>
</body>
</html>
  `;

  const subject = isVerified 
    ? `🏪 [Nuevo Negocio - Verificado] ${bizName} (${ownerName || email})` 
    : `⏳ [Nuevo Negocio - Pendiente Verificación] ${bizName} (${ownerName || email})`;

  try {
    console.log(`📧 Enviando notificación de registro de negocio (${isVerified ? 'VERIFICADO' : 'PENDIENTE OTP'}) a ${ADMIN_NOTIFICATION_EMAILS.join(', ')}...`);
    return await sendEmailCore({
      to: ADMIN_NOTIFICATION_EMAILS,
      subject,
      html: htmlContent
    });
  } catch (err) {
    console.error('❌ Error enviando correo al admin de registro de negocio:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Notificación por correo al administrador cuando un CLIENTE se registra
 */
export async function sendAdminClientRegistrationNotificationEmail(client = {}) {
  if (!brevoApiKey && !resend) return { success: false, reason: 'no_email_service' };

  const formattedPhone = formatWhatsAppPhone(client.phone);
  const waLink = formattedPhone ? `https://wa.me/${formattedPhone}` : '#';
  const displayPhone = client.phone ? client.phone : (client.oauth_provider ? `Pendiente (Registro con ${client.oauth_provider})` : 'No especificado');
  const contactInfo = client.phone || client.email || 'Nuevo';

  const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 30px 24px; text-align: center; color: #ffffff; }
    .badge { display: inline-block; background: #ffffff; color: #4338ca; font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 9999px; text-transform: uppercase; margin-bottom: 8px; }
    .content { padding: 28px 24px; }
    .info-box { background: #f1f5f9; border-radius: 14px; padding: 18px; margin: 18px 0; }
    .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
    .info-row:last-child { border-bottom: none; }
    .label { color: #64748b; font-weight: 600; }
    .val { color: #0f172a; font-weight: 700; text-align: right; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #94a3b8; background: #f8fafc; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <span class="badge">👤 Nuevo Cliente</span>
      <h2 style="margin: 0; font-size: 22px; font-weight: 800;">¡Nuevo Cliente Registrado!</h2>
      <p style="margin: 6px 0 0 0; opacity: 0.9; font-size: 13px;">Un usuario ha creado su cuenta de cliente en Reservas CR</p>
    </div>
    <div class="content">
      <div class="info-box">
        <div class="info-row">
          <span class="label">👤 Nombre:</span>
          <span class="val">${client.name || 'Sin nombre'}</span>
        </div>
        <div class="info-row">
          <span class="label">📱 Teléfono / WhatsApp:</span>
          <span class="val">${displayPhone}</span>
        </div>
        <div class="info-row">
          <span class="label">✉️ Correo Electrónico:</span>
          <span class="val">${client.email || 'No proporcionado'}</span>
        </div>
        ${client.oauth_provider ? `
        <div class="info-row">
          <span class="label">🔑 Método de Registro:</span>
          <span class="val">${client.oauth_provider.toUpperCase()}</span>
        </div>` : ''}
      </div>

      ${formattedPhone ? `
      <div style="text-align: center; margin-top: 24px;">
        <a href="${waLink}" style="display: inline-block; background: #22c55e; color: #ffffff; font-weight: 700; padding: 12px 24px; border-radius: 12px; text-decoration: none;" target="_blank">
          💬 Contactar por WhatsApp
        </a>
      </div>` : ''}
    </div>
    <div class="footer">
      Reservas CR © 2026 • Notificaciones administrativas enviadas a ${ADMIN_NOTIFICATION_EMAILS.join(', ')}
    </div>
  </div>
</body>
</html>
  `;

  try {
    console.log(`📧 Enviando notificación de nuevo cliente a ${ADMIN_NOTIFICATION_EMAILS.join(', ')}...`);
    return await sendEmailCore({
      to: ADMIN_NOTIFICATION_EMAILS,
      subject: `👤 [Nuevo Cliente] ${client.name || 'Cliente'} (${contactInfo})`,
      html: htmlContent
    });
  } catch (err) {
    console.error('❌ Error enviando correo al admin de nuevo cliente:', err.message);
    return { success: false, error: err.message };
  }
}



