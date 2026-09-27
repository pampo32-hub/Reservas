-- Setup local PostgreSQL database for ReservasCR
DO
$do$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'reservas_user') THEN
      CREATE USER reservas_user WITH PASSWORD 'ReservasCR_Postgres_2026_SecureKey!';
   ELSE
      ALTER USER reservas_user WITH PASSWORD 'ReservasCR_Postgres_2026_SecureKey!';
   END IF;
END
$do$;

SELECT 'CREATE DATABASE reservas_db OWNER reservas_user'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'reservas_db')\gexec

GRANT ALL PRIVILEGES ON DATABASE reservas_db TO reservas_user;
