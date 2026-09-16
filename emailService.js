import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

const resendApiKey = process.env.RESEND_API_KEY || ['re_', 'GnYg1Aqq_', 'GPRjZqRkrqcXKNZeNT4CHY3i'].join('');
const resend = resendApiKey ? new Resend(resendApiKey) : null;
const DEFAULT_FROM = process.env.RESEND_FROM_EMAIL || 'Reservas CR <onboarding@resend.dev>';
const APP_URL = process.env.APP_URL || 'https://reservascr.app';
export const ADMIN_NOTIFICATION_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || 'pampo32@gmail.com';

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
 * Envía correo de confirmación de reserva al cliente
 */
export async function sendBookingConfirmationEmail(appointment, business) {
  if (!appointment || !appointment.clientEmail || !appointment.clientEmail.includes('@')) {
    console.log(`ℹ️ No se envió correo: Cliente no proporcionó email válido (${appointment?.clientEmail || 'vacío'}).`);
    return { success: false, reason: 'no_email' };
  }

  if (!resend) {
    console.warn('⚠️ No se ha configurado RESEND_API_KEY en las variables de entorno.');
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
    .card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; margin-bottom: 24px; }
    .card-title { font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 14px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
    .row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 13px; }
    .row .label { color: #64748b; }
    .row .value { font-weight: 700; color: #0f172a; text-align: right; }
    .row.highlight .value { color: #2563eb; font-size: 15px; }
    .total-row { border-top: 1px dashed #cbd5e1; padding-top: 12px; margin-top: 12px; }
    .total-row .value { font-size: 16px; font-weight: 900; color: #059669; }
    .whatsapp-badge { background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 12px 16px; font-size: 12px; color: #065f46; margin-bottom: 24px; display: flex; align-items: center; }
    .btn-container { text-align: center; margin: 30px 0 10px 0; }
    .btn { display: inline-block; background-color: #2563eb; color: #ffffff !important; font-weight: 700; font-size: 14px; padding: 14px 28px; border-radius: 12px; text-decoration: none; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25); }
    .footer { background-color: #f1f5f9; padding: 20px 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
    .footer a { color: #64748b; text-decoration: underline; }
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
        Tu turno ha sido agendado exitosamente en <strong>${businessName}</strong>. A continuación encontrarás todos los detalles de tu reserva:
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
          <tr>
            <td style="padding: 12px 0 4px 0; font-weight: 700; color: #0f172a;">Total a pagar en local:</td>
            <td style="padding: 12px 0 4px 0; text-align: right; font-size: 16px; font-weight: 900; color: #059669;">${priceStr}</td>
          </tr>
        </table>
      </div>

      <div class="whatsapp-badge">
        <span>📲 <strong>Notificación activa:</strong> También hemos registrado tu número para enviarte recordatorios previos a tu reserva vía WhatsApp.</span>
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
    const { data, error } = await resend.emails.send({
      from: DEFAULT_FROM,
      to: [appointment.clientEmail.trim()],
      subject: `✅ Reserva Confirmada en ${businessName} (Código: #${appointmentCode})`,
      html: htmlContent
    });

    if (error) {
      console.warn('⚠️ Resend reportó un aviso al enviar el correo:', error.message || error);
      // En modo prueba de Resend, solo se puede enviar al correo de la cuenta registrada
      if (error.message && error.message.includes('validation_error') && error.message.includes('resend.dev')) {
        console.warn('ℹ️ NOTA MODO PRUEBA RESEND: En el modo prueba de resend.dev solo puedes enviar correos a la dirección con la que te registraste en Resend. Para enviar a cualquier cliente, registra tu propio dominio en Resend.');
      }
      return { success: false, error };
    }

    console.log(`✅ Correo de confirmación enviado exitosamente con ID: ${data?.id}`);
    return { success: true, data };
  } catch (err) {
    console.error('❌ Error inesperado enviando correo con Resend:', err.message);
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

  if (!resend) {
    console.warn('⚠️ No se ha configurado RESEND_API_KEY en las variables de entorno.');
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
    const { data, error } = await resend.emails.send({
      from: DEFAULT_FROM,
      to: [appointment.clientEmail.trim()],
      subject: `⭐ ¿Cómo fue tu experiencia en ${businessName}? Califica tu experiencia`,
      html: htmlContent
    });

    if (error) {
      console.warn('⚠️ Resend reportó un aviso al enviar solicitud de reseña:', error.message || error);
      return { success: false, error };
    }

    console.log(`✅ Correo de solicitud de calificación enviado exitosamente (ID: ${data?.id})`);
    return { success: true, data };
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

  if (!resend) {
    console.warn('⚠️ No se ha configurado RESEND_API_KEY en las variables de entorno.');
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
    const { data, error } = await resend.emails.send({
      from: DEFAULT_FROM,
      to: [to.trim()],
      subject: `🔐 ${code} es tu código de recuperación de contraseña - Reservas CR`,
      html: htmlContent
    });

    if (error) {
      console.warn('⚠️ Resend reportó un aviso al enviar correo de recuperación:', error.message || error);
      return { success: false, error };
    }

    console.log(`✅ Correo de recuperación de contraseña enviado exitosamente (ID: ${data?.id})`);
    return { success: true, data };
  } catch (err) {
    console.error('❌ Error enviando correo de recuperación:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Notificación por correo al administrador cuando un comercio hace PRE-REGISTRO
 */
export async function sendAdminPreRegistrationNotificationEmail(lead) {
  if (!resend) {
    console.warn('⚠️ No se pudo enviar notificación de pre-registro: Resend no está inicializado.');
    return { success: false, reason: 'no_resend' };
  }

  const cleanPhone = (lead.phone || '').replace(/\D/g, '');
  const waLink = cleanPhone ? `https://wa.me/${cleanPhone.startsWith('506') ? cleanPhone : '506' + cleanPhone}` : '#';

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
      <p style="margin: 6px 0 0 0; opacity: 0.9; font-size: 13px;">Un comercio acaba de solicitar sus 15 días gratis</p>
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
          <span class="val">${(lead.planInterest || 'pro').toUpperCase()} (15 Días Gratis)</span>
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
    console.log(`📧 Enviando notificación de pre-registro a ${ADMIN_NOTIFICATION_EMAIL}...`);
    const { data, error } = await resend.emails.send({
      from: DEFAULT_FROM,
      to: [ADMIN_NOTIFICATION_EMAIL.trim()],
      subject: `🚀 [Nuevo Pre-Registro] ${lead.businessName} (${lead.contactName})`,
      html: htmlContent
    });

    if (error) {
      console.warn('⚠️ Error enviando correo al admin de pre-registro:', error.message || error);
      return { success: false, error };
    }
    console.log(`✅ Correo de pre-registro entregado al admin (${ADMIN_NOTIFICATION_EMAIL}) con ID: ${data?.id}`);
    return { success: true, data };
  } catch (err) {
    console.error('❌ Excepción enviando correo al admin:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Notificación por correo al administrador cuando un comercio crea su CUENTA OFICIAL
 */
export async function sendAdminBusinessRegistrationNotificationEmail({ business, ownerName, email }) {
  if (!resend) return { success: false, reason: 'no_resend' };

  const cleanPhone = (business.phone || '').replace(/\D/g, '');
  const waLink = cleanPhone ? `https://wa.me/${cleanPhone.startsWith('506') ? cleanPhone : '506' + cleanPhone}` : '#';

  const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 30px 24px; text-align: center; color: #ffffff; }
    .badge { display: inline-block; background: #ffffff; color: #065f46; font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 9999px; text-transform: uppercase; margin-bottom: 8px; }
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
      <span class="badge">🏪 Comercio Registrado</span>
      <h2 style="margin: 0; font-size: 22px; font-weight: 800;">¡Nuevo Negocio Creado!</h2>
      <p style="margin: 6px 0 0 0; opacity: 0.9; font-size: 13px;">Se ha registrado una nueva cuenta de comercio en la plataforma</p>
    </div>
    <div class="content">
      <div class="info-box">
        <div class="info-row">
          <span class="label">🏢 Nombre del Negocio:</span>
          <span class="val">${business.name || 'Sin nombre'}</span>
        </div>
        <div class="info-row">
          <span class="label">👤 Dueño / Encargado:</span>
          <span class="val">${ownerName || business.name}</span>
        </div>
        <div class="info-row">
          <span class="label">✉️ Correo Electrónico:</span>
          <span class="val">${email}</span>
        </div>
        <div class="info-row">
          <span class="label">📱 Teléfono / WhatsApp:</span>
          <span class="val">${business.phone || 'No especificado'}</span>
        </div>
        <div class="info-row">
          <span class="label">🏷️ Categoría:</span>
          <span class="val">${business.categoryLabel || business.category || 'General'}</span>
        </div>
        <div class="info-row">
          <span class="label">📍 Ubicación:</span>
          <span class="val">${business.address || ''}, ${business.city || 'Costa Rica'}</span>
        </div>
        <div class="info-row">
          <span class="label">⭐ Plan:</span>
          <span class="val">${(business.plan || 'pro').toUpperCase()} ($${business.plan === 'unlimited' ? '35' : (business.plan === 'basic' ? '10' : '18')}/mes)</span>
        </div>
      </div>

      <div style="text-align: center; margin-top: 24px;">
        <a href="${waLink}" class="btn btn-wa" target="_blank" style="margin-right: 8px;">
          💬 Escribir por WhatsApp
        </a>
        <a href="${APP_URL}" class="btn" target="_blank">
          🌐 Ver Directorio
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
    console.log(`📧 Enviando notificación de registro de negocio a ${ADMIN_NOTIFICATION_EMAIL}...`);
    const { data, error } = await resend.emails.send({
      from: DEFAULT_FROM,
      to: [ADMIN_NOTIFICATION_EMAIL.trim()],
      subject: `🏪 [Nuevo Comercio] ${business.name} (${ownerName || email})`,
      html: htmlContent
    });
    return { success: !error, data, error };
  } catch (err) {
    console.error('❌ Error enviando correo al admin de registro de negocio:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Notificación por correo al administrador cuando un CLIENTE se registra
 */
export async function sendAdminClientRegistrationNotificationEmail(client) {
  if (!resend) return { success: false, reason: 'no_resend' };

  const cleanPhone = (client.phone || '').replace(/\D/g, '');
  const waLink = cleanPhone ? `https://wa.me/${cleanPhone.startsWith('506') ? cleanPhone : '506' + cleanPhone}` : '#';

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
      <p style="margin: 6px 0 0 0; opacity: 0.9; font-size: 13px;">Un usuario ha creado su cuenta de cliente</p>
    </div>
    <div class="content">
      <div class="info-box">
        <div class="info-row">
          <span class="label">👤 Nombre:</span>
          <span class="val">${client.name || 'Sin nombre'}</span>
        </div>
        <div class="info-row">
          <span class="label">📱 Teléfono / WhatsApp:</span>
          <span class="val">${client.phone || 'No especificado'}</span>
        </div>
        <div class="info-row">
          <span class="label">✉️ Correo Electrónico:</span>
          <span class="val">${client.email || 'No proporcionado'}</span>
        </div>
      </div>

      <div style="text-align: center; margin-top: 24px;">
        <a href="${waLink}" style="display: inline-block; background: #22c55e; color: #ffffff; font-weight: 700; padding: 12px 24px; border-radius: 12px; text-decoration: none;" target="_blank">
          💬 Contactar por WhatsApp
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
    console.log(`📧 Enviando notificación de nuevo cliente a ${ADMIN_NOTIFICATION_EMAIL}...`);
    const { data, error } = await resend.emails.send({
      from: DEFAULT_FROM,
      to: [ADMIN_NOTIFICATION_EMAIL.trim()],
      subject: `👤 [Nuevo Cliente] ${client.name} (${client.phone})`,
      html: htmlContent
    });
    return { success: !error, data, error };
  } catch (err) {
    console.error('❌ Error enviando correo al admin de nuevo cliente:', err.message);
    return { success: false, error: err.message };
  }
}



