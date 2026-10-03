import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import QRCode from 'qrcode';
import { execFileSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

async function main() {
  console.log('🚀 Generando volantes horizontales media carta optimizados para Reservas CR...');

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
    width: 600,
    color: {
      dark: '#0f172a',
      light: '#ffffff'
    }
  });

  // Bandera de Costa Rica en SVG nítido
  const crFlagSvg = `
    <svg width="20" height="12" viewBox="0 0 5 3" style="border-radius: 2px; display: inline-block; vertical-align: middle; box-shadow: 0 1px 2px rgba(0,0,0,0.2);">
      <rect width="5" height="3" fill="#002B7F"/>
      <rect width="5" height="2" y="0.5" fill="#FFFFFF"/>
      <rect width="5" height="1" y="1" fill="#CE1126"/>
    </svg>
  `;

  // 3. Contenido interno de CADA volante HORIZONTAL (Diseñado exactamente para 816px ancho x 518px alto)
  const flyerInnerContent = `
    <!-- HEADER SUPERIOR -->
    <div class="f-header">
      <div class="f-brand">
        <img src="${logoBase64 || '/reservas_cr_clean_badge_1.png'}" alt="Reservas CR Logo" class="f-brand-logo" />
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
              <p>Tus clientes entran, ven tus servicios, precios y horarios para reservar en 30 segundos sin esperas.</p>
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

      <!-- COLUMNA DERECHA: CONVERSIÓN Y QR ESCANEABLE -->
      <div class="f-right-col">
        <div class="f-cta-card">
          <!-- BLOQUE SUPERIOR CTA -->
          <div class="f-cta-block-top">
            <div class="f-cta-badge">⚡ REGISTRO RÁPIDO DE COMERCIOS</div>
            <h2 class="f-cta-title">¡Activa tu agenda en 2 minutos!</h2>
            <p class="f-cta-desc">Apunta con la cámara de tu celular al código QR:</p>
          </div>
          
          <!-- BLOQUE CENTRAL CON QR -->
          <div class="f-cta-block-mid">
            <div class="f-qr-container">
              <img src="${qrDataUrl}" alt="Escanear QR Reservas CR" class="f-qr-image" />
              <div class="f-qr-label">📱 ESCANÉAME CON TU CÁMARA</div>
            </div>
            <div class="f-steps-mini">
              <span>1️⃣ Escanea el QR</span>
              <span>2️⃣ Registra negocio</span>
              <span>3️⃣ ¡Citas 24/7!</span>
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

  // Estilos CSS exactos calculados para 816px ancho x 518px alto por volante
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
      background-color: #f1f5f9;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }

    /* CONTENEDOR DEL VOLANTE HORIZONTAL (EXACTO 816px x 518px / 8.5in x 5.4in) */
    .flyer-card-horizontal {
      background: #ffffff;
      width: 816px;
      height: 518px;
      padding: 14px 22px 10px 22px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-sizing: border-box;
      position: relative;
    }

    /* HEADER */
    .f-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1.5px solid #e2e8f0;
      padding-bottom: 8px;
    }

    .f-brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .f-brand-logo {
      width: 44px;
      height: 44px;
      object-fit: cover;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(0,0,0,0.18);
      border: 1px solid rgba(0,0,0,0.1);
    }

    .f-brand-title {
      font-size: 20px;
      font-weight: 900;
      letter-spacing: -0.4px;
      color: #0f172a;
      line-height: 1.1;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .f-brand-sub {
      font-size: 9.5px;
      color: #64748b;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 2px;
    }

    .f-pill-badge {
      background: #0f172a;
      color: #38bdf8;
      font-size: 10.5px;
      font-weight: 800;
      padding: 4px 12px;
      border-radius: 9999px;
      letter-spacing: 0.4px;
      white-space: nowrap;
    }

    /* GRID CUERPO PRINCIPAL */
    .f-body-grid {
      display: grid;
      grid-template-columns: 62% 38%;
      gap: 16px;
      align-items: stretch;
      margin: 6px 0;
      flex: 1;
    }

    .f-left-col {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    /* GANCHO */
    .f-hook-box {
      margin-bottom: 2px;
    }

    .f-hook-eyebrow {
      font-size: 9px;
      font-weight: 900;
      color: #0284c7;
      letter-spacing: 0.8px;
      margin-bottom: 2px;
    }

    .f-hook-title {
      font-size: 17.5px;
      font-weight: 900;
      line-height: 1.15;
      color: #0f172a;
      margin-bottom: 3px;
      letter-spacing: -0.3px;
    }

    .f-hook-desc {
      font-size: 11px;
      color: #334155;
      line-height: 1.25;
    }

    .f-hook-desc strong {
      color: #0284c7;
      font-weight: 800;
    }

    /* BENEFICIOS */
    .f-features-grid {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin: 4px 0;
    }

    .f-feature-card {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 4px 9px;
    }

    .f-f-icon {
      font-size: 16px;
      line-height: 1;
      width: 28px;
      height: 28px;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .f-f-info strong {
      display: block;
      font-size: 11px;
      color: #0f172a;
      font-weight: 800;
      line-height: 1.15;
      margin-bottom: 1px;
    }

    .f-f-info p {
      font-size: 9.5px;
      color: #64748b;
      line-height: 1.2;
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
      padding: 6px 12px;
      border-radius: 9px;
      text-align: center;
      box-shadow: 0 2px 8px rgba(5, 150, 105, 0.2);
      margin: 2px 0 4px 0;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .f-promo-tag {
      font-size: 8px;
      font-weight: 900;
      letter-spacing: 1px;
      color: #a7f3d0;
      text-transform: uppercase;
      margin-bottom: 1px;
    }

    .f-promo-main {
      font-size: 15px;
      font-weight: 900;
      letter-spacing: -0.2px;
      color: #ffffff;
      line-height: 1.15;
    }

    .f-promo-sub {
      font-size: 8.5px;
      color: #d1fae5;
      font-weight: 600;
      margin-top: 1px;
    }

    /* PLANES SIN PRECIOS */
    .f-plans-box {
      margin-top: 1px;
    }

    .f-plans-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 8.5px;
      font-weight: 800;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      margin-bottom: 3px;
    }

    .f-plans-note {
      color: #059669;
      font-weight: 800;
      text-transform: none;
    }

    .f-plans-grid {
      display: grid;
      grid-template-columns: 1fr 1.15fr 1fr;
      gap: 6px;
    }

    .f-plan-pill {
      border: 1px solid #cbd5e1;
      border-radius: 7px;
      padding: 5px 6px;
      background: #ffffff;
      text-align: center;
      display: flex;
      flex-direction: column;
      justify-content: center;
      position: relative;
    }

    .f-plan-pill-pop {
      border: 1.5px solid #2563eb;
      background: #eff6ff;
      box-shadow: 0 2px 8px rgba(37, 99, 235, 0.12);
    }

    .f-plan-pop-badge {
      position: absolute;
      top: -7px;
      left: 50%;
      transform: translateX(-50%);
      background: #2563eb;
      color: #ffffff;
      font-size: 7px;
      font-weight: 900;
      padding: 1px 6px;
      border-radius: 9999px;
      white-space: nowrap;
      letter-spacing: 0.4px;
    }

    .f-plan-name {
      font-size: 10px;
      font-weight: 900;
      color: #0f172a;
      display: block;
      margin-bottom: 1px;
    }

    .f-plan-desc {
      font-size: 8px;
      color: #64748b;
      line-height: 1.2;
      display: block;
    }

    /* COLUMNA DERECHA: CTA CON QR */
    .f-right-col {
      display: flex;
      align-items: stretch;
    }

    .f-cta-card {
      border: 2px solid #0f172a;
      background: #f8fafc;
      border-radius: 12px;
      padding: 10px 10px 8px 10px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      text-align: center;
      width: 100%;
      box-shadow: 0 4px 14px rgba(15, 23, 42, 0.08);
      position: relative;
      box-sizing: border-box;
    }

    .f-cta-block-top {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      width: 100%;
    }

    .f-cta-badge {
      background: #0f172a;
      color: #38bdf8;
      font-size: 8.5px;
      font-weight: 900;
      padding: 2px 10px;
      border-radius: 9999px;
      letter-spacing: 0.4px;
      margin-bottom: 1px;
    }

    .f-cta-title {
      font-size: 14.5px;
      font-weight: 900;
      color: #0f172a;
      line-height: 1.15;
    }

    .f-cta-desc {
      font-size: 9.5px;
      color: #475569;
      line-height: 1.2;
    }

    .f-cta-block-mid {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 100%;
      margin: 2px 0;
    }

    .f-qr-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-bottom: 3px;
    }

    .f-qr-image {
      width: 156px;
      height: 156px;
      border-radius: 10px;
      border: 1.5px solid #cbd5e1;
      display: block;
      background: #ffffff;
      padding: 4px;
      box-shadow: 0 3px 10px rgba(0,0,0,0.1);
    }

    .f-qr-label {
      font-size: 8.5px;
      font-weight: 900;
      color: #ffffff;
      background: #0f172a;
      padding: 3px 10px;
      border-radius: 5px;
      margin-top: 4px;
      letter-spacing: 0.4px;
      white-space: nowrap;
    }

    .f-steps-mini {
      display: flex;
      justify-content: space-around;
      width: 100%;
      font-size: 7.5px;
      font-weight: 800;
      color: #334155;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 4px 6px;
      margin-top: 3px;
    }

    .f-cta-block-bot {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 100%;
      gap: 3px;
    }

    .f-url-box {
      width: 100%;
    }

    .f-url-label {
      font-size: 8.5px;
      color: #64748b;
      display: block;
      margin-bottom: 2px;
      font-weight: 600;
    }

    .f-url-btn {
      display: block;
      background: #2563eb;
      color: #ffffff;
      font-size: 13.5px;
      font-weight: 900;
      padding: 6px 12px;
      border-radius: 8px;
      letter-spacing: 0.3px;
      box-shadow: 0 3px 8px rgba(37, 99, 235, 0.25);
    }

    .f-support-line {
      font-size: 8.5px;
      color: #64748b;
      line-height: 1.2;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      margin-top: 2px;
    }

    .f-support-line strong {
      color: #0f172a;
    }

    /* FOOTER */
    .f-footer {
      font-size: 9px;
      color: #94a3b8;
      text-align: center;
      font-weight: 700;
      padding-top: 5px;
      border-top: 1px solid #f1f5f9;
      line-height: 1.2;
    }
  `;

  // 4. Documento HTML para la Hoja Carta Completa (Vertical: 8.5in x 11in / 816px x 1056px)
  // con 2 volantes horizontales apilados (arriba y abajo) y corte horizontal
  const getSheetHtml = (withFloatingBar = false) => `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Volantes Horizontales Media Carta - Reservas CR (2 por Hoja Carta)</title>
  <style>
    ${sharedStyles}

    @page {
      size: 8.5in 11in;
      margin: 0;
    }

    body {
      background-color: #e2e8f0;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 20px 0 60px 0;
    }

    .sheet-paper {
      width: 816px;
      height: 1056px;
      background: #ffffff;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.18);
      display: flex;
      flex-direction: column;
      position: relative;
      box-sizing: border-box;
      overflow: hidden;
      margin: 0 auto;
    }

    .flyer-horizontal-half {
      width: 816px;
      height: 518px;
    }

    /* CANAL Y LÍNEA DE CORTE HORIZONTAL AL CENTRO (EXACTOS 20px) */
    .cut-gutter-horizontal {
      height: 20px;
      width: 816px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: relative;
      background: #fafafa;
      padding: 0 30px;
      box-sizing: border-box;
    }

    .cut-line-dash-h {
      position: absolute;
      left: 0;
      right: 0;
      top: 50%;
      height: 0;
      border-top: 1.5px dashed #94a3b8;
      transform: translateY(-1px);
    }

    .cut-label-h {
      position: relative;
      z-index: 5;
      background: #ffffff;
      border: 1px solid #94a3b8;
      color: #475569;
      font-size: 8.5px;
      font-weight: 800;
      padding: 1px 8px;
      border-radius: 4px;
      white-space: nowrap;
      box-shadow: 0 1px 2px rgba(0,0,0,0.1);
    }

    /* BARRA FLOTANTE DE ACCIONES WEB */
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
      gap: 14px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.35);
      z-index: 9999;
      border: 1px solid rgba(255,255,255,0.15);
      font-size: 13px;
      font-weight: 600;
    }

    .btn-act {
      background: #2563eb;
      color: #ffffff;
      border: none;
      padding: 7px 15px;
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

    @media screen and (max-width: 860px) {
      body {
        padding: 10px 0;
      }
      .sheet-paper {
        zoom: calc(100vw / 860);
      }
    }

    @media print {
      body {
        background: #ffffff !important;
        padding: 0 !important;
        margin: 0 !important;
      }
      .sheet-paper {
        margin: 0 !important;
        box-shadow: none !important;
        width: 8.5in !important;
        height: 11in !important;
        page-break-after: avoid;
        page-break-inside: avoid;
      }
      .flyer-horizontal-half {
        width: 8.5in !important;
        height: 5.4in !important;
      }
      .cut-gutter-horizontal {
        width: 8.5in !important;
        height: 0.2in !important;
      }
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
    <span>🖨️ <strong>Hoja Carta Lista:</strong> 2 volantes con QR escaneable y guía de corte</span>
    <button onclick="window.print()" class="btn-act btn-emerald">🖨️ Imprimir Ahora</button>
    <a href="/Volante_Comercios_ReservasCR.pdf" class="btn-act" target="_blank">⬇️ Descargar PDF</a>
    <a href="/volante-img" class="btn-act" target="_blank">🖼️ Ver Imagen Individual</a>
  </div>
  ` : ''}

  <div class="sheet-paper">
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

  // 5. Documento HTML para un solo volante individual (Horizontal: 8.5in ancho x 5.5in alto / 816px x 528px)
  const singleFlyerHtml = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Volante Media Carta Horizontal - Reservas CR</title>
  <style>
    ${sharedStyles}

    @page {
      size: 8.5in 5.5in;
      margin: 0;
    }

    body {
      background-color: #e2e8f0;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 20px 0;
    }

    .single-paper {
      width: 816px;
      height: 528px;
      background: #ffffff;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.18);
      position: relative;
      box-sizing: border-box;
      overflow: hidden;
      margin: 0 auto;
    }

    @media screen and (max-width: 860px) {
      body {
        padding: 10px 0;
      }
      .single-paper {
        zoom: calc(100vw / 860);
      }
    }

    @media print {
      body {
        background: #ffffff !important;
        padding: 0 !important;
        margin: 0 !important;
      }
      .single-paper {
        margin: 0 !important;
        box-shadow: none !important;
        width: 8.5in !important;
        height: 5.5in !important;
      }
    }
  </style>
