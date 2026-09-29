import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import XLSX from 'xlsx';
import { pool } from '../db.js';

dotenv.config();

const GOOGLE_DRIVE_WEBHOOK_URL = process.env.DRIVE_BACKUP_WEBHOOK_URL || 'https://script.google.com/macros/s/AKfycbysyqyNsJby8b29w6_WyEX-ol1QmjEa_CrLPqs8ouRCZ-K0pL1Bt4Z-z1alH-4SzBbG/exec';
const BACKUP_SECRET_TOKEN = process.env.DRIVE_BACKUP_TOKEN || 'ReservasCR_Backup_Key_2026_Secure';

// Función para obtener la semana del año (ISO Week)
function getIsoWeek(date) {
  const target = new Date(date.valueOf());
  const dayNumber = (date.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNumber + 3);
  const firstThursday = target.valueOf();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target) / 604800000);
}

// Obtener nombres de días en español
const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// Función para limpiar nombres de carpetas
function sanitizeName(name) {
  if (!name) return 'Sin_Nombre';
  return name.replace(/[\\/:*?"<>|]/g, '').trim();
}

// Generar libro de Excel con múltiples pestañas profesionales para un comercio individual
function generateBusinessExcel(business, services, appointments, staff, reviews, blockedSlots) {
  const wb = XLSX.utils.book_new();

  // 1. Hoja Perfil del Negocio
  const perfilData = [
    { Campo: 'ID Negocio', Valor: business.id },
    { Campo: 'Nombre Comercial', Valor: business.name },
    { Campo: 'Categoría', Valor: business.category_label || business.category },
    { Campo: 'Teléfono', Valor: business.phone || 'N/A' },
    { Campo: 'Correo Electrónico', Valor: business.email || 'N/A' },
    { Campo: 'Dirección', Valor: business.address || 'N/A' },
    { Campo: 'Ciudad / Cantón', Valor: business.city || 'N/A' },
    { Campo: 'Calificación Promedio', Valor: business.rating || 5.0 },
    { Campo: 'Total de Reseñas', Valor: business.reviews_count || 0 },
    { Campo: 'Plan de Suscripción', Valor: business.plan || 'basic' },
    { Campo: 'Límite Mensual de Citas', Valor: business.monthly_booking_limit || 150 },
    { Campo: 'Estado de Suscripción', Valor: business.subscription_status || 'trial' },
    { Campo: 'Fecha de Creación', Valor: business.created_at ? new Date(business.created_at).toISOString() : 'N/A' }
  ];
  const wsPerfil = XLSX.utils.json_to_sheet(perfilData);
  XLSX.utils.book_append_sheet(wb, wsPerfil, 'Perfil');

  // 2. Hoja de Citas y Reservas
  const citasData = appointments.length > 0 ? appointments.map(apt => ({
    'ID Cita': apt.id,
    'Fecha': apt.date,
    'Hora': apt.time,
    'Cliente': apt.client_name,
    'Teléfono Cliente': apt.client_phone,
    'Correo Cliente': apt.client_email || '',
    'Servicio': apt.service_name || '',
    'Precio (₡)': apt.service_price || 0,
    'Duración (min)': apt.service_duration || 0,
    'Especialista / Staff': apt.staff_name || 'Cualquiera',
    'Estado': apt.status || 'confirmed',
    'Notas': apt.notes || '',
    'Fecha Registro': apt.created_at ? new Date(apt.created_at).toISOString() : ''
  })) : [{ 'Mensaje': 'No hay citas registradas en este negocio' }];
  const wsCitas = XLSX.utils.json_to_sheet(citasData);
  XLSX.utils.book_append_sheet(wb, wsCitas, 'Citas');

  // 3. Hoja de Servicios
  const serviciosData = services.length > 0 ? services.map(s => ({
    'ID Servicio': s.id,
    'Nombre': s.name,
    'Duración (min)': s.duration,
    'Precio (₡)': s.price,
    'Descripción': s.description || ''
  })) : [{ 'Mensaje': 'No hay servicios registrados' }];
  const wsServicios = XLSX.utils.json_to_sheet(serviciosData);
  XLSX.utils.book_append_sheet(wb, wsServicios, 'Servicios');

  // 4. Hoja de Equipo / Especialistas
  const staffData = staff.length > 0 ? staff.map(st => ({
    'ID': st.id,
    'Nombre': st.name,
    'Puesto / Especialidad': st.role_title || 'Especialista',
    'Teléfono': st.phone || '',
    'Activo': st.is_active ? 'Sí' : 'No'
  })) : [{ 'Mensaje': 'No hay especialistas adicionales registrados' }];
  const wsStaff = XLSX.utils.json_to_sheet(staffData);
  XLSX.utils.book_append_sheet(wb, wsStaff, 'Equipo');

  // 5. Hoja de Reseñas
  const reviewsData = reviews.length > 0 ? reviews.map(r => ({
    'ID Reseña': r.id,
    'Cliente': r.client_name,
    'Calificación (1-5)': r.rating,
    'Servicio': r.service_name || '',
    'Comentario': r.comment || '',
    'Fecha': r.created_at ? new Date(r.created_at).toISOString() : ''
  })) : [{ 'Mensaje': 'No hay reseñas registradas aún' }];
  const wsReviews = XLSX.utils.json_to_sheet(reviewsData);
  XLSX.utils.book_append_sheet(wb, wsReviews, 'Reseñas');

  // 6. Horarios Bloqueados
  const blockedData = blockedSlots.length > 0 ? blockedSlots.map(b => ({
    'Fecha': b.date,
    'Hora': b.time,
    'Registrado': b.created_at ? new Date(b.created_at).toISOString() : ''
  })) : [{ 'Mensaje': 'No hay franjas horarias bloqueadas' }];
  const wsBlocked = XLSX.utils.json_to_sheet(blockedData);
  XLSX.utils.book_append_sheet(wb, wsBlocked, 'Horarios Bloqueados');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// Generar libro de Excel maestro para la BASE DE DATOS COMPLETA
function generateFullDatabaseExcel(tables) {
  const wb = XLSX.utils.book_new();

  // 1. Comercios
  const wsBiz = XLSX.utils.json_to_sheet(tables.businesses || []);
  XLSX.utils.book_append_sheet(wb, wsBiz, 'Comercios');

  // 2. Citas Globales
  const wsApt = XLSX.utils.json_to_sheet(tables.appointments || []);
  XLSX.utils.book_append_sheet(wb, wsApt, 'Todas las Citas');

  // 3. Servicios
  const wsServ = XLSX.utils.json_to_sheet(tables.services || []);
  XLSX.utils.book_append_sheet(wb, wsServ, 'Servicios');

  // 4. Clientes Registrados
  const wsClients = XLSX.utils.json_to_sheet(tables.clients || []);
  XLSX.utils.book_append_sheet(wb, wsClients, 'Clientes');

  // 5. Usuarios de Negocio
  const wsBizUsers = XLSX.utils.json_to_sheet(tables.businessUsers || []);
  XLSX.utils.book_append_sheet(wb, wsBizUsers, 'Usuarios Negocio');

  // 6. Especialistas
  const wsStaff = XLSX.utils.json_to_sheet(tables.staff || []);
  XLSX.utils.book_append_sheet(wb, wsStaff, 'Especialistas');

  // 7. Reseñas Verificadas
  const wsReviews = XLSX.utils.json_to_sheet(tables.reviews || []);
  XLSX.utils.book_append_sheet(wb, wsReviews, 'Reseñas');

  // 8. Transacciones SINPE
  const wsSinpe = XLSX.utils.json_to_sheet(tables.sinpe || []);
  XLSX.utils.book_append_sheet(wb, wsSinpe, 'SINPE Móvil');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// Ejecutar respaldo completo
export async function runBackupToDrive() {
  console.log('🚀 Iniciando proceso de respaldo automático diario...');
  console.log(`📡 Destino Google Drive: ${GOOGLE_DRIVE_WEBHOOK_URL.substring(0, 50)}...`);

  // Fecha actual en hora de Costa Rica (UTC-6)
  const nowUtc = new Date();
  const costaRicaOffset = -6 * 60; // minutos
  const crTime = new Date(nowUtc.getTime() + (nowUtc.getTimezoneOffset() + costaRicaOffset) * 60000);

  const year = crTime.getFullYear();
  const month = String(crTime.getMonth() + 1).padStart(2, '0');
  const dayOfMonth = String(crTime.getDate()).padStart(2, '0');
  const dayName = DIAS_SEMANA[crTime.getDay()];
  const weekNumber = getIsoWeek(crTime);

  const dateStr = `${year}-${month}-${dayOfMonth}`;
  const weekFolder = `Semana ${weekNumber} - ${year}`;
  const dayFolder = `${dayName} (${dayOfMonth}-${month})`;

  console.log(`📅 Fecha de respaldo: ${dayFolder} de ${weekFolder} (${dateStr})`);

  try {
    // 1. Obtener todos los comercios usando pool.query (seguro para pooling concurrente)
    const { rows: businesses } = await pool.query(`
      SELECT * FROM reservas_businesses ORDER BY name ASC
    `);

    console.log(`🏢 Total de comercios a respaldar: ${businesses.length}`);

    // Crear carpeta local de respaldo por seguridad
    const localBaseDir = path.join(process.cwd(), 'backups');

    let successCount = 0;
    let errorCount = 0;

    for (const b of businesses) {
      const bName = sanitizeName(b.name);
      console.log(`\n📦 Respaldando: "${b.name}" (${b.id})...`);

      // Consultar tablas hijas asociadas
      const [servicesRes, aptRes, staffRes, reviewsRes, blockedRes, usersRes] = await Promise.all([
        pool.query('SELECT * FROM reservas_services WHERE business_id = $1 ORDER BY name ASC', [b.id]),
        pool.query('SELECT * FROM reservas_appointments WHERE business_id = $1 ORDER BY date DESC, time DESC', [b.id]),
        pool.query('SELECT * FROM reservas_staff WHERE business_id = $1 ORDER BY name ASC', [b.id]),
        pool.query('SELECT * FROM reservas_reviews WHERE business_id = $1 ORDER BY created_at DESC', [b.id]),
        pool.query('SELECT * FROM reservas_blocked_slots WHERE business_id = $1 ORDER BY date DESC, time DESC', [b.id]),
        pool.query('SELECT id, name, email, created_at FROM reservas_business_users WHERE business_id = $1', [b.id])
      ]);

      const services = servicesRes.rows;
      const appointments = aptRes.rows;
      const staff = staffRes.rows;
      const reviews = reviewsRes.rows;
      const blockedSlots = blockedRes.rows;
      const users = usersRes.rows;

      // 1. Construir objeto JSON completo
      const jsonData = {
        metadata: {
          export_date: crTime.toISOString(),
          version: '1.0',
          business_id: b.id,
          business_name: b.name
        },
        business: b,
        users,
        services,
        appointments,
        staff,
        reviews,
        blocked_slots: blockedSlots
      };

      // 2. Generar Excel (.xlsx)
      const excelBuffer = generateBusinessExcel(b, services, appointments, staff, reviews, blockedSlots);
      const excelBase64 = excelBuffer.toString('base64');

      // 3. Guardar copia local por seguridad
      try {
        const localDir = path.join(localBaseDir, bName, weekFolder, dayFolder);
        fs.mkdirSync(localDir, { recursive: true });
        fs.writeFileSync(path.join(localDir, `backup_${dateStr}.json`), JSON.stringify(jsonData, null, 2));
        fs.writeFileSync(path.join(localDir, `reporte_${dateStr}.xlsx`), excelBuffer);
      } catch (localErr) {
        console.warn(`  ⚠️ No se pudo guardar copia local en disco: ${localErr.message}`);
      }

      // 4. Enviar a Google Drive (enviando rootFolder: 'DB Backups')
      try {
        const payload = {
          token: BACKUP_SECRET_TOKEN,
          rootFolder: 'DB Backups',
          mainFolder: 'DB Backups',
          folderName: 'DB Backups',
          businessName: bName,
          weekFolder: weekFolder,
          dayFolder: dayFolder,
          date: dateStr,
          jsonData: jsonData,
          excelBase64: excelBase64
        };

        const res = await fetch(GOOGLE_DRIVE_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          redirect: 'follow'
        });

        const resultText = await res.text();
        let resultJson;
        try {
          resultJson = JSON.parse(resultText);
        } catch (_) {
          resultJson = { raw: resultText };
        }

        if (resultJson.status === 'success') {
          console.log(`  ✅ Subido exitosamente a Google Drive (${appointments.length} citas, ${services.length} servicios)`);
          successCount++;
        } else {
          console.error(`  ❌ Error devuelto por Google Drive:`, resultJson);
          errorCount++;
        }
      } catch (uploadErr) {
        console.error(`  ❌ Error de conexión al subir a Google Drive:`, uploadErr.message);
        errorCount++;
      }
    }

    // ==========================================
    // 5. RESPALDO MAESTRO GLOBAL DE LA BASE DE DATOS
    // ==========================================
    console.log(`\n🗄️ Generando respaldo maestro de la Base de Datos completa...`);
    try {
      const [
        allBiz, allServ, allApt, allStaff, allReviews,
        allBlocked, allBizUsers, allClients, allSinpe
      ] = await Promise.all([
        pool.query('SELECT * FROM reservas_businesses ORDER BY id ASC'),
        pool.query('SELECT * FROM reservas_services ORDER BY business_id, id ASC'),
        pool.query('SELECT * FROM reservas_appointments ORDER BY date DESC, time DESC'),
        pool.query('SELECT * FROM reservas_staff ORDER BY business_id, id ASC'),
        pool.query('SELECT * FROM reservas_reviews ORDER BY created_at DESC'),
        pool.query('SELECT * FROM reservas_blocked_slots ORDER BY date DESC'),
        pool.query('SELECT id, business_id, name, email FROM reservas_business_users ORDER BY id ASC'),
        pool.query('SELECT id, name, phone, email, created_at FROM reservas_clients ORDER BY created_at DESC'),
        pool.query('SELECT * FROM reservas_sinpe_transactions ORDER BY received_at DESC')
      ]);

      const fullDbData = {
        metadata: {
          export_date: crTime.toISOString(),
          version: '1.0-full-db',
          total_businesses: allBiz.rows.length,
          total_appointments: allApt.rows.length,
          total_clients: allClients.rows.length
        },
        businesses: allBiz.rows,
        services: allServ.rows,
        appointments: allApt.rows,
        staff: allStaff.rows,
        reviews: allReviews.rows,
        blocked_slots: allBlocked.rows,
        businessUsers: allBizUsers.rows,
        clients: allClients.rows,
        sinpe: allSinpe.rows
      };

      const fullExcelBuffer = generateFullDatabaseExcel(fullDbData);
      const fullExcelBase64 = fullExcelBuffer.toString('base64');

      // Guardar copia local del dump maestro
      const masterLocalDir = path.join(localBaseDir, '_BASE_DE_DATOS_COMPLETA', weekFolder, dayFolder);
      fs.mkdirSync(masterLocalDir, { recursive: true });
      fs.writeFileSync(path.join(masterLocalDir, `full_db_${dateStr}.json`), JSON.stringify(fullDbData, null, 2));
      fs.writeFileSync(path.join(masterLocalDir, `reporte_general_${dateStr}.xlsx`), fullExcelBuffer);

      // Subir el dump maestro a Google Drive
      const masterPayload = {
        token: BACKUP_SECRET_TOKEN,
        rootFolder: 'DB Backups',
        mainFolder: 'DB Backups',
        folderName: 'DB Backups',
        businessName: '_BASE_DE_DATOS_COMPLETA',
        weekFolder: weekFolder,
        dayFolder: dayFolder,
        date: dateStr,
        jsonData: fullDbData,
        excelBase64: fullExcelBase64
      };

      const resMaster = await fetch(GOOGLE_DRIVE_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(masterPayload),
        redirect: 'follow'
      });

      const resMasterText = await resMaster.text();
      let resMasterJson;
      try { resMasterJson = JSON.parse(resMasterText); } catch (_) { resMasterJson = { raw: resMasterText }; }

      if (resMasterJson.status === 'success') {
        console.log(`  ✅ Respaldo MAESTRO completo subido a Google Drive exitosamente.`);
        successCount++;
      } else {
        console.warn(`  ⚠️ Alerta en respaldo maestro:`, resMasterJson);
      }
    } catch (masterErr) {
      console.error('❌ Error generando respaldo maestro completo:', masterErr.message);
    }

    console.log(`\n🎉 Respaldo completado: ${successCount} paquetes exitosos, ${errorCount} errores.`);
  } catch (err) {
    console.error('❌ Error fatal en el proceso de respaldo:', err);
  } finally {
    // Cerrar el pool al terminar si se corre como script independiente
    await pool.end();
  }
}

// Ejecución si se llama directamente desde CLI
if (process.argv[1] && process.argv[1].endsWith('backup-drive.js')) {
  runBackupToDrive()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
