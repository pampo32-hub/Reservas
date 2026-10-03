/**
 * AI BOOKING AGENT - RESERVAS CR
 * Asistente Inteligente Conversacional oficial impulsado por Google Gemini
 * Atiende clientes por WhatsApp, responde dudas del catálogo en colones y agenda citas en tiempo real.
 */

import dotenv from 'dotenv';
import { sendBookingConfirmationWhatsApp, sendNewBookingAlertToBusinessWhatsApp } from './whatsappService.js';

dotenv.config();

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const CANDIDATE_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3.5-flash',
  'gemini-3.7-flash'
];

/**
 * Obtiene la configuración del motor de IA (DB primero, luego .env)
 */
export async function getAiAgentConfig(pool = null) {
  let apiKey = process.env.GEMINI_API_KEY || '';
  let model = process.env.AI_MODEL || 'gemini-flash-lite-latest';
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

  // Modelos como 3.8-flash tienen límites estrictos de cuota diaria (20 req) y 3.7-flash sufre de colas de espera
  let selectedModel = model.trim();
  if (!selectedModel || selectedModel === 'gemini-3.8-flash' || selectedModel === 'gemini-3.7-flash') {
    selectedModel = 'gemini-flash-lite-latest';
  }

  return {
    apiKey: apiKey.trim(),
    model: selectedModel,
    agentName: agentName.trim() || 'Nico',
    isEnabled: Boolean(apiKey.trim() && isEnabled)
  };
}

/**
 * Convierte hora HH:mm a formato amigable 12h (ej: 08:30 -> 8:30 AM)
 */
