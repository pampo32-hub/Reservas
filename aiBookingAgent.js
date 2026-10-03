/**
 * AI BOOKING AGENT - RESERVAS CR
 * Asistente Inteligente Conversacional oficial impulsado por Google Gemini
 * Atiende clientes por WhatsApp, responde dudas del catálogo en colones y agenda citas en tiempo real.
 */

import dotenv from 'dotenv';
import { sendBookingConfirmationWhatsApp, sendNewBookingAlertToBusinessWhatsApp } from './whatsappService.js';

dotenv.config();

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const CANDIDATE_MODELS = ['gemini-3.7-flash', 'gemini-3.5-flash', 'gemini-3.8-flash'];

/**
 * Obtiene la configuración del motor de IA (DB primero, luego .env)
 */
export async function getAiAgentConfig(pool = null) {
  let apiKey = process.env.GEMINI_API_KEY || '';
  let model = process.env.AI_MODEL || 'gemini-3.7-flash';
  let agentName = process.env.AI_AGENT_NAME || 'Nico';
  let isEnabled = process.env.AI_AGENT_ENABLED !== 'false';

  if (pool) {
    try {
      const res = await pool.query(`
        SELECT key, value FROM reservas_system_settings 
        WHERE key IN ('GEMINI_API_KEY', 'AI_MODEL', 'AI_AGENT_NAME', 'AI_AGENT_ENABLED')
      `);
      for (const row of res.rows) {
        if (row.key === 'GEMINI_API_KEY' && row.value?.trim()) apiKey = row.value.trim();
        if (row.key === 'AI_MODEL' && row.value?.trim()) model = row.value.trim();
        if (row.key === 'AI_AGENT_NAME' && row.value?.trim()) agentName = row.value.trim();
        if (row.key === 'AI_AGENT_ENABLED') isEnabled = row.value === 'true' || row.value === '1';
      }
    } catch (_) {}
  }

  return {
    apiKey: apiKey.trim(),
    model: model.trim() || 'gemini-3.7-flash',
    agentName: agentName.trim() || 'Nico',
    isEnabled: Boolean(apiKey.trim() && isEnabled)
  };
}

/**
 * Obtiene el contexto completo del negocio (información, servicios, especialistas y agenda próxima)
 */
export async function getBusinessContext(pool, businessId) {
  if (!pool || !businessId) {
    return {
      business: { name: 'Reservas CR', city: 'Costa Rica' },
      services: [],
      staff: [],
      upcomingBookings: []
    };
  }

  try {
    const bizRes = await pool.query(`
      SELECT id, name, phone, address, city, category, bio, sinpe_phone, working_hours, auto_confirm, deposit_percentage, require_deposit
      FROM reservas_businesses 
      WHERE id = $1 OR LOWER(name) = LOWER($1) OR slug = $1
      LIMIT 1
    `, [businessId]);

    const biz = bizRes.rows[0] || { name: 'Comercio', city: 'Costa Rica' };
    const realBizId = biz.id || businessId;

    const servicesRes = await pool.query(`
      SELECT id, name, price, duration, description, category
      FROM reservas_services WHERE business_id = $1 AND is_active = true
      ORDER BY price ASC
    `, [realBizId]);

    const staffRes = await pool.query(`
      SELECT id, name, specialty, phone
      FROM reservas_staff WHERE business_id = $1 AND (is_active = true OR is_active IS NULL)
    `, [realBizId]);

    // Consultar citas de los próximos 7 días para saber qué horarios están ocupados
    const todayStr = new Date().toISOString().split('T')[0];
    const apptRes = await pool.query(`
      SELECT date, time, service_name, staff_id, staff_name
      FROM reservas_appointments 
      WHERE business_id = $1 AND date >= $2 AND status NOT IN ('cancelled', 'rechazada')
      ORDER BY date ASC, time ASC
    `, [realBizId, todayStr]);

    return {
      business: biz,
      services: servicesRes.rows,
      staff: staffRes.rows,
      upcomingBookings: apptRes.rows
    };
  } catch (err) {
    console.error('Error obteniendo contexto del negocio para IA:', err);
    return {
      business: { name: 'Comercio', city: 'Costa Rica' },
      services: [],
      staff: [],
      upcomingBookings: []
    };
  }
}

