import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import QRCode from 'qrcode';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

async function main() {
  console.log('🚀 Generando volantes horizontales media carta para Reservas CR...');

  // 1. Cargar el logo oficial de la página (reservas_cr_clean_badge_1.png) en base64
  const logoPath = path.join(rootDir, 'src', 'assets', 'reservas_cr_clean_badge_1.png');
  let logoBase64 = '';
  if (fs.existsSync(logoPath)) {
    const imgBuffer = fs.readFileSync(logoPath);
    logoBase64 = `data:image/png;base64,${imgBuffer.toString('base64')}`;
  }

  // Copiar también el logo a public/ para acceso web directo
  const publicLogoPath = path.join(rootDir, 'public', 'reservas_cr_clean_badge_1.png');
  if (fs.existsSync(logoPath) && !fs.existsSync(publicLogoPath)) {
    fs.copyFileSync(logoPath, publicLogoPath);
  }

  // 2. Generar Código QR de alta resolución hacia la página de registro
  const qrUrl = 'https://reservascr.app/unete';
  const qrDataUrl = await QRCode.toDataURL(qrUrl, {
    errorCorrectionLevel: 'H',
    margin: 1,
    width: 700,
    color: {
      dark: '#0f172a',
      light: '#ffffff'
    }
  });

  // Bandera de Costa Rica en SVG nítido
  const crFlagSvg = `
    <svg width="24" height="15" viewBox="0 0 5 3" style="border-radius: 2px; display: inline-block; vertical-align: middle; box-shadow: 0 1px 3px rgba(0,0,0,0.25);">
      <rect width="5" height="3" fill="#002B7F"/>
      <rect width="5" height="2" y="0.5" fill="#FFFFFF"/>
      <rect width="5" height="1" y="1" fill="#CE1126"/>
    </svg>
  `;

  // 3. Contenido interno de CADA volante HORIZONTAL (Landscape 8.5in x 5.5in / 1700px x 1100px)
  const flyerInnerContent = `
    <!-- HEADER SUPERIOR -->
    <div class="f-header">
      <div class="f-brand">
        <img src="${logoBase64 || '/src/assets/reservas_cr_clean_badge_1.png'}" alt="Reservas CR Logo" class="f-brand-logo" />
        <div>
          <div class="f-brand-title">RESERVAS CR ${crFlagSvg}</div>
          <div class="f-brand-sub">Directorio Digital & Sistema de Citas Oficial de Costa Rica</div>
        </div>
      </div>
      <div class="f-pill-badge">🇨🇷 EXCLUSIVO PARA COMERCIOS</div>
    </div>

    <!-- CUERPO PRINCIPAL EN 2 COLUMNAS (62% IZQUIERDA / 38% DERECHA) -->
    <div class="f-body-grid">
      <!-- COLUMNA IZQUIERDA: BENEFICIOS, PROMO Y PLANES SIN PRECIOS -->
      <div class="f-left-col">
        <!-- GANCHO PRINCIPAL -->
        <div class="f-hook-box">
          <div class="f-hook-eyebrow">⚡ AUTOMATIZA TU NEGOCIO Y LIBERA TU TIEMPO</div>
          <h1 class="f-hook-title">
            ¿Cansado de perder citas y contestar WhatsApp a deshoras?
          </h1>
          <p class="f-hook-desc">
            Pon tu agenda en piloto automático. Permite que tus clientes vean tus servicios y horarios libres para que <strong>agenden solos las 24 horas del día</strong>.
          </p>
        </div>

        <!-- 4 BENEFICIOS CLAVE -->
        <div class="f-features-grid">
          <div class="f-feature-card">
            <div class="f-f-icon">🔗</div>
            <div class="f-f-info">
              <strong>Tu Propio Link en la Bio (Instagram, TikTok & WhatsApp)</strong>
              <p>Tus clientes entran, ven tus servicios, precios y horarios libres para reservar en 30 segundos sin esperas.</p>
            </div>
          </div>

          <div class="f-feature-card">
            <div class="f-f-icon">📲</div>
            <div class="f-f-info">
              <strong>Recordatorios y Confirmación por WhatsApp</strong>
              <p>Reduce hasta un 80% las citas olvidadas y los clientes ausentes con avisos automáticos antes de cada cita.</p>
            </div>
          </div>

          <div class="f-feature-card">
            <div class="f-f-icon">💼</div>
            <div class="f-f-info">
              <strong>Caja POS, Comisiones y Control de Ingresos</strong>
              <p>Cobro rápido con SINPE Móvil, <strong>cálculo automático de comisiones para tus colaboradores</strong> y reportes claros.</p>
            </div>
          </div>

          <div class="f-feature-card">
            <div class="f-f-icon">🎁</div>
            <div class="f-f-info">
              <strong>Fidelización con Sellos QR y Vitrina en el Directorio</strong>
              <p>Premia a tus clientes frecuentes con tarjetas de sellos digitales y atrae clientes nuevos desde el directorio.</p>
            </div>
          </div>
        </div>

        <!-- MEGA BANNER DE LANZAMIENTO -->
        <div class="f-promo-banner">
          <div class="f-promo-tag">🎉 BENEFICIO DE ESTRENO EXCLUSIVO</div>
          <div class="f-promo-main">¡15 DÍAS GRATIS DEL PLAN PROFESIONAL!</div>
          <div class="f-promo-sub">Sin contratos forzosos · 0% de comisiones por reserva · Sin ingresar tarjeta de crédito</div>
        </div>

        <!-- RESUMEN DE PLANES (SIN PRECIOS) -->
        <div class="f-plans-box">
          <div class="f-plans-header">
            <span>PLANES A TU MEDIDA:</span>
            <span class="f-plans-note">✓ Planes accesibles para todo tamaño de negocio · Cancela cuando quieras</span>
          </div>
          <div class="f-plans-grid">
            <div class="f-plan-pill">
              <span class="f-plan-name">Plan Básico</span>
              <span class="f-plan-desc">1 Especialista · 150 citas/mes<br>Alertas WhatsApp</span>
            </div>
            <div class="f-plan-pill f-plan-pill-pop">
              <span class="f-plan-pop-badge">MÁS POPULAR</span>
              <span class="f-plan-name">Plan Profesional</span>
              <span class="f-plan-desc">Hasta 5 Colaboradores · 300 citas/mes<br>Caja POS y Comisiones</span>
            </div>
            <div class="f-plan-pill">
              <span class="f-plan-name">Plan Premium</span>
              <span class="f-plan-desc">Colaboradores Ilimitados · 600 citas/mes<br>Destacado en Directorio</span>
            </div>
          </div>
        </div>
      </div>

      <!-- COLUMNA DERECHA: CONVERSIÓN Y QR GIGANTE -->
      <div class="f-right-col">
        <div class="f-cta-card">
          <!-- BLOQUE SUPERIOR CTA -->
          <div class="f-cta-block-top">
            <div class="f-cta-badge">⚡ REGISTRO RÁPIDO DE COMERCIOS</div>
            <h2 class="f-cta-title">¡Activa tu agenda en 2 minutos!</h2>
            <p class="f-cta-desc">Apunta con la cámara de tu celular al código QR:</p>
          </div>
          
          <!-- BLOQUE CENTRAL CON QR GIGANTE -->
          <div class="f-cta-block-mid">
            <div class="f-qr-container">
              <img src="${qrDataUrl}" alt="Escanear QR Reservas CR" class="f-qr-image" />
              <div class="f-qr-label">📱 ESCANÉAME CON TU CÁMARA</div>
            </div>
            <div class="f-steps-mini">
              <span>1️⃣ Escanea el QR</span>
              <span>2️⃣ Registra tu negocio</span>
              <span>3️⃣ ¡Recibe citas 24/7!</span>
            </div>
          </div>

          <!-- BLOQUE INFERIOR CON ENLACE Y SOPORTE -->
          <div class="f-cta-block-bot">
            <div class="f-url-box">
              <span class="f-url-label">O entra directo en tu navegador a:</span>
              <div class="f-url-btn">reservascr.app/unete</div>
            </div>

            <div class="f-support-line">
              ${crFlagSvg} Soporte oficial en Costa Rica: <strong>soporte@reservascr.app</strong>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- FOOTER INFERIOR -->
    <div class="f-footer">
      Ideal para Barberías, Salones de Belleza, Estéticas, Spas, Uñas, Tatuajes, Fisioterapia, Clínicas, Psicología, Veterinarias y Talleres.
    </div>
  `;

  // Estilos CSS optimizados para el formato HORIZONTAL (1700px x 1100px)
  const sharedStyles = `
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      color: #0f172a;
      background-color: #ffffff;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }

    /* CONTENEDOR DEL VOLANTE HORIZONTAL (LANDSCAPE 8.5in x 5.5in) */
    .flyer-card-horizontal {
      background: #ffffff;
      padding: 24px 34px 16px 34px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
      position: relative;
      height: 100%;
    }

    /* HEADER */
    .f-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 12px;
    }

    .f-brand {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .f-brand-logo {
      width: 58px;
      height: 58px;
      object-fit: cover;
      border-radius: 50%;
      box-shadow: 0 4px 12px rgba(0,0,0,0.18);
      border: 1px solid rgba(0,0,0,0.1);
    }

    .f-brand-title {
      font-size: 27px;
      font-weight: 900;
      letter-spacing: -0.5px;
      color: #0f172a;
      line-height: 1.1;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .f-brand-sub {
      font-size: 11.5px;
      color: #64748b;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      margin-top: 3px;
    }

    .f-pill-badge {
      background: #0f172a;
      color: #38bdf8;
      font-size: 13px;
      font-weight: 800;
      padding: 7px 16px;
      border-radius: 9999px;
      letter-spacing: 0.5px;
      white-space: nowrap;
    }

    /* GRID CUERPO PRINCIPAL */
    .f-body-grid {
      display: grid;
      grid-template-columns: 63% 37%;
      gap: 24px;
      align-items: stretch;
      margin: 12px 0 10px 0;
      flex: 1;
    }

    .f-left-col {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    /* GANCHO */
    .f-hook-box {
      margin-bottom: 4px;
    }

    .f-hook-eyebrow {
      font-size: 11.5px;
      font-weight: 900;
      color: #0284c7;
      letter-spacing: 1px;
      margin-bottom: 3px;
    }

    .f-hook-title {
      font-size: 29px;
      font-weight: 900;
      line-height: 1.18;
      color: #0f172a;
      margin-bottom: 6px;
      letter-spacing: -0.4px;
    }

    .f-hook-desc {
      font-size: 15px;
      color: #334155;
      line-height: 1.36;
    }

    .f-hook-desc strong {
      color: #0284c7;
      font-weight: 800;
    }

    /* BENEFICIOS */
    .f-features-grid {
      display: flex;
      flex-direction: column;
      gap: 7px;
      margin: 7px 0;
    }

    .f-feature-card {
      display: flex;
      align-items: center;
      gap: 14px;
      background: #f8fafc;
      border: 1.5px solid #e2e8f0;
      border-radius: 12px;
      padding: 9px 14px;
    }

    .f-f-icon {
      font-size: 22px;
      line-height: 1;
      width: 42px;
      height: 42px;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .f-f-info strong {
      display: block;
      font-size: 14.5px;
      color: #0f172a;
      font-weight: 800;
      line-height: 1.2;
      margin-bottom: 1px;
    }

    .f-f-info p {
      font-size: 12.5px;
      color: #64748b;
      line-height: 1.28;
    }

    .f-f-info p strong {
      display: inline;
      color: #047857;
      font-weight: 800;
    }

    /* PROMO BANNER */
    .f-promo-banner {
      background: linear-gradient(135deg, #064e3b 0%, #047857 50%, #059669 100%);
      color: #ffffff;
      padding: 12px 18px;
      border-radius: 14px;
      text-align: center;
      box-shadow: 0 4px 14px rgba(5, 150, 105, 0.22);
      margin: 4px 0 8px 0;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .f-promo-tag {
      font-size: 10.5px;
      font-weight: 900;
      letter-spacing: 1.2px;
      color: #a7f3d0;
      text-transform: uppercase;
      margin-bottom: 2px;
    }

    .f-promo-main {
      font-size: 23px;
      font-weight: 900;
      letter-spacing: -0.3px;
      color: #ffffff;
      line-height: 1.15;
    }

    .f-promo-sub {
      font-size: 12px;
      color: #d1fae5;
      font-weight: 600;
      margin-top: 3px;
    }

    /* PLANES SIN PRECIOS */
    .f-plans-box {
      margin-top: 2px;
    }

    .f-plans-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      font-weight: 800;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 5px;
    }

    .f-plans-note {
      color: #059669;
      font-weight: 800;
      text-transform: none;
    }

    .f-plans-grid {
      display: grid;
      grid-template-columns: 1fr 1.18fr 1fr;
      gap: 8px;
    }

    .f-plan-pill {
      border: 1.5px solid #cbd5e1;
      border-radius: 10px;
      padding: 8px 8px;
      background: #ffffff;
      text-align: center;
      display: flex;
      flex-direction: column;
      justify-content: center;
      position: relative;
    }

    .f-plan-pill-pop {
      border: 2px solid #2563eb;
      background: #eff6ff;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.14);
    }

    .f-plan-pop-badge {
      position: absolute;
      top: -9px;
      left: 50%;
      transform: translateX(-50%);
      background: #2563eb;
      color: #ffffff;
      font-size: 8.5px;
      font-weight: 900;
      padding: 2px 8px;
      border-radius: 9999px;
      white-space: nowrap;
      letter-spacing: 0.5px;
    }

    .f-plan-name {
      font-size: 13px;
      font-weight: 900;
      color: #0f172a;
      display: block;
      margin-bottom: 2px;
    }

    .f-plan-desc {
      font-size: 10px;
      color: #64748b;
      line-height: 1.25;
      display: block;
    }

    /* COLUMNA DERECHA: CTA CON QR GIGANTE */
    .f-right-col {
      display: flex;
      align-items: stretch;
    }

    .f-cta-card {
      border: 2.5px solid #0f172a;
      background: #f8fafc;
      border-radius: 18px;
      padding: 24px 22px 20px 22px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-around;
      text-align: center;
      width: 100%;
      box-shadow: 0 6px 20px rgba(15, 23, 42, 0.09);
      position: relative;
    }

    .f-cta-block-top {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3px;
    }

    .f-cta-badge {
      background: #0f172a;
      color: #38bdf8;
      font-size: 11px;
      font-weight: 900;
      padding: 4px 14px;
      border-radius: 9999px;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }

    .f-cta-title {
      font-size: 21px;
      font-weight: 900;
      color: #0f172a;
      line-height: 1.2;
      margin-bottom: 2px;
    }

    .f-cta-desc {
      font-size: 13.5px;
      color: #475569;
      line-height: 1.3;
    }

    .f-cta-block-mid {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 100%;
      margin: 4px 0;
    }

    .f-qr-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-bottom: 6px;
    }

    .f-qr-image {
      width: 235px;
      height: 235px;
      border-radius: 14px;
      border: 2px solid #cbd5e1;
      display: block;
      background: #ffffff;
      padding: 6px;
      box-shadow: 0 6px 16px rgba(0,0,0,0.1);
    }

    .f-qr-label {
      font-size: 11px;
      font-weight: 900;
      color: #ffffff;
      background: #0f172a;
      padding: 5px 14px;
      border-radius: 6px;
      margin-top: 6px;
      letter-spacing: 0.5px;
      white-space: nowrap;
    }

    .f-steps-mini {
      display: flex;
      justify-content: space-around;
      width: 100%;
      font-size: 10px;
      font-weight: 800;
      color: #334155;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 6px 8px;
      margin-top: 4px;
    }

    .f-cta-block-bot {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 100%;
      gap: 6px;
    }

    .f-url-box {
      width: 100%;
    }

    .f-url-label {
      font-size: 11px;
      color: #64748b;
      display: block;
      margin-bottom: 3px;
      font-weight: 600;
    }

    .f-url-btn {
      display: block;
      background: #2563eb;
      color: #ffffff;
      font-size: 18px;
      font-weight: 900;
      padding: 8px 18px;
      border-radius: 10px;
      letter-spacing: 0.3px;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.28);
    }

    .f-support-line {
      font-size: 11.5px;
      color: #64748b;
      line-height: 1.3;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }

    .f-support-line strong {
      color: #0f172a;
    }

    /* FOOTER */
    .f-footer {
      font-size: 11.5px;
      color: #94a3b8;
      text-align: center;
      font-weight: 700;
      padding-top: 8px;
      border-top: 1px solid #f1f5f9;
      line-height: 1.3;
    }
  `;

  // 4. Documento HTML para la Hoja Carta Completa (Vertical: 8.5in x 11in)
  // con 2 volantes horizontales apilados (arriba y abajo) y corte horizontal
  const getSheetHtml = (withFloatingBar = false) => `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Volantes Horizontales Media Carta - Reservas CR (2 por Hoja Carta)</title>
  <style>
    ${sharedStyles}

    @page {
      size: 8.5in 11in;
      margin: 0;
    }

    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #ffffff;
    }

    .sheet-wrapper-vertical {
      width: 100vw;
      height: 100vh;
      display: flex;
      flex-direction: column;
      position: relative;
      background: #ffffff;
    }

    .flyer-horizontal-half {
      width: 100vw;
      height: calc(50% - 10px);
    }

    /* CANAL Y LÍNEA DE CORTE HORIZONTAL AL CENTRO */
    .cut-gutter-horizontal {
      height: 20px;
      width: 100vw;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: relative;
      background: #fafafa;
      padding: 0 30px;
    }

    .cut-line-dash-h {
      position: absolute;
      left: 0;
      right: 0;
      top: 50%;
      height: 0;
      border-top: 2px dashed #94a3b8;
      transform: translateY(-1px);
    }

    .cut-label-h {
      position: relative;
      z-index: 5;
      background: #ffffff;
      border: 1px solid #94a3b8;
      color: #475569;
      font-size: 9px;
      font-weight: 800;
      padding: 2px 10px;
      border-radius: 4px;
      white-space: nowrap;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    /* BARRA FLOTANTE DE IMPRESIÓN */
    .print-floating-bar {
      position: fixed;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      background: #0f172a;
      color: #ffffff;
      padding: 10px 22px;
      border-radius: 50px;
      display: flex;
      align-items: center;
      gap: 16px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.3);
      z-index: 9999;
      border: 1px solid rgba(255,255,255,0.15);
      font-size: 13px;
      font-weight: 600;
    }

    .btn-act {
      background: #2563eb;
      color: #ffffff;
      border: none;
      padding: 8px 16px;
      border-radius: 9999px;
      font-weight: 800;
      font-size: 12px;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: background 0.2s;
    }

    .btn-act:hover {
      background: #1d4ed8;
    }

    .btn-emerald {
      background: #059669;
    }

    .btn-emerald:hover {
      background: #047857;
    }

    @media print {
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  ${withFloatingBar ? `
  <!-- BARRA FLOTANTE NO IMPRIMIBLE -->
  <div class="print-floating-bar no-print">
    <span>🖨️ <strong>Hoja Carta Lista:</strong> 2 volantes horizontales con guía de corte</span>
    <button onclick="window.print()" class="btn-act btn-emerald">🖨️ Imprimir Ahora</button>
    <a href="/Volante_Comercios_ReservasCR.pdf" class="btn-act" target="_blank">⬇️ Descargar PDF</a>
    <a href="/volante-img" class="btn-act" target="_blank">🖼️ Ver Imagen Individual</a>
  </div>
  ` : ''}

  <div class="sheet-wrapper-vertical">
    <!-- VOLANTE SUPERIOR (HORIZONTAL) -->
    <div class="flyer-card-horizontal flyer-horizontal-half">
      ${flyerInnerContent}
    </div>

    <!-- CANAL DE CORTE HORIZONTAL CENTRAL -->
    <div class="cut-gutter-horizontal">
      <div class="cut-line-dash-h"></div>
      <div class="cut-label-h">✂ CORTE</div>
      <div class="cut-label-h">✂ GUÍA DE CORTE (MEDIA CARTA HORIZONTAL) ✂</div>
      <div class="cut-label-h">✂ CORTE</div>
    </div>

    <!-- VOLANTE INFERIOR (HORIZONTAL) -->
    <div class="flyer-card-horizontal flyer-horizontal-half">
      ${flyerInnerContent}
    </div>
  </div>
</body>
</html>
  `;

  // 5. Documento HTML para un solo volante individual (Horizontal: 8.5in ancho x 5.5in alto)
  const singleFlyerHtml = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Volante Media Carta Horizontal - Reservas CR</title>
  <style>
    ${sharedStyles}

    @page {
      size: 8.5in 5.5in;
      margin: 0;
    }

    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #ffffff;
    }

    .single-flyer-wrap-h {
      width: 100vw;
      height: 100vh;
    }
  </style>
