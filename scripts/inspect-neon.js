import pg from 'pg';

const { Pool } = pg;
const NEON_URL = "postgresql://neondb_owner:npg_DGXRwl4kBtC7@ep-shy-firefly-b5sbjmrd-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function inspectNeon() {
  const pool = new Pool({
    connectionString: NEON_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const client = await pool.connect();
    console.log('✅ Conectado a Neon');

    const searchPathRes = await client.query('SHOW search_path;');
    console.log('search_path:', searchPathRes.rows[0]);

    const schemasRes = await client.query('SELECT schema_name FROM information_schema.schemata;');
    console.log('Schemas en Neon:', schemasRes.rows.map(r => r.schema_name));

    const tablesRes = await client.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_name LIKE '%reservas%' OR table_schema NOT IN ('pg_catalog', 'information_schema');
    `);
    console.log('Tablas encontradas en Neon:', tablesRes.rows);

    for (const t of tablesRes.rows) {
      try {
        const countRes = await client.query(`SELECT COUNT(*) as total FROM "${t.table_schema}"."${t.table_name}"`);
        console.log(`📊 ${t.table_schema}.${t.table_name}: ${countRes.rows[0].total} filas`);
      } catch (e) {
        console.log(`❌ Error contando ${t.table_schema}.${t.table_name}:`, e.message);
      }
    }

    client.release();
  } catch (err) {
    console.error('Error inspeccionando Neon:', err);
  } finally {
    await pool.end();
  }
}

inspectNeon();
