# 📜 Historial de Conversaciones y Sesiones • Reservas CR (Antigravity)

**Proyecto:** `Reservas CR`  
**Ubicación del Proyecto:** `C:\Users\Juan\Proyectos Antigravity\ReservasCR`  
**Repositorio GitHub:** `https://github.com/pampo32-hub/Reservas.git` (rama `main`)  
**Dominio de Producción:** `https://reservascr.app`  
**Servidor VPS:** Contabo (`194.163.189.190` / `vmi3612559.contaboserver.net`)  
**Ruta de App en VPS:** `/home/Juan/web/reservas` (Gestionado con PM2: `id 0`, proceso `reservas`)  
**Base de Datos:** PostgreSQL en Neon Cloud (Serverless)  
**Última Actualización:** 27 de Septiembre, 2026 (01:25 CST)

---

## 🛠️ Resumen Completo de Hitos y Configuraciones

### 1. Sistema de Respaldos Diarios Automáticos a Google Drive
- **Horario programado:** Todos los días a las **11:59 PM (23:59)** vía Cron en el VPS.
- **Zona horaria del VPS:** Configurada en `America/Costa_Rica` (hora exacta de Costa Rica).
- **Formatos duales:**
  - Archivo `.json`: Respaldo técnico fiel de todas las tablas y columnas (perfil, servicios, citas, colaboradores, reseñas, horarios bloqueados).
  - Archivo `.xlsx` (Excel): Reporte multi-pestaña generado con `xlsx` formateado para lectura directa en Google Sheets.
- **Estructura jerárquica automática en Google Drive:**
  `📁 Backups Reservas` $\rightarrow$ `📁 [Nombre del Negocio]` $\rightarrow$ `📁 Semana XX - 2026` $\rightarrow$ `📁 [Día] (DD-MM)` $\rightarrow$ `backup_YYYY-MM-DD.json` & `reporte_YYYY-MM-DD.xlsx`.
- **Scripts del proyecto:**
  - `scripts/backup-drive.js` (`npm run backup:drive`): Ejecuta el respaldo y lo transmite al Webhook de Google Apps Script.
  - `scripts/restore-business.js` (`npm run restore:business <ruta-al-json>`): Restaura un negocio completo en PostgreSQL en 2 segundos de forma idempotente.
- **Webhook receptor en Google Apps Script:**
  - URL: `https://script.google.com/macros/s/AKfycbysyqyNsJby8b29w6_WyEX-ol1QmjEa_CrLPqs8ouRCZ-K0pL1Bt4Z-z1alH-4SzBbG/exec`
  - Token de seguridad: `ReservasCR_Backup_Key_2026_Secure`.

### 2. Conexión Directa SSH entre Asistente y VPS
- Se generó un par de llaves Ed25519 en `C:\Users\Juan\.ssh\id_ed25519`.
- La clave pública fue añadida a `~/.ssh/authorized_keys` en el VPS.
- **Resultado:** El agente AI puede conectarse por SSH directamente al VPS (`root@194.163.189.190`) y ejecutar tareas administrativas de forma autónoma.

### 3. Seguridad del Servidor y Protección contra Fuerza Bruta (Fail2ban)
- **Cárcel `[sshd]`:** 5 intentos fallidos en 10 minutos $\rightarrow$ Baneo temporal de **48 horas**.
- **Cárcel `[recidive]`:** Reincidentes en un rango de 1 semana $\rightarrow$ Baneo **permanente de por vida** (`bantime = -1`) en todos los puertos.
- **Lista blanca (`ignoreip`):** IP del administrador (`186.4.56.200`) añadida a la lista de exclusión en `/etc/fail2ban/jail.local` para garantizar acceso permanente.
- Soporte `python3-systemd` instalado y activo.

### 4. Seguridad de la Aplicación Web (Login Rate Limiter)
- Archivo: `server.js`.
- Mecanismo en memoria para el endpoint `/api/auth/login`:
  - Máximo 5 intentos por IP/cuenta.
  - En el 3º intento fallido: Advierte *"Contraseña incorrecta. Te quedan 2 intentos."*
  - En el 4º intento fallido: Advierte *"Contraseña incorrecta. Te queda 1 intento."*
  - Al 5º intento fallido: Bloquea por 5 minutos respondiendo *"Demasiados intentos de inicio de sesión. Inténtalo más tarde."* (código HTTP 429).
  - Al iniciar sesión con éxito, el contador se resetea automáticamente.

### 5. Despliegue Continuo Automatizado (CI/CD)
- Archivo: `.github/workflows/deploy.yml`.
- Cada `git push origin main` activa el flujo de GitHub Actions que se conecta al VPS por SSH y ejecuta `/home/masteradmin/deploy.sh` (actualizando el código en `/home/Juan/web/reservas` y reiniciando con PM2).