</head>
<body>
  <div class="single-paper">
    <div class="flyer-card-horizontal" style="height: 528px;">
      ${flyerInnerContent}
    </div>
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
  console.log('   - public/volante_comercios_2x_carta.html');
  console.log('   - public/volante_comercios.html');

  // 6. Renderizar imágenes de alta definición y PDF con Microsoft Edge headless
  const msedgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  if (fs.existsSync(msedgePath)) {
    console.log('🖼️ Renderizando imágenes ultra-nítidas y PDF con Microsoft Edge...');

    // A) Hoja completa Carta Vertical (2 volantes horizontales apilados):
    // 816 x 1056 con scale factor 2 = 1632 x 2112 px nítido
    const outSheetPng = path.join(rootDir, 'public', 'hoja_completa_2_volantes.png');
    const sheetCleanUrl = `file:///${sheet2UpCleanPath.replace(/\\/g, '/')}`;
    try {
      execFileSync(msedgePath, [
        '--headless',
        '--disable-gpu',
        '--force-device-scale-factor=2',
        `--screenshot=${outSheetPng}`,
        '--window-size=816,1056',
        '--hide-scrollbars',
        sheetCleanUrl
      ]);
      console.log('✅ Imagen hoja completa generada (1632x2112):', outSheetPng);
    } catch (e) {
      console.warn('⚠️ Error al generar imagen de hoja completa:', e.message);
    }

    // B) Volante individual Media Carta Horizontal:
    // 816 x 528 con scale factor 2 = 1632 x 1056 px nítido
    const outSinglePng = path.join(rootDir, 'public', 'volante_media_carta.png');
    const singleUrl = `file:///${singleFlyerPath.replace(/\\/g, '/')}`;
    try {
      execFileSync(msedgePath, [
        '--headless',
        '--disable-gpu',
        '--force-device-scale-factor=2',
        `--screenshot=${outSinglePng}`,
        '--window-size=816,528',
        '--hide-scrollbars',
        singleUrl
      ]);
      console.log('✅ Imagen volante individual generada (1632x1056):', outSinglePng);
    } catch (e) {
      console.warn('⚠️ Error al generar imagen individual:', e.message);
    }

    // C) Documento PDF vectorial listo para imprimir en tamaño Carta (Portrait)
    const outPdf = path.join(rootDir, 'public', 'Volante_Comercios_ReservasCR.pdf');
    try {
      execFileSync(msedgePath, [
        '--headless',
        '--disable-gpu',
        `--print-to-pdf=${outPdf}`,
        '--no-margins',
        sheetCleanUrl
      ]);
      console.log('✅ PDF de impresión generado:', outPdf);
    } catch (e) {
      console.warn('⚠️ Error al generar PDF:', e.message);
    }

    // Limpiar archivo temporal clean
    try {
      if (fs.existsSync(sheet2UpCleanPath)) fs.unlinkSync(sheet2UpCleanPath);
    } catch (_) {}
  }

  console.log('🎉 ¡Volantes horizontales media carta optimizados con éxito!');
}

main().catch(err => {
  console.error('❌ Error en el generador de volantes:', err);
  process.exit(1);
});
