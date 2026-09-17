import webpush from 'web-push';
import dotenv from 'dotenv';

dotenv.config();

let vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
let vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
let vapidEmail = process.env.VAPID_EMAIL || 'mailto:soporte@reservascr.app';
let isConfigured = false;

/**
 * Inicializa el servicio de Web Push con llaves VAPID persistentes.
 * Si no existen en variables de entorno ni en la base de datos, genera un nuevo par y lo almacena.
 */
export async function initPushService(pool) {
  try {
    if (!vapidPublicKey || !vapidPrivateKey) {
      // Consultar en la base de datos
      const pubRes = await pool.query("SELECT value FROM reservas_system_settings WHERE key = 'push_vapid_public_key'");
      const privRes = await pool.query("SELECT value FROM reservas_system_settings WHERE key = 'push_vapid_private_key'");

      if (pubRes.rows.length > 0 && privRes.rows.length > 0 && pubRes.rows[0].value && privRes.rows[0].value) {
        vapidPublicKey = pubRes.rows[0].value;
        vapidPrivateKey = privRes.rows[0].value;
      } else {
        // Generar nuevo par de claves VAPID
        console.log('🔑 [Web Push] Generando nuevas claves VAPID para notificaciones móviles...');
        const keys = webpush.generateVAPIDKeys();
        vapidPublicKey = keys.publicKey;
        vapidPrivateKey = keys.privateKey;

        await pool.query(`
          INSERT INTO reservas_system_settings (key, value, updated_at)
          VALUES ('push_vapid_public_key', $1, NOW())
          ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
        `, [vapidPublicKey]);

        await pool.query(`
          INSERT INTO reservas_system_settings (key, value, updated_at)
          VALUES ('push_vapid_private_key', $1, NOW())
          ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
        `, [vapidPrivateKey]);

        console.log('✅ [Web Push] Claves VAPID generadas y guardadas en base de datos.');
      }
    }

    webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
    isConfigured = true;
    console.log('🔔 [Web Push] Servicio de notificaciones Web Push activo y configurado.');
    return { success: true, publicKey: vapidPublicKey };
  } catch (error) {
    console.error('⚠️ [Web Push] Error inicializando servicio Web Push:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Obtiene la clave pública VAPID para el navegador
 */
export async function getVapidPublicKey(pool) {
  if (!vapidPublicKey && pool) {
    await initPushService(pool);
  }
  return vapidPublicKey;
}

/**
 * Guarda o actualiza una suscripción Push de un comercio en la base de datos
 */
export async function savePushSubscription(pool, { businessId, subscription, userAgent = '' }) {
  if (!businessId || !subscription || !subscription.endpoint || !subscription.keys) {
    throw new Error('Datos de suscripción incompletos');
  }

  const endpoint = subscription.endpoint;
  const p256dh = subscription.keys.p256dh;
  const auth = subscription.keys.auth;
  const id = `push-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  await pool.query(`
    INSERT INTO reservas_push_subscriptions (id, business_id, endpoint, p256dh, auth, user_agent, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, NOW())
    ON CONFLICT (business_id, endpoint) 
    DO UPDATE SET p256dh = $4, auth = $5, user_agent = $6, created_at = NOW()
  `, [id, businessId, endpoint, p256dh, auth, userAgent || '']);

  console.log(`📱 [Web Push] Suscripción registrada para comercio ${businessId}`);
  return { success: true, id };
}

/**
 * Elimina una suscripción Push
 */
export async function removePushSubscription(pool, { businessId, endpoint }) {
  if (!businessId || !endpoint) {
    throw new Error('Datos de desuscripción incompletos');
  }

  await pool.query(`
    DELETE FROM reservas_push_subscriptions
    WHERE business_id = $1 AND endpoint = $2
  `, [businessId, endpoint]);

  console.log(`🔕 [Web Push] Suscripción eliminada para comercio ${businessId}`);
  return { success: true };
}

/**
 * Envía una notificación Web Push a todos los dispositivos registrados de un comercio
 */
export async function sendPushToBusiness(pool, businessId, payload) {
  try {
    if (!isConfigured) {
      await initPushService(pool);
    }

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.warn('⚠️ [Web Push] No hay claves VAPID disponibles.');
      return { success: false, reason: 'VAPID no configurado' };
    }

    const subRes = await pool.query(`
      SELECT id, endpoint, p256dh, auth 
      FROM reservas_push_subscriptions 
      WHERE business_id = $1
    `, [businessId]);

    if (subRes.rows.length === 0) {
      console.log(`ℹ️ [Web Push] El comercio ${businessId} no tiene dispositivos móviles suscritos.`);
      return { success: true, delivered: 0, total: 0 };
    }

    const notificationData = JSON.stringify({
      title: payload.title || '🔔 ¡Nueva Notificación!',
      body: payload.body || 'Tienes una novedad en Reservas CR',
      icon: payload.icon || '/src/assets/reservas_cr_clean_badge_1.jpg',
      badge: payload.badge || '/src/assets/reservas_cr_clean_badge_1.jpg',
      tag: payload.tag || `reserva-${Date.now()}`,
      data: payload.data || { url: '/#/owner-dashboard' },
      timestamp: Date.now()
    });

    let delivered = 0;
    const expiredIds = [];

    for (const sub of subRes.rows) {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      };

      try {
        await webpush.sendNotification(pushSubscription, notificationData);
        delivered++;
      } catch (err) {
        console.warn(`⚠️ [Web Push] Error enviando a endpoint ${sub.id}:`, err.statusCode || err.message);
        // Si el endpoint expiró o fue revocado (404 o 410 Gone), marcarlo para eliminar
        if (err.statusCode === 404 || err.statusCode === 410) {
          expiredIds.push(sub.id);
        }
      }
    }

    // Limpieza automática de suscripciones caducadas
    if (expiredIds.length > 0) {
      await pool.query(`
        DELETE FROM reservas_push_subscriptions
        WHERE id = ANY($1::text[])
      `, [expiredIds]);
      console.log(`🧹 [Web Push] Eliminadas ${expiredIds.length} suscripciones inactivas/caducadas.`);
    }

    console.log(`📱 [Web Push] Notificación enviada a ${delivered}/${subRes.rows.length} dispositivos del comercio ${businessId}`);
    return { success: true, delivered, total: subRes.rows.length };
  } catch (error) {
    console.error('⚠️ [Web Push] Error general enviando push a comercio:', error.message);
    return { success: false, error: error.message };
  }
}
