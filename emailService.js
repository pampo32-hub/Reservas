import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;
const DEFAULT_FROM = process.env.RESEND_FROM_EMAIL || 'Reservas Costa Rica <onboarding@resend.dev>';

/**
 * Formatea montos en Colones costarricenses (₡)
 */
function formatColones(amount) {
  if (!amount && amount !== 0) return '₡0';
  return `₡${Number(amount).toLocaleString('es-CR')}`;
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
  const dateStr = appointment.date || 'Fecha por confirmar';
  const timeStr = appointment.time || 'Hora por confirmar';
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
      <h1>¡Tu Cita está Confirmada!</h1>
      <p>Gracias por agendar con Reservas Costa Rica</p>
      <div class="badge">Código: #${appointmentCode}</div>
    </div>
    
    <div class="content">
      <div class="greeting">¡Hola, ${clientName}! 👋</div>
      <div class="message">
        Tu turno ha sido agendado exitosamente en <strong>${businessName}</strong>. A continuación encontrarás todos los detalles de tu cita:
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
        <span>📲 <strong>Notificación activa:</strong> También hemos registrado tu número para enviarte recordatorios previos a tu cita vía WhatsApp.</span>
      </div>

      <div class="btn-container">
        <a href="http://localhost:3000" class="btn">Ver Mis Reservas en Línea</a>
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
      subject: `✅ Cita Confirmada en ${businessName} (Código: #${appointmentCode})`,
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