/**
 * Inserta una cita creada por la IA en PostgreSQL y despacha notificaciones WhatsApp
 */
export async function createAgentAppointment(pool, {
  businessId,
  serviceName,
  servicePrice,
  serviceDuration,
  date,
  time,
  clientName,
  clientPhone,
  clientEmail = null,
  staffName = null,
  notes = 'Agendado automáticamente vía Asistente Virtual IA WhatsApp'
}) {
  const apptId = `APT-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  // Intentar empatar con un servicio real de la DB para obtener datos exactos
  let sId = null;
  let finalPrice = Number(servicePrice) || 0;
  let finalDuration = Number(serviceDuration) || 45;

  if (pool && businessId) {
    try {
      const sMatch = await pool.query(`
        SELECT id, name, price, duration FROM reservas_services 
        WHERE business_id = $1 AND LOWER(name) LIKE $2 LIMIT 1
      `, [businessId, `%${(serviceName || '').toLowerCase().trim()}%`]);

      if (sMatch.rows.length > 0) {
        sId = sMatch.rows[0].id;
        finalPrice = Number(sMatch.rows[0].price);
        finalDuration = Number(sMatch.rows[0].duration) || 45;
        serviceName = sMatch.rows[0].name;
      }
    } catch (_) {}
  }

  // Intentar empatar staff
  let stId = null;
  if (pool && businessId && staffName) {
    try {
      const stMatch = await pool.query(`
        SELECT id, name FROM reservas_staff 
        WHERE business_id = $1 AND LOWER(name) LIKE $2 LIMIT 1
      `, [businessId, `%${staffName.toLowerCase().trim()}%`]);

      if (stMatch.rows.length > 0) {
        stId = stMatch.rows[0].id;
        staffName = stMatch.rows[0].name;
      }
    } catch (_) {}
  }

  const query = `
    INSERT INTO reservas_appointments (
      id, business_id, service_id, service_name, service_price, service_duration,
      date, time, client_name, client_phone, client_email, notes, status,
      staff_id, staff_name, whatsapp_opt_in
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'confirmed', $13, $14, true)
    RETURNING *;
  `;

  const values = [
    apptId,
    businessId,
    sId,
    serviceName || 'Servicio General',
    finalPrice,
    finalDuration,
    date,
    time,
    clientName.trim(),
    clientPhone.trim(),
    clientEmail,
    notes,
    stId,
    staffName
  ];

  let newAppt = null;
  if (pool) {
    const result = await pool.query(query, values);
    newAppt = result.rows[0];

    // Enviar confirmaciones por WhatsApp
    try {
      const bizRes = await pool.query('SELECT * FROM reservas_businesses WHERE id = $1', [businessId]);
      const biz = bizRes.rows[0] || {};

      sendBookingConfirmationWhatsApp(clientPhone, newAppt, biz, pool).catch(e => {
        console.warn('⚠️ Fallo WhatsApp cliente post-IA:', e.message);
      });

      if (biz.phone) {
        sendNewBookingAlertToBusinessWhatsApp(biz.phone, newAppt, biz, pool).catch(e => {
          console.warn('⚠️ Fallo WhatsApp negocio post-IA:', e.message);
        });
      }
    } catch (e) {
      console.error('Error enviando WhatsApp post-IA:', e);
    }
  }

  return newAppt || { id: apptId, service_name: serviceName, date, time, client_name: clientName };
}

/**
 * Procesa un mensaje entrante de un cliente usando Google Gemini
 */
export async function processCustomerMessageWithGemini(pool, {
  businessId,
  customerPhone,
  customerName = 'Cliente',
  messageText,
  conversationHistory = []
}) {
  const config = await getAiAgentConfig(pool);
  if (!config.isEnabled || !config.apiKey) {
    return {
      success: false,
      reply: '¡Hola! En este momento nuestro asistente virtual está en actualización. En breve uno de nuestros encargados te atenderá con gusto.'
    };
  }

  const { business, services, staff, upcomingBookings } = await getBusinessContext(pool, businessId);

  // Fecha actual en Costa Rica
  const now = new Date();
  const options = { timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'long' };
  const fechaHoyCR = new Intl.DateTimeFormat('es-CR', options).format(now);
  const isoHoy = now.toISOString().split('T')[0];

  const serviciosListado = services.length > 0 
    ? services.map(s => `• ${s.name}: ₡${Number(s.price).toLocaleString('es-CR')} (Duración: ${s.duration || 45} min)${s.description ? ` - ${s.description}` : ''}`).join('\n')
    : 'Servicio General según requerimiento del cliente.';

  const especialistasListado = staff.length > 0
    ? staff.map(st => `• ${st.name} (${st.specialty || 'Especialista'})`).join('\n')
    : 'Atención personalizada por el equipo del local.';

  const citasOcupadasListado = upcomingBookings.length > 0
    ? upcomingBookings.map(b => `[Ocupado: ${b.date} a las ${b.time} con ${b.staff_name || 'Especialista'}]`).join(', ')
    : 'No hay citas registradas recientemente (todos los horarios habituales de 9:00 AM a 7:00 PM están libres).';

  const systemInstruction = `
Eres "${config.agentName}", el asistente virtual oficial con Inteligencia Artificial de "${business.name}" a través de la plataforma Reservas CR.
Tu trabajo es atender a los clientes por WhatsApp de manera cordial, rápida, atenta y profesional, resolviendo dudas de precios, duración y agendando su cita en tiempo real.

INFORMACIÓN DEL LOCAL:
- Establecimiento: ${business.name}
- Ubicación / Dirección: ${business.address || ''}${business.address && business.city ? ', ' : ''}${business.city || 'Costa Rica'}
- Teléfono del local: ${business.phone || ''}
${business.sinpe_phone ? `- Teléfono SINPE Móvil: ${business.sinpe_phone}` : ''}
${business.require_deposit ? `- Requiere adelanto SINPE: Sí (${business.deposit_percentage || 25}%)` : ''}

FECHA ACTUAL EN COSTA RICA:
Hoy es ${fechaHoyCR} (formato YYYY-MM-DD: ${isoHoy}).

CATÁLOGO DE SERVICIOS Y PRECIOS:
${serviciosListado}

ESPECIALISTAS DISPONIBLES:
${especialistasListado}

TURNOS ACTUALMENTE OCUPADOS (NO DISPONIBLES):
${citasOcupadasListado}

HORARIOS DISPONIBLES HABITUALES:
Lunes a Sábado de 09:00 AM a 07:00 PM (turnos cada 30 o 45 minutos: 09:00 AM, 10:00 AM, 11:30 AM, 01:00 PM, 02:30 PM, 04:00 PM, 05:30 PM, etc.). No ofrezcas turnos que figuren como ocupados arriba.

REGLAS DE ATENCIÓN:
1. Respuestas amables, claras y concisas adecuadas para WhatsApp (máximo 2 a 4 párrafos cortos). Usa emojis con buen gusto.
2. Todos los precios cítalos siempre en Colones costarricenses (₡).
3. Si el cliente pregunta por un servicio o precio, explícaselo claramente y pregúntale amablemente qué día le gustaría visitarnos para agendarle.
4. Si el cliente solicita una fecha (ej: "mañana", "el viernes a las 3"), ofrece de 2 a 3 opciones de horarios que estén libres.
5. ACCIÓN DE AGENDAR: Cuando el cliente acepte y confirme explícitamente el servicio, la fecha y la hora, debes incluir AL FINAL de tu respuesta el siguiente bloque especial invisible (no lo pongas si aún están cotizando o indecisos):
<!--RESERVA_CONFIRMADA:{"serviceName":"NOMBRE_DEL_SERVICIO","date":"YYYY-MM-DD","time":"HH:MM AM/PM","staffName":"NOMBRE_ESPECIALISTA"}-->
6. Al confirmar, dile al cliente que su turno ha quedado apartado con éxito en la agenda del negocio y que recibirá los detalles con enlaces para Waze y calendario.
`.trim();

  // Historial de mensajes
  const contents = [];
  if (Array.isArray(conversationHistory)) {
    for (const h of conversationHistory) {
      const msgText = h.text || h.content || h.message;
      if (h.role && msgText) {
        contents.push({
          role: h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msgText }]
        });
      }
    }
  }

  // Mensaje actual
  contents.push({
    role: 'user',
    parts: [{ text: messageText }]
  });

  try {
    // Lista de modelos a intentar en orden de preferencia con fallback automático
    const modelsToTry = Array.from(new Set([config.model, ...CANDIDATE_MODELS]));
    let fullReply = '';
    let appointmentCreated = null;
    let callSuccess = false;

  for (const currentModel of modelsToTry) {
    const requestUrl = `${GEMINI_API_BASE}/${currentModel}:generateContent?key=${config.apiKey}`;
    try {
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: {
            parts: [{ text: systemInstruction }]
          },
          generationConfig: {
            temperature: 0.35,
            maxOutputTokens: 1000
          }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        console.warn(`⚠️ Modelo ${currentModel} respondió con código ${response.status}:`, data?.error?.message);
        continue; // Intentar siguiente modelo en fallback
      }

      const candidate = data.candidates?.[0];
      const parts = candidate?.content?.parts || [];
      const textParts = parts.filter(p => p.text && !p.thought);
      fullReply = textParts.length > 0 
        ? textParts.map(p => p.text).join('\n') 
        : (parts.find(p => p.text)?.text || '');

      if (fullReply) {
        callSuccess = true;

        // Extraer y registrar consumo de tokens devuelto por la API de Gemini
        const usage = data.usageMetadata || {};
        const promptTokens = usage.promptTokenCount || 0;
        const candidatesTokens = usage.candidatesTokenCount || 0;
        const totalTokens = usage.totalTokenCount || (promptTokens + candidatesTokens);
        // Costos estándar Google Gemini Flash: $0.075 / 1M prompt, $0.30 / 1M respuesta
        const costUsd = (promptTokens * 0.000000075) + (candidatesTokens * 0.00000030);

        if (pool) {
          try {
            await pool.query(`
              INSERT INTO reservas_ai_usage_logs (
                business_id, customer_phone, customer_name, model, 
                prompt_tokens, candidates_tokens, total_tokens, estimated_cost_usd, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
            `, [businessId || null, customerPhone || null, customerName || 'Cliente', currentModel, promptTokens, candidatesTokens, totalTokens, costUsd]);
            console.log(`📊 [Gemini IA] Tokens usados: ${totalTokens} (Prompt: ${promptTokens}, Respuesta: ${candidatesTokens}) - Costo: $${costUsd.toFixed(6)}`);
          } catch (logErr) {
            console.warn('⚠️ No se pudo registrar log de uso de tokens:', logErr.message);
          }
        }

        break; // Éxito con este modelo
      }
    } catch (modelErr) {
      console.warn(`⚠️ Error de red con modelo ${currentModel}:`, modelErr.message);
    }
  }

  if (!callSuccess || !fullReply) {
    return {
      success: false,
      reply: 'Disculpa, en este momento el sistema está atendiendo una alta demanda. ¿Me podrías indicar de nuevo la fecha o servicio que buscas?'
    };
  }

    // Detectar si Gemini emitió la etiqueta de reserva confirmada
    const bookingMatch = fullReply.match(/<!--RESERVA_CONFIRMADA:(.*?)-->/);
    if (bookingMatch && bookingMatch[1]) {
      try {
        const bookingJson = JSON.parse(bookingMatch[1]);
        appointmentCreated = await createAgentAppointment(pool, {
          businessId,
          serviceName: bookingJson.serviceName,
          date: bookingJson.date,
          time: bookingJson.time,
          staffName: bookingJson.staffName,
          clientName: customerName,
          clientPhone: customerPhone
        });

        // Limpiar la etiqueta técnica del mensaje para que el cliente en WhatsApp solo reciba el texto limpio
        fullReply = fullReply.replace(/<!--RESERVA_CONFIRMADA:.*?-->/g, '').trim();
      } catch (parseErr) {
        console.error('Error parseando o creando reserva desde IA:', parseErr);
      }
    }

    return {
      success: true,
      reply: fullReply,
      appointment: appointmentCreated
    };
  } catch (err) {
    console.error('Error en processCustomerMessageWithGemini:', err);
    return {
      success: false,
      reply: 'Disculpa, tuvimos una breve interrupción en la conexión. Por favor escríbenos nuevamente en un momento.'
    };
  }
}
