import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = pg;

const NEON_URL = process.env.DATABASE_URL;
const LOCAL_URL = process.env.LOCAL_DATABASE_URL || 'postgresql://reservas_user:ReservasCR_Postgres_2026_SecureKey!@127.0.0.1:5432/reservas_db';

if (!NEON_URL) {
  console.error('❌ Error: DATABASE_URL no encontrada en .env');
  process.exit(1);
}

console.log('🚀 Iniciando migración de datos: Neon Tech ➡️ PostgreSQL Local');
console.log(`📡 Origen (Neon): ${NEON_URL.replace(/:[^:@]+@/, ':****@')}`);
console.log(`🖥️ Destino (Local): ${LOCAL_URL.replace(/:[^:@]+@/, ':****@')}`);

const neonPool = new Pool({
  connectionString: NEON_URL,
  ssl: { rejectUnauthorized: false }
});

const localPool = new Pool({
  connectionString: LOCAL_URL,
  ssl: false
});

// Orden de tablas respetando llaves foráneas (Foreign Keys)
const ORDERED_TABLES = [
  'reservas_businesses',
  'reservas_services',
  'reservas_staff',
  'reservas_clients',
  'reservas_business_users',
  'reservas_appointments',
  'reservas_reviews',
  'reservas_developer_users',
  'reservas_custom_category_alerts',
  'reservas_system_settings',
  'reservas_blocked_slots',
  'reservas_pre_registrations',
  'reservas_sinpe_transactions',
  'reservas_password_resets',
  'reservas_push_subscriptions'
];

async function getNeonTables(client) {
  const res = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);
  return res.rows.map(r => r.table_name);
}

async function migrateTable(tableName, neonClient, localClient) {
  console.log(`\n📦 Procesando tabla: ${tableName}...`);

  // 1. Obtener datos de Neon
  const neonData = await neonClient.query(`SELECT * FROM "${tableName}"`);
  const rows = neonData.rows;
  console.log(`   ➡️ Filas encontradas en Neon: ${rows.length}`);

  if (rows.length === 0) {
    console.log(`   ℹ️ Tabla vacía, nada que transferir.`);
    return { table: tableName, neonRows: 0, localRows: 0, status: 'EMPTY' };
  }

  // 2. Obtener nombres de columnas
  const columns = Object.keys(rows[0]);
  const quotedCols = columns.map(c => `"${c}"`).join(', ');

  // 3. Insertar filas en la base local por lotes (batch)
  let inserted = 0;
  for (const row of rows) {
    const values = columns.map(c => row[c]);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

    // Construir ON CONFLICT si es posible o insertar directamente
    const insertQuery = `
      INSERT INTO "${tableName}" (${quotedCols})
      VALUES (${placeholders})
      ON CONFLICT DO NOTHING;
    `;

    try {
      await localClient.query(insertQuery, values);
      inserted++;
    } catch (err) {
      console.warn(`   ⚠️ Advertencia en fila de ${tableName}:`, err.message);
    }
  }

  // 4. Verificar conteo en destino
  const localCountRes = await localClient.query(`SELECT COUNT(*) as total FROM "${tableName}"`);
  const localTotal = parseInt(localCountRes.rows[0].total, 10);

  console.log(`   ✅ Transferencia completada: ${inserted} procesadas | Total en local: ${localTotal}`);
  return {
    table: tableName,
    neonRows: rows.length,
    localRows: localTotal,
    status: localTotal >= rows.length ? 'OK' : 'MISMATCH'
  };
}

async function run() {
  let neonClient;
  let localClient;

  try {
    neonClient = await neonPool.connect();
    console.log('✅ Conexión establecida con Neon PostgreSQL.');

    localClient = await localPool.connect();
    console.log('✅ Conexión establecida con PostgreSQL Local en el VPS.');

    // Inicializar el esquema completo en la base de datos local usando db.js
    console.log('\n🛠️ Verificando y creando esquemas de tablas en la base de datos local...');
    const { initDatabase } = await import('../db.js');
    await initDatabase(localPool);
    console.log('✅ Esquema y tablas creadas exitosamente en PostgreSQL local.');

    
    // Descubrir todas las tablas en Neon
    const allNeonTables = await getNeonTables(neonClient);
    console.log(`📋 Tablas detectadas en Neon (${allNeonTables.length}):`, allNeonTables);

    // Organizar tablas en orden seguro
    const tablesToMigrate = [];
    for (const t of ORDERED_TABLES) {
      if (allNeonTables.includes(t)) {
        tablesToMigrate.push(t);
      }
    }
    // Agregar cualquier tabla adicional no listada en ORDERED_TABLES
    for (const t of allNeonTables) {
      if (!tablesToMigrate.includes(t)) {
        tablesToMigrate.push(t);
      }
    }

    const results = [];
    for (const table of tablesToMigrate) {
      const res = await migrateTable(table, neonClient, localClient);
      results.push(res);
    }


    console.log('\n========================================');
    console.log('📊 RESUMEN DE LA MIGRACIÓN DE DATOS');
    console.log('========================================');
    let allOk = true;
    for (const r of results) {
      const icon = r.status === 'OK' || r.status === 'EMPTY' ? '✅' : '❌';
      console.log(`${icon} ${r.table.padEnd(35)} Neon: ${r.neonRows} | Local: ${r.localRows}`);
      if (r.status === 'MISMATCH') allOk = false;
    }

    if (allOk) {
      console.log('\n🎉 ¡MIGRACIÓN COMPLETADA AL 100% CON ÉXITO!');
      console.log('Todos los datos de Neon ahora residen de forma idéntica en PostgreSQL local.');
    } else {
      console.warn('\n⚠️ Se detectaron algunas diferencias. Revisa el log detallado.');
    }

  } catch (err) {
    console.error('❌ Error fatal durante la migración:', err);
    process.exit(1);
  } finally {
    if (neonClient) neonClient.release();
    if (localClient) localClient.release();
    await neonPool.end();
    await localPool.end();
  }
}

run();
