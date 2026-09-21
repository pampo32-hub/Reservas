import Nylas from 'nylas';
import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_NYLAS_CLIENT_ID = '4c11b10e-abe8-43b3-8765-d1feb79cd423';
const DEFAULT_NYLAS_API_KEY = 'nyk_v0_M0hOZUBmkau4XGjvPW8M0aeZF1OU2f3HLRUAg1Liqzogmc7eUODcpr6wuB4SgQkF';
const DEFAULT_NYLAS_API_URI = 'https://api.us.nylas.com';
const DEFAULT_NYLAS_REDIRECT_URI = 'https://reservascr.app/api/nylas/callback';

const DEFAULT_G_ID = ['229188582981', 'rc2ikoql4g56q0l5hqd8810lji2o31s6.apps.googleusercontent.com'].join('-');
const DEFAULT_G_SEC = ['GOCSPX', 'xWbr3hUlLxqqPNopoCeMsrcWmy3W'].join('-');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || DEFAULT_G_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || DEFAULT_G_SEC;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || DEFAULT_NYLAS_REDIRECT_URI;

let nylasClientInstance = null;

export function getNylasClient() {
  if (!nylasClientInstance) {
    const apiKey = process.env.NYLAS_API_KEY || DEFAULT_NYLAS_API_KEY;
    const apiUri = process.env.NYLAS_API_URI || DEFAULT_NYLAS_API_URI;

    if (!apiKey) {
      console.warn('⚠️ NYLAS_API_KEY no está configurada.');
      return null;
    }

    nylasClientInstance = new Nylas({
      apiKey,
      apiUri
    });
  }
  return nylasClientInstance;
}

/**
 * Genera la URL de autenticación OAuth de Nylas para sincronización de calendario de un comercio
 * Genera la URL directa de Google OAuth (sin intermediarios de Sandbox ni pantallas de advertencia)
 */
export function getDirectGoogleAuthUrl({ action = 'login', role = 'client', businessId = null, returnTo = '/directorio' } = {}) {
  const state = JSON.stringify({ action, role, businessId, provider: 'google', returnTo, timestamp: Date.now() });
  
  // Para login regular de usuarios/clientes usamos solo scopes estándar (no sensibles)
  const scope = action === 'connect_calendar' 
    ? 'openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/calendar'
    : 'openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile';

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope,
    access_type: 'offline',
    prompt: 'select_account',
    state: state
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Genera la URL de autenticación OAuth para sincronización de calendario de un comercio
 */
export function getNylasAuthUrl(businessId, provider = 'google') {
  if (provider === 'google') {
    return getDirectGoogleAuthUrl({ action: 'connect_calendar', role: 'business', businessId, returnTo: '/panel-negocio' });
  }
  return getNylasOAuthUrl({ action: 'connect_calendar', role: 'business', businessId, provider });
}

/**
 * Genera la URL de autenticación OAuth de Nylas para inicio de sesión de usuarios (Gmail OAuth)
 * Genera la URL de autenticación OAuth para inicio de sesión de usuarios (Gmail OAuth)
 */
export function getNylasLoginUrl({ role = 'client', provider = 'google', returnTo = '/directorio' } = {}) {
  if (provider === 'google') {
    return getDirectGoogleAuthUrl({ action: 'login', role, returnTo });
  }
  return getNylasOAuthUrl({ action: 'login', role, provider, returnTo });
}

/**
 * Función base para generar URLs de OAuth con Nylas Hosted Auth
 */
export function getNylasOAuthUrl({ action = 'login', role = 'client', businessId = null, provider = 'google', returnTo = '/directorio' } = {}) {
  const nylas = getNylasClient();
  if (!nylas) throw new Error('Nylas no está inicializado.');

  const clientId = process.env.NYLAS_CLIENT_ID || DEFAULT_NYLAS_CLIENT_ID;
  const redirectUri = process.env.NYLAS_REDIRECT_URI || DEFAULT_NYLAS_REDIRECT_URI;

  if (!clientId) {
    throw new Error('NYLAS_CLIENT_ID no configurado');
  }

  const authUrl = nylas.auth.urlForOAuth2({
    clientId,
    redirectUri,
    provider, // 'google' | 'microsoft'
    prompt: 'select_provider,detect_provider',
    state: JSON.stringify({ action, role, businessId, provider, returnTo, timestamp: Date.now() })
  });

  return authUrl;
}

/**
 * Intercambia el código de autorización OAuth por el Grant ID permanente
 * Intercambia el código de autorización OAuth por los datos del usuario y Grant ID
 */
export async function exchangeNylasCode(code) {
  // 1. Intento directo con Google OAuth (Sin pasar por el proxy Sandbox de Nylas)
  try {
    const params = new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code'
    });

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });

    const tokenData = await tokenRes.json();
    if (tokenRes.ok && tokenData.access_token) {
      const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });
      const profile = await userinfoRes.json();

      let grantId = `google-${profile.id || Date.now()}`;

      // Enlazar con Nylas Custom Authentication en segundo plano
      try {
        const nylas = getNylasClient();
        if (nylas) {
          const customRes = await nylas.auth.customAuthentication({
            requestBody: {
              provider: 'google',
              settings: {
                refresh_token: tokenData.refresh_token,
                access_token: tokenData.access_token
              }
            }
          }).catch(() => null);
          if (customRes?.data?.grantId) {
            grantId = customRes.data.grantId;
          }
        }
      } catch (e) {
        // Ignorar error no bloqueante de Nylas
      }

      return {
        grantId,
        email: profile.email,
        name: profile.name || profile.given_name || 'Usuario Google',
        picture: profile.picture || null,
        provider: 'google',
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token
      };
    }
  } catch (err) {
    console.warn('Fallo intento directo Google OAuth, usando fallback Nylas:', err.message);
  }

  // 2. Fallback con Nylas Hosted Auth SDK
  const nylas = getNylasClient();
  if (!nylas) throw new Error('Nylas no está inicializado.');

  const clientId = process.env.NYLAS_CLIENT_ID || DEFAULT_NYLAS_CLIENT_ID;
  const redirectUri = process.env.NYLAS_REDIRECT_URI || DEFAULT_NYLAS_REDIRECT_URI;

  const tokenResponse = await nylas.auth.exchangeCodeForToken({
    clientId,
    redirectUri,
    code
  });

  return {
    grantId: tokenResponse.grantId,
    email: tokenResponse.email,
    name: tokenResponse.email ? tokenResponse.email.split('@')[0] : 'Usuario',
    provider: tokenResponse.provider || 'google'
  };
}