### 6. Almacenamiento Físico de Imágenes en Disco VPS (Zero Base64 en Base de Datos)
- **Problema Solucionado:** Las fotos de perfil, banners y portafolios subidas por comercios en base64 inflaban la base de datos de Neon y consumían almacenamiento innecesariamente.
- **Arquitectura Implementada:**
  - Las imágenes se procesan en el backend (`processAndSaveImage`) y se guardan físicamente en el disco del VPS organizadas en una carpeta propia por cada comercio:
    `📁 public/uploads/comercios/:id_comercio/`
    - Logo: `/uploads/comercios/:id/logo_...`
    - Portada: `/uploads/comercios/:id/portada_...`
    - Portafolio: `/uploads/comercios/:id/portafolio/port_...`
    - Equipo: `/uploads/comercios/:id/equipo/staff_...`
  - En la base de datos Neon PostgreSQL solo se guarda la URL limpia (ej. `/uploads/comercios/biz-1/portada_123.jpg`), que pesa menos de 50 bytes.
  - Se configuró la ruta estática `/uploads` con caché de 30 días para carga ultra rápida en navegadores.
  - Se creó un enlace simbólico entre `/home/Juan/web/reservas/public/uploads` y `/home/masteradmin/web/reservascr.app/public_html/uploads` para que Nginx sirva las fotos directamente a nivel de web server sin saturar Node.js.
  - Endpoint utilitario: `POST /api/upload`.

### 7. Escritorio Remoto (XRDP), Google Chrome y Hardening de VPS
- **XRDP / Conexión Remota:** Se solucionó el fallo de conexión abriendo el puerto 3389 en el firewall de HestiaCP, añadiendo `xrdp` al grupo `ssl-cert`, y configurando `startxfce4` en `/etc/xrdp/startwm.sh` y `/root/.xsession`.
- **Google Chrome:** Instalado paquete oficial (`google-chrome-stable`) con bandera `--no-sandbox` para ejecución como root y acceso directo en el escritorio `/root/Desktop/google-chrome.desktop`.
- **Limpieza de Cortafuegos (Firewall):** Se eliminaron las reglas redundantes que exponían el puerto `5432` (PostgreSQL local) al internet, blindando el servidor de escaneos y ataques de fuerza bruta externos (la BD local se comunica exclusivamente por `127.0.0.1`).
- **Configuración SSL & Cloudflare:** El dominio `reservascr.app` está detrás del proxy de Cloudflare. Se debe mantener `SSL_FORCE: no` en HestiaCP para evitar bucles infinitos de redirección (`ERR_TOO_MANY_REDIRECTS`), ya que Cloudflare se encarga del cifrado SSL hacia el navegador del cliente.

### 8. Migración Completa de Base de Datos al VPS (Localhost PostgreSQL)
- **Motivo:** En Neon Tech se habían consumido 66.28 CU-hrs de las 100 horas mensuales gratuitas en solo 14 días. Para evitar el apagado de la base de datos o el cobro de $19/mes, se migró a la instancia local de PostgreSQL en el VPS.
- **Base de datos:** `reservas_db` (PostgreSQL 14 en localhost).
- **Usuario:** `reservas_user` (con permisos SUPERUSER y acceso exclusivo local).
- **Cadena de conexión:** `postgresql://reservas_user:...@127.0.0.1:5432/reservas_db`.
- **Rendimiento:** Latencia de consulta reducida de ~120 ms a menos de **0.5 ms**. Cero retrasos de "despertar" (*cold starts*).
- **Almacenamiento:** Sin límites de 500 MB (aprovechando los 89 GB libres del disco).
- **Integridad de datos:** Las 15 tablas del sistema, 32 comercios demo, 76 servicios, configuraciones de PayPal y usuarios developer están 100% operativos.
- **Seguridad:** Archivo `.env` en el VPS blindado con permisos `chmod 600`.
- **Respaldos:** El script `scripts/backup-drive.js` respalda la base de datos local y transmite a Google Drive todos los días a las 11:59 PM.

### 9. Optimizaciones Previas de la Aplicación
- **Resolución de Nombre del Comercio en Reservas del Cliente:** Se corrigió un error de sintaxis SQL en `/api/clients/:phone/appointments` (WHERE duplicado) que causaba error 500 y forzaba el fallback local con el nombre genérico "Comercio". Se normalizó la inyección de `businessName` en creación (`POST /api/appointments`), sincronización en segundo plano con el servidor y fallback jerárquico a `storage.getBusinessById(apt.businessId)?.name` tanto en la lista de reservas como en las vistas de calificación y reseñas.
- **Validación Obligatoria de Datos de Cliente:** Se configuró como obligatorio el Nombre, Teléfono y Correo Electrónico en frontend y backend (`POST /api/appointments` y `POST /api/auth/client/login-or-register`) para toda reserva (incluso sin registro formal de cuenta), garantizando que todo cliente tenga sus datos completos para confirmaciones y recordatorios.
- **Botón "15 Días Gratis":** Controlado por la constante `SHOW_15_DAYS_FREE_BUTTON` en `src/app.js`.
- **Caché PWA:** `sw.js` en versión activa `v37`.
- **Evitación de parpadeo (Zero-Jitter):** Clases y propiedades en `main.css` y `index.html`.
- **Gestión de Citas:** Sincronización Nylas (Google / Apple Calendar), WhatsApp Cloud API, comprobantes SINPE Móvil.



---

## 📌 Guía para Retomar Sesión desde Otra Cuenta

Si inicias sesión con otra cuenta de Antigravity, simplemente escribe en el primer mensaje:
> **"Por favor lee `HISTORIAL_CONVERSACIONES_Y_SESIONES.md` para retomar el contexto del proyecto ReservasCR."**

El asistente leerá este archivo y tendrá inmediatamente el 100% del contexto técnico, credenciales de arquitectura y estado del proyecto sin perder ningún avance.