export function formatTime12h(timeStr) {
  if (!timeStr) return '';
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

/**
 * Convierte la configuración de horario en texto natural comprensible para el LLM
 */
export function formatBusinessSchedule(sch) {
  if (!sch || typeof sch !== 'object') {
    return 'Lunes a Sábado de 8:00 AM a 6:00 PM';
  }

  const dayNames = {
    1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado', 7: 'Domingo', 0: 'Domingo'
  };

  const days = Array.isArray(sch.days) ? sch.days.map(Number) : [1, 2, 3, 4, 5, 6];
  let daysText = 'Lunes a Sábado';

  const isMonToFri = days.length === 5 && [1, 2, 3, 4, 5].every(d => days.includes(d));
  const isMonToSat = days.length === 6 && [1, 2, 3, 4, 5, 6].every(d => days.includes(d));
  const isAllWeek = days.length >= 7;

  if (isMonToFri) {
    daysText = 'Lunes a Viernes (Sábados y Domingos cerrado)';
  } else if (isMonToSat) {
    daysText = 'Lunes a Sábado (Domingos cerrado)';
  } else if (isAllWeek) {
    daysText = 'Todos los días (Lunes a Domingo)';
  } else {
    daysText = days.map(d => dayNames[d] || d).join(', ');
  }

  const openStr = formatTime12h(sch.openTime || '08:00');
  const closeStr = formatTime12h(sch.closeTime || '18:00');
  let text = `${daysText} de ${openStr} a ${closeStr}`;

  if (sch.breakStart && sch.breakEnd) {
    text += ` (Receso/Almuerzo de ${formatTime12h(sch.breakStart)} a ${formatTime12h(sch.breakEnd)}: no disponible para citas)`;
  }

  return text;
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
      SELECT 
        id, name, phone, address, city, category, category_label, description, 
        sinpe_phone, sinpe_holder_name, schedule, auto_confirm_appointments, 
        require_deposit, deposit_percentage, deposit_instructions
      FROM reservas_businesses 
      WHERE id = $1 OR LOWER(name) = LOWER($1) OR slug = $1
      LIMIT 1
    `, [businessId]);

    const biz = bizRes.rows[0] || { name: 'Comercio', city: 'Costa Rica' };
    const realBizId = biz.id || businessId;

    if (biz.schedule && typeof biz.schedule === 'string') {
      try {
        biz.schedule = JSON.parse(biz.schedule);
      } catch (_) {}
    }

    const servicesRes = await pool.query(`
      SELECT id, name, price, duration, description
      FROM reservas_services WHERE business_id = $1
      ORDER BY price ASC
    `, [realBizId]);

    const staffRes = await pool.query(`
      SELECT id, name, role_title as specialty, phone
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

  const horarioNegocio = formatBusinessSchedule(business.schedule);
  const openTimeStr = formatTime12h(business.schedule?.openTime || '08:00');
  const closeTimeStr = formatTime12h(business.schedule?.closeTime || '18:00');
  const slotMin = business.schedule?.slotDuration || 30;

  const citasOcupadasListado = upcomingBookings.length > 0
    ? upcomingBookings.map(b => `[Ocupado: ${b.date} a las ${b.time} con ${b.staff_name || 'Especialista'}]`).join(', ')
    : 'No hay citas registradas recientemente (todos los horarios habituales de atención están libres).';

  const systemInstruction = `
Eres "${config.agentName}", el asistente virtual oficial con Inteligencia Artificial de "${business.name}" a través de la plataforma Reservas CR.
Tu trabajo es atender a los clientes por WhatsApp de manera cordial, rápida, atenta y profesional, resolviendo dudas de precios, duración y agendando su cita en tiempo real.

INFORMACIÓN DEL LOCAL:
- Establecimiento: ${business.name}
- Ubicación / Dirección: ${business.address || ''}${business.address && business.city ? ', ' : ''}${business.city || 'Costa Rica'}
- Teléfono del local: ${business.phone || ''}
${business.sinpe_phone ? `- Teléfono SINPE Móvil: ${business.sinpe_phone} (${business.sinpe_holder_name || 'A nombre del negocio'})` : ''}
${business.require_deposit ? `- Requiere adelanto SINPE: Sí (${business.deposit_percentage || 25}%)` : ''}

FECHA ACTUAL EN COSTA RICA:
Hoy es ${fechaHoyCR} (formato YYYY-MM-DD: ${isoHoy}).

CATÁLOGO DE SERVICIOS Y PRECIOS:
${serviciosListado}

ESPECIALISTAS DISPONIBLES:
${especialistasListado}

HORARIO OFICIAL DE ATENCIÓN:
${horarioNegocio}
Intervalos de atención habituales: cada ${slotMin} minutos (ej: ${openTimeStr}, ...).

TURNOS ACTUALMENTE OCUPADOS (NO DISPONIBLES):
${citasOcupadasListado}

REGLAS DE ATENCIÓN Y HORARIOS (CRÍTICO):
1. El negocio abre oficialmente a las ${openTimeStr} y cierra a las ${closeTimeStr}. NUNCA digas que abre a las 9:00 AM si el horario oficial indica ${openTimeStr}. Ofrece siempre turnos dentro de su jornada laboral real.
2. Respeta los días laborales (${horarioNegocio}). Si un cliente pide cita en un día que el local está cerrado (por ejemplo fin de semana si solo abren de lunes a viernes o durante el receso de almuerzo), indícale amablemente los días y horas hábiles y ofrécele opciones disponibles.
3. No ofrezcas turnos que figuren en la lista de turnos ocupados arriba.
4. Respuestas amables, claras y concisas adecuadas para WhatsApp (máximo 2 a 4 párrafos cortos). Usa emojis con buen gusto.
5. Todos los precios cítalos siempre en Colones costarricenses (₡).
6. Si el cliente pregunta por un servicio o precio, explícaselo claramente y pregúntale amablemente qué día y hora le gustaría visitarnos para agendarle.
7. Si el cliente solicita una fecha (ej: "lunes", "mañana"), ofrece de 2 a 3 opciones de horarios que estén dentro del horario oficial (${openTimeStr} a ${closeTimeStr}) y que estén libres.
8. ACCIÓN DE AGENDAR: Cuando el cliente acepte y confirme explícitamente el servicio, la fecha y la hora, debes incluir AL FINAL de tu respuesta el siguiente bloque especial invisible (no lo pongas si aún están cotizando o indecisos):
<!--RESERVA_CONFIRMADA:{"serviceName":"NOMBRE_DEL_SERVICIO","date":"YYYY-MM-DD","time":"HH:MM AM/PM","staffName":"NOMBRE_ESPECIALISTA"}-->
9. Al confirmar, dile al cliente que su turno ha quedado apartado con éxito en la agenda del negocio y que recibirá los detalles con confirmación.
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
        signal: AbortSignal.timeout(5000), // Si un modelo tarda más de 5s, saltar de inmediato al siguiente
        body: JSON.stringify({
          contents,
          systemInstruction: {
            parts: [{ text: systemInstruction }]
          },
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 350
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
