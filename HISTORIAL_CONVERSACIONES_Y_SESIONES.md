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

### 6. Optimizaciones Previas de la Aplicación
- **Botón "15 Días Gratis":** Controlado por la constante `SHOW_15_DAYS_FREE_BUTTON` en `src/app.js`.
- **Caché PWA:** `sw.js` en versión activa `v35`.
- **Evitación de parpadeo (Zero-Jitter):** Clases y propiedades en `main.css` y `index.html`.
- **Gestión de Citas:** Sincronización Nylas (Google / Apple Calendar), WhatsApp Cloud API, comprobantes SINPE Móvil.

---

## 📌 Guía para Retomar Sesión desde Otra Cuenta

Si inicias sesión con otra cuenta de Antigravity, simplemente escribe en el primer mensaje:
> **"Por favor lee `HISTORIAL_CONVERSACIONES_Y_SESIONES.md` para retomar el contexto del proyecto ReservasCR."**

El asistente leerá este archivo y tendrá inmediatamente el 100% del contexto técnico, credenciales de arquitectura y estado del proyecto sin perder ningún avance.