</head>
<body>
  <div class="flyer-card-horizontal single-flyer-wrap-h">
    ${flyerInnerContent}
  </div>
</body>
</html>
  `;

  // Guardar archivos HTML en public/
  const sheet2UpPath = path.join(rootDir, 'public', 'volante_comercios_2x_carta.html');
  const sheet2UpCleanPath = path.join(rootDir, 'public', 'volante_comercios_2x_clean.html');
  const singleFlyerPath = path.join(rootDir, 'public', 'volante_comercios.html');

  fs.writeFileSync(sheet2UpPath, getSheetHtml(true), 'utf8');
  fs.writeFileSync(sheet2UpCleanPath, getSheetHtml(false), 'utf8');
  fs.writeFileSync(singleFlyerPath, singleFlyerHtml, 'utf8');

  console.log('✅ Archivos HTML guardados en public/:');
  console.log('   - public/volante_comercios_2x_carta.html (Hoja carta vertical con 2 volantes horizontales apilados)');
  console.log('   - public/volante_comercios.html (Volante individual horizontal media carta)');

  // 6. Renderizar imágenes con Microsoft Edge headless
  const msedgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  if (fs.existsSync(msedgePath)) {
    console.log('🖼️ Renderizando imágenes ultra-nítidas y PDF con Microsoft Edge...');

    // A) Hoja completa Carta Vertical (2 volantes horizontales apilados): 1700 x 2200 px (Relación 8.5 : 11)
    const outSheetPng = path.join(rootDir, 'public', 'hoja_completa_2_volantes.png');
    const cmdSheet = `"${msedgePath}" --headless --disable-gpu --screenshot="${outSheetPng}" --window-size=1700,2200 --hide-scrollbars "file:///${sheet2UpCleanPath.replace(/\\\\/g, '/')}"`;
    try {
      execSync(cmdSheet);
      console.log('✅ Imagen hoja completa generada (1700x2200):', outSheetPng);
    } catch (e) {
      console.warn('⚠️ Error al generar imagen de hoja completa:', e.message);
    }

    // B) Volante individual Media Carta Horizontal: 1700 x 1100 px (Relación 8.5 : 5.5)
    const outSinglePng = path.join(rootDir, 'public', 'volante_media_carta.png');
    const cmdSingle = `"${msedgePath}" --headless --disable-gpu --screenshot="${outSinglePng}" --window-size=1700,1100 --hide-scrollbars "file:///${singleFlyerPath.replace(/\\\\/g, '/')}"`;
    try {
      execSync(cmdSingle);
      console.log('✅ Imagen volante individual generada (1700x1100):', outSinglePng);
    } catch (e) {
      console.warn('⚠️ Error al generar imagen individual:', e.message);
    }

    // C) Documento PDF listo para imprimir en tamaño Carta (Portrait)
    const outPdf = path.join(rootDir, 'public', 'Volante_Comercios_ReservasCR.pdf');
    const cmdPdf = `"${msedgePath}" --headless --disable-gpu --print-to-pdf="${outPdf}" --no-margins "file:///${sheet2UpCleanPath.replace(/\\\\/g, '/')}"`;
    try {
      execSync(cmdPdf);
      console.log('✅ PDF de impresión generado:', outPdf);
    } catch (e) {
      console.warn('⚠️ Error al generar PDF:', e.message);
    }

    // Limpiar archivo temporal clean
    try {
      if (fs.existsSync(sheet2UpCleanPath)) fs.unlinkSync(sheet2UpCleanPath);
    } catch (_) {}
  }

  console.log('🎉 ¡Volantes horizontales media carta listos!');
}

main().catch(err => {
  console.error('❌ Error en el generador de volantes:', err);
  process.exit(1);
});