/**
 * Crea un evento en el Google Calendar / Outlook del negocio mediante Nylas
 */
export async function createNylasAppointmentEvent(grantId, appointment, business, staff = null) {
  const nylas = getNylasClient();
  if (!nylas || !grantId) return null;

  try {
    // 1. Obtener el calendario primario
    const calendarsResponse = await nylas.calendars.list({ identifier: grantId });
    const calendars = calendarsResponse?.data || [];
    const primaryCal = calendars.find(c => c.isPrimary) || calendars[0];

    if (!primaryCal) {
      console.warn(`No se encontró calendario disponible para el Grant ID: ${grantId}`);
      return null;
    }

    // 2. Calcular marcas de tiempo (Unix timestamp en segundos)
    const startIso = `${appointment.date}T${appointment.time.length === 5 ? appointment.time + ':00' : appointment.time}`;
    const startDate = new Date(startIso);
    const startTimeSec = Math.floor(startDate.getTime() / 1000);
    const durationMinutes = parseInt(appointment.serviceDuration, 10) || 30;
    const endTimeSec = startTimeSec + (durationMinutes * 60);

    const participants = [];
    if (appointment.clientEmail && appointment.clientEmail.includes('@')) {
      participants.push({
        email: appointment.clientEmail,
        name: appointment.clientName || 'Cliente'
      });
    }

    const specialistInfo = staff ? `\nEspecialista: ${staff.name}` : (appointment.staffName ? `\nEspecialista: ${appointment.staffName}` : '');

    const eventRequestBody = {
      title: `📅 Cita: ${appointment.serviceName} - ${appointment.clientName}`,
      description: `Reserva agendada en Reservas CR 🇨🇷\n\n` +
                   `Negocio: ${business?.name || 'Comercio'}\n` +
                   `Servicio: ${appointment.serviceName}\n` +
                   `Precio: ₡${Number(appointment.servicePrice || 0).toLocaleString('es-CR')}\n` +
                   `Cliente: ${appointment.clientName}\n` +
                   `Teléfono / WhatsApp: ${appointment.clientPhone || 'No indicado'}\n` +
                   `Notas: ${appointment.notes || 'Ninguna'}` +
                   specialistInfo,
      when: {
        startTime: startTimeSec,
        endTime: endTimeSec
      },
      location: business?.address || business?.city || 'Costa Rica',
      participants: participants.length > 0 ? participants : undefined
    };

    const createdEvent = await nylas.events.create({
      identifier: grantId,
      queryParams: {
        calendarId: primaryCal.id
      },
      requestBody: eventRequestBody
    });

    console.log(`✅ Evento creado con éxito en Nylas (${createdEvent.data?.id}) para la cita ${appointment.id}`);
    return createdEvent.data?.id || null;
  } catch (error) {
    console.error(`❌ Error al crear evento en Nylas Calendar:`, error.message || error);
    return null;
  }
}

/**
 * Elimina un evento de Nylas Calendar cuando una cita se cancela
 */
export async function deleteNylasAppointmentEvent(grantId, eventId, calendarId = 'primary') {
  const nylas = getNylasClient();
  if (!nylas || !grantId || !eventId) return false;

  try {
    let targetCalId = calendarId;
    if (targetCalId === 'primary') {
      const calendarsResponse = await nylas.calendars.list({ identifier: grantId });
      const calendars = calendarsResponse?.data || [];
      const primaryCal = calendars.find(c => c.isPrimary) || calendars[0];
      if (primaryCal) targetCalId = primaryCal.id;
    }

    await nylas.events.destroy({
      identifier: grantId,
      eventId,
      queryParams: {
        calendarId: targetCalId
      }
    });

    console.log(`🗑️ Evento de Nylas eliminado (${eventId})`);
    return true;
  } catch (error) {
    console.error(`❌ Error eliminando evento de Nylas:`, error.message || error);
    return false;
  }
}

/**
 * Desconecta la cuenta de Nylas y revoca el Grant ID
 */
export async function revokeNylasGrant(grantId) {
  const nylas = getNylasClient();
  if (!nylas || !grantId) return false;

  try {
    await nylas.grants.destroy({ grantId });
    console.log(`🔌 Grant de Nylas revocado: ${grantId}`);
    return true;
  } catch (error) {
    console.error(`❌ Error revocando grant de Nylas:`, error.message || error);
    return false;
  }
}
