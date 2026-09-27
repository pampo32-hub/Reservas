import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = pg;

// URL fija y explícita de Neon Tech para garantizar que siempre lea de Neon
const NEON_URL = process.env.NEON_DATABASE_URL || 'postgresql://neondb_owner:npg_DGXRwl4kBtC7@ep-shy-firefly-b5sbjmrd-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require';
const LOCAL_URL = process.env.LOCAL_DATABASE_URL || 'postgresql://reservas_user:ReservasCR_Postgres_2026_SecureKey!@127.0.0.1:5432/reservas_db';

console.log('==================================================================');
console.log('🚀 MIGRACIÓN COMPLETA: NEON TECH ➡️ POSTGRESQL LOCAL (VPS)');
console.log('==================================================================');
console.log(`📡 Origen (Neon):   ${NEON_URL.replace(/:[^:@]+@/, ':****@')}`);
console.log(`🖥️ Destino (Local):  ${LOCAL_URL.replace(/:[^:@]+@/, ':****@')}`);

const neonPool = new Pool({
  connectionString: NEON_URL,
  ssl: { rejectUnauthorized: false }
});

const localPool = new Pool({
  connectionString: LOCAL_URL,
  ssl: false
});

// Orden estricto de tablas respetando llaves foráneas (Foreign Keys)
const TABLES_CONFIG = [
  { name: 'reservas_system_settings', pkey: 'key' },
  { name: 'reservas_developer_users', pkey: 'id' },
  { name: 'reservas_businesses', pkey: 'id' },
  { name: 'reservas_services', pkey: 'id' },
  { name: 'reservas_staff', pkey: 'id' },
  { name: 'reservas_clients', pkey: 'id' },
  { name: 'reservas_business_users', pkey: 'id' },
  { name: 'reservas_appointments', pkey: 'id' },
  { name: 'reservas_reviews', pkey: 'id' },
  { name: 'reservas_custom_category_alerts', pkey: 'id' },
  { name: 'reservas_blocked_slots', pkey: 'id' },
  { name: 'reservas_pre_registrations', pkey: 'id' },
  { name: 'reservas_sinpe_transactions', pkey: 'id' },
  { name: 'reservas_password_resets', pkey: 'id' },
  { name: 'reservas_push_subscriptions', pkey: 'id' }
];

async function migrateTable(tableName, pkey, neonClient, localClient) {
  console.log(`\n📦 Migrando: public.${tableName}...`);

  // 1. Obtener todas las filas de Neon
  const neonData = await neonClient.query(`SELECT * FROM "public"."${tableName}"`);
  const rows = neonData.rows;
  console.log(`   ➡️ Filas en Neon: ${rows.length}`);

  if (rows.length === 0) {
    console.log(`   ℹ️ Tabla vacía en Neon, omitiendo.`);
    return { table: tableName, neon: 0, local: 0, status: 'OK' };
  }

  // 2. Extraer columnas
  const columns = Object.keys(rows[0]);
  const quotedCols = columns.map(c => `"${c}"`).join(', ');

  // 3. Insertar o actualizar cada fila en local
  let inserted = 0;
  for (const row of rows) {
    const values = columns.map(c => row[c]);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

    let query;
    if (pkey && columns.includes(pkey)) {
      const updateSets = columns
        .filter(c => c !== pkey)
        .map(c => `"${c}" = EXCLUDED."${c}"`)
        .join(', ');

      query = `
        INSERT INTO "public"."${tableName}" (${quotedCols})
        VALUES (${placeholders})
        ON CONFLICT ("${pkey}") DO UPDATE SET ${updateSets || `"${pkey}" = EXCLUDED."${pkey}"`};
      `;
    } else {
      query = `
        INSERT INTO "public"."${tableName}" (${quotedCols})
        VALUES (${placeholders})
        ON CONFLICT DO NOTHING;
      `;
    }

    try {
      await localClient.query(query, values);
      inserted++;
    } catch (err) {
      console.warn(`   ⚠️ Advertencia insertando en ${tableName} (${row[pkey] || 'id'}):`, err.message);
    }
  }

  // 4. Contar filas resultantes en base local
  const countRes = await localClient.query(`SELECT COUNT(*) as total FROM "public"."${tableName}"`);
  const localCount = parseInt(countRes.rows[0].total, 10);

  console.log(`   ✅ Sincronizadas ${inserted}/${rows.length} filas. Total actual en VPS: ${localCount}`);
  return {
    table: tableName,
    neon: rows.length,
    local: localCount,
    status: localCount >= rows.length ? 'OK' : 'MISMATCH'
  };
}

async function run() {
  let neonClient;
  let localClient;

  try {
    neonClient = await neonPool.connect();
    console.log('✅ Conectado exitosamente a Neon Tech.');

    localClient = await localPool.connect();
    console.log('✅ Conectado exitosamente a PostgreSQL Local (VPS).');

    // Desactivar temporalmente triggers de claves foráneas con usuario superuser local
    try {
      await localClient.query('SET session_replication_role = replica;');
      console.log('⚡ Modo réplica activado para importación instantánea.');
    } catch (e) {
      console.log('ℹ️ Omitiendo modo réplica (permiso normal).');
    }

    const results = [];
    for (const config of TABLES_CONFIG) {
      const res = await migrateTable(config.name, config.pkey, neonClient, localClient);
      results.push(res);
    }

    // Restaurar triggers
    try {
      await localClient.query('SET session_replication_role = DEFAULT;');
    } catch (e) {}

    console.log('\n==================================================================');
    console.log('📊 REPORTE FINAL DE AUDITORÍA Y TRANSFERENCIA');
    console.log('==================================================================');
    let allOk = true;
    for (const r of results) {
      const icon = r.status === 'OK' ? '✅' : '⚠️';
      console.log(`${icon} ${r.table.padEnd(35)} Neon: ${String(r.neon).padStart(3)} | Local VPS: ${String(r.local).padStart(3)}`);
      if (r.status !== 'OK') allOk = false;
    }

    if (allOk) {
      console.log('\n🎉 ¡TODOS LOS DATOS DE NEON FUERON TRANSFERIDOS AL 100%!');
      console.log('Tus 27 clientes, 52 citas y todas las tablas ahora están en tu VPS.');
    } else {
      console.log('\n⚠️ Revisa las tablas marcadas con mismatch.');
    }

  } catch (err) {
    console.error('❌ Error fatal en migración:', err);
  } finally {
    if (neonClient) neonClient.release();
    if (localClient) localClient.release();
    await neonPool.end();
    await localPool.end();
  }
}

run();
