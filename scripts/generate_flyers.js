import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import QRCode from 'qrcode';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

async function main() {
  console.log('🚀 Generando volantes publicitarios media carta de alto impacto...');

  // 1. Generar Código QR de alta resolución hacia la página de registro
  const qrUrl = 'https://reservascr.app/unete';
  const qrDataUrl = await QRCode.toDataURL(qrUrl, {
    errorCorrectionLevel: 'H',
    margin: 1,
    width: 650,
    color: {
      dark: '#0f172a',
      light: '#ffffff'
    }
  });

  // Bandera oficial de Costa Rica en SVG puro de alta nitidez
  const crFlagSvg = `
    <svg width="26" height="16" viewBox="0 0 5 3" style="border-radius: 3px; display: inline-block; vertical-align: middle; box-shadow: 0 1px 3px rgba(0,0,0,0.25);">
      <rect width="5" height="3" fill="#002B7F"/>
      <rect width="5" height="2" y="0.5" fill="#FFFFFF"/>
      <rect width="5" height="1" y="1" fill="#CE1126"/>
    </svg>
  `;

  // 2. Contenido interno de cada volante (diseñado para 1100px x 1700px a escala)
  const flyerInnerContent = `
    <!-- HEADER -->
    <div class="f-header">
      <div class="f-brand">
        <div class="f-logo-box">
          <svg width="54" height="54" viewBox="0 0 512 512" fill="none">
            <rect width="512" height="512" rx="120" fill="url(#brandGrad)"/>
            <defs>
              <linearGradient id="brandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#2563eb"/>
                <stop offset="100%" stop-color="#059669"/>
              </linearGradient>
              <linearGradient id="checkG" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#34d399"/>
                <stop offset="100%" stop-color="#10b981"/>
              </linearGradient>
            </defs>
            <path d="M256 75C160 75 82 153 82 249C82 342 232 433 247 442C252.5 445.5 259.5 445.5 265 442C280 433 430 342 430 249C430 153 352 75 256 75Z" fill="white" fill-opacity="0.22" stroke="white" stroke-width="26" stroke-linecap="round"/>
            <circle cx="256" cy="240" r="105" fill="white" fill-opacity="0.1" stroke="white" stroke-width="16" stroke-dasharray="16 16"/>
            <path d="M185 240L245 300L380 155" stroke="url(#checkG)" stroke-width="42" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div>
          <div class="f-brand-title">RESERVAS CR ${crFlagSvg}</div>
          <div class="f-brand-sub">Directorio Digital & Plataforma de Citas Oficial</div>
        </div>
      </div>
      <div class="f-pill-badge">PARA COMERCIOS 🇨🇷</div>
    </div>

    <!-- TITULAR GANCHO -->
    <div class="f-hook-section">
      <div class="f-hook-eyebrow">⚡ AUTOMATIZA TU NEGOCIO EN COSTA RICA</div>
      <h1 class="f-hook-title">
        ¿Cansado de perder citas y contestar WhatsApp a deshoras?
      </h1>
      <p class="f-hook-desc">
        Pon tu agenda en piloto automático. Permite que tus clientes vean tus servicios, precios y horarios en tiempo real para <strong>agendar solos 24/7</strong>.
      </p>
    </div>

    <!-- 3 BENEFICIOS PRINCIPALES -->
    <div class="f-features-grid">
      <div class="f-feature-item">
        <div class="f-f-icon-wrap">🔗</div>
        <div class="f-f-content">
          <strong>Tu Propio Link en la Bio (Instagram, TikTok & WhatsApp)</strong>
          <p>Tus clientes entran, eligen servicio, horario y especialista en 30 segundos sin esperar respuesta.</p>
        </div>
      </div>

      <div class="f-feature-item">
        <div class="f-f-icon-wrap">📲</div>
        <div class="f-f-content">
          <strong>Recordatorios y Confirmación por WhatsApp</strong>
          <p>Reduce hasta un 80% las citas olvidadas y los clientes ausentes con notificaciones automáticas.</p>
        </div>
      </div>

      <div class="f-feature-item">
        <div class="f-f-icon-wrap">💼</div>
        <div class="f-f-content">
          <strong>Caja POS, Comisiones & Sellos QR de Fidelización</strong>
          <p>Cobro rápido con SINPE Móvil, cálculo automático de comisiones y tarjetas de sellos digitales.</p>
        </div>
      </div>
    </div>

    <!-- MEGA BANNER DE OFERTA -->
    <div class="f-promo-banner">
      <div class="f-promo-tag">🎉 BENEFICIO DE ESTRENO EXCLUSIVO</div>
      <div class="f-promo-main">¡15 DÍAS GRATIS DEL PLAN PRO!</div>
      <div class="f-promo-sub">Sin contratos forzosos · 0% de comisiones por reserva · Sin tarjeta requerida</div>
    </div>

    <!-- RESUMEN DE PLANES EN COLONES -->
    <div class="f-plans-container">
      <div class="f-plans-header">
        <span>PLANES TRANSPARENTES (EN COLONES):</span>
        <span class="f-plans-sub">✓ Sin costos ocultos · Cancela cuando quieras</span>
      </div>
      <div class="f-plans-grid">
        <div class="f-plan-col">
          <div class="f-p-name">Plan Básico</div>
          <div class="f-p-price">₡5.200 <small>/mes</small></div>
          <div class="f-p-detail">1 Especialista · 150 citas/mes<br>Recordatorios WhatsApp</div>
        </div>
        <div class="f-plan-col f-plan-highlight">
          <div class="f-p-pop">MÁS POPULAR</div>
          <div class="f-p-name">Plan Profesional</div>
          <div class="f-p-price">₡9.400 <small>/mes</small></div>
          <div class="f-p-detail">Hasta 5 Colab. · 300 citas/mes<br>Caja POS & Comisiones</div>
        </div>
        <div class="f-plan-col">
          <div class="f-p-name">Plan Premium</div>
          <div class="f-p-price">₡18.200 <small>/mes</small></div>
          <div class="f-p-detail">Equipo Ilimitado · 600 citas<br>Destacado en Directorio</div>
        </div>
      </div>
    </div>

    <!-- BLOQUE DE LLAMADO A LA ACCIÓN CON CÓDIGO QR -->
    <div class="f-cta-box">
      <div class="f-qr-wrap">
        <img src="${qrDataUrl}" alt="Escanear QR Reservas CR" class="f-qr-img" />
        <div class="f-qr-scan-badge">📱 ESCANEA CON TU CÁMARA</div>
      </div>
      <div class="f-cta-text">
        <div class="f-cta-h1">¡Activa tu agenda en 2 minutos!</div>
        <div class="f-cta-p">Apunta con la cámara de tu celular al código QR o entra directo desde tu navegador a:</div>
        <div class="f-cta-url">reservascr.app/unete</div>
        <div class="f-cta-contact">
          ${crFlagSvg} Soporte oficial en Costa Rica: <strong>soporte@reservascr.app</strong>
        </div>
      </div>
    </div>

    <!-- FOOTER -->
    <div class="f-footer">
      Ideal para Barberías, Salones de Belleza, Estéticas, Spas, Uñas, Tatuajes, Fisioterapia, Clínicas, Psicología y Talleres.
    </div>
  `;

  // Estilos CSS proporcionados y de alto contraste
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

    .flyer-card {
      background: #ffffff;
      padding: 34px 34px 22px 34px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
      position: relative;
      height: 100vh;
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
      gap: 14px;
    }

    .f-logo-box {
      width: 54px;
      height: 54px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .f-brand-title {
      font-size: 26px;
      font-weight: 900;
      letter-spacing: -0.5px;
      color: #0f172a;
      line-height: 1.1;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .f-brand-sub {
      font-size: 11px;
      color: #64748b;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      margin-top: 2px;
    }

    .f-pill-badge {
      background: #0f172a;
      color: #38bdf8;
      font-size: 11.5px;
      font-weight: 800;
      padding: 6px 14px;
      border-radius: 9999px;
      letter-spacing: 0.5px;
      white-space: nowrap;
    }

    /* GANCHO */
    .f-hook-section {
      margin-top: 6px;
    }

    .f-hook-eyebrow {
      font-size: 11.5px;
      font-weight: 900;
      color: #0284c7;
      letter-spacing: 1px;
      margin-bottom: 4px;
    }

    .f-hook-title {
      font-size: 28px;
      font-weight: 900;
      line-height: 1.2;
      color: #0f172a;
      margin-bottom: 8px;
      letter-spacing: -0.4px;
    }

    .f-hook-desc {
      font-size: 15px;
      color: #334155;
      line-height: 1.38;
    }

    .f-hook-desc strong {
      color: #0284c7;
      font-weight: 800;
    }

    /* BENEFICIOS */
    .f-features-grid {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin: 8px 0;
    }

    .f-feature-item {
      display: flex;
      align-items: center;
      gap: 14px;
      background: #f8fafc;
      border: 1.5px solid #e2e8f0;
      border-radius: 12px;
      padding: 10px 14px;
    }

    .f-f-icon-wrap {
      font-size: 24px;
      line-height: 1;
      width: 44px;
      height: 44px;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .f-f-content strong {
      display: block;
      font-size: 15px;
      color: #0f172a;
      font-weight: 800;
      line-height: 1.2;
      margin-bottom: 2px;
    }

    .f-f-content p {
      font-size: 12.5px;
      color: #64748b;
      line-height: 1.3;
    }

    /* PROMO BANNER */
    .f-promo-banner {
      background: linear-gradient(135deg, #064e3b 0%, #047857 50%, #059669 100%);
      color: #ffffff;
      padding: 14px 20px;
      border-radius: 14px;
      text-align: center;
      box-shadow: 0 6px 16px rgba(5, 150, 105, 0.22);
      margin: 4px 0 10px 0;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .f-promo-tag {
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 1.2px;
      color: #a7f3d0;
      text-transform: uppercase;
      margin-bottom: 3px;
    }

    .f-promo-main {
      font-size: 26px;
      font-weight: 900;
      letter-spacing: -0.4px;
      color: #ffffff;
      line-height: 1.15;
    }

    .f-promo-sub {
      font-size: 12px;
      color: #d1fae5;
      font-weight: 600;
      margin-top: 4px;
    }

    /* PLANES */
    .f-plans-container {
      margin-bottom: 8px;
    }

    .f-plans-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11.5px;
      font-weight: 800;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }

    .f-plans-sub {
      color: #059669;
      font-weight: 800;
      text-transform: none;
    }

    .f-plans-grid {
      display: grid;
      grid-template-columns: 1fr 1.08fr 1fr;
      gap: 10px;
    }

    .f-plan-col {
      border: 1.5px solid #cbd5e1;
      border-radius: 12px;
      padding: 10px 8px;
      text-align: center;
      background: #ffffff;
      position: relative;
    }

    .f-plan-highlight {
      border: 2.5px solid #2563eb;
      background: #eff6ff;
      transform: scale(1.02);
      z-index: 1;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.15);
    }

    .f-p-pop {
      position: absolute;
      top: -10px;
      left: 50%;
      transform: translateX(-50%);
      background: #2563eb;
      color: #ffffff;
      font-size: 9.5px;
      font-weight: 900;
      padding: 3px 10px;
      border-radius: 9999px;
      white-space: nowrap;
      letter-spacing: 0.5px;
    }

    .f-p-name {
      font-size: 13.5px;
      font-weight: 800;
      color: #0f172a;
    }

    .f-p-price {
      font-size: 22px;
      font-weight: 900;
      color: #0f172a;
      margin: 2px 0;
      line-height: 1.1;
    }

    .f-p-price small {
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
    }

    .f-p-detail {
      font-size: 10.5px;
      color: #475569;
      line-height: 1.25;
      margin-top: 2px;
    }

    /* CTA CON QR */
    .f-cta-box {
      border: 2.5px solid #0f172a;
      background: #f8fafc;
      border-radius: 14px;
      padding: 14px 18px;
      display: flex;
      align-items: center;
      gap: 20px;
      margin-bottom: 6px;
    }

    .f-qr-wrap {
      flex-shrink: 0;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .f-qr-img {
      width: 136px;
      height: 136px;
      border-radius: 10px;
      border: 1.5px solid #cbd5e1;
      display: block;
      background: #ffffff;
      padding: 4px;
    }

    .f-qr-scan-badge {
      font-size: 9.5px;
      font-weight: 900;
      color: #ffffff;
      background: #0f172a;
      padding: 4px 8px;
      border-radius: 6px;
      margin-top: 5px;
      letter-spacing: 0.4px;
      white-space: nowrap;
    }

    .f-cta-text {
      flex: 1;
    }

    .f-cta-h1 {
      font-size: 19px;
      font-weight: 900;
      color: #0f172a;
      line-height: 1.2;
      margin-bottom: 4px;
    }

    .f-cta-p {
      font-size: 12.5px;
      color: #475569;
      line-height: 1.35;
      margin-bottom: 8px;
    }

    .f-cta-url {
      display: inline-block;
      background: #2563eb;
      color: #ffffff;
      font-size: 17px;
      font-weight: 900;
      padding: 6px 18px;
      border-radius: 8px;
      letter-spacing: 0.3px;
      margin-bottom: 6px;
      box-shadow: 0 4px 10px rgba(37, 99, 235, 0.25);
    }

    .f-cta-contact {
      font-size: 11.5px;
      color: #64748b;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .f-cta-contact strong {
      color: #0f172a;
    }

    /* FOOTER */
    .f-footer {
      font-size: 11px;
      color: #94a3b8;
      text-align: center;
      font-weight: 700;
      padding-top: 4px;
      line-height: 1.3;
    }
  `;

  // 3. Documento HTML para la Hoja Carta Completa (2 volantes lado a lado con canal de corte limpio)
  const getSheetHtml = (withFloatingBar = false) => `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Volantes Media Carta - Reservas CR (2 por Hoja Carta)</title>
  <style>
    ${sharedStyles}

    @page {
      size: 11in 8.5in;
      margin: 0;
    }

    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #ffffff;
    }

    .sheet-wrapper {
      width: 100vw;
      height: 100vh;
      display: flex;
      position: relative;
      background: #ffffff;
    }

    .flyer-half {
      width: calc(50% - 10px);
      height: 100vh;
    }

    /* CANAL Y LÍNEA DE CORTE CENTRAL */
    .cut-gutter {
      width: 20px;
      height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      position: relative;
      background: #fafafa;
    }

    .cut-line-dash {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 50%;
      width: 0;
      border-left: 2px dashed #94a3b8;
      transform: translateX(-1px);
    }

    .cut-label {
      position: relative;
      z-index: 5;
      background: #ffffff;
      border: 1px solid #94a3b8;
      color: #475569;
      font-size: 8.5px;
      font-weight: 800;
      padding: 3px 6px;
      border-radius: 4px;
      white-space: nowrap;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      writing-mode: vertical-rl;
      text-orientation: mixed;
      letter-spacing: 1px;
    }

    .cut-label-top, .cut-label-bottom {
      writing-mode: horizontal-tb;
      font-size: 9px;
      padding: 4px 6px;
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
    <span>🖨️ <strong>Hoja Carta Lista:</strong> 2 volantes con guía de corte</span>
    <button onclick="window.print()" class="btn-act btn-emerald">🖨️ Imprimir Ahora</button>
    <a href="/Volante_Comercios_ReservasCR.pdf" class="btn-act" target="_blank">⬇️ Descargar PDF</a>
    <a href="/volante-img" class="btn-act" target="_blank">🖼️ Ver Imagen</a>
  </div>
  ` : ''}

  <div class="sheet-wrapper">
    <!-- VOLANTE IZQUIERDO -->
    <div class="flyer-card flyer-half">
      ${flyerInnerContent}
    </div>

    <!-- CANAL DE CORTE CENTRAL -->
    <div class="cut-gutter">
      <div class="cut-line-dash"></div>
      <div class="cut-label cut-label-top" style="margin-top: 10px;">✂ CORTE</div>
      <div class="cut-label">✂ GUÍA DE CORTE (MEDIA CARTA)</div>
      <div class="cut-label cut-label-bottom" style="margin-bottom: 10px;">✂ CORTE</div>
    </div>

    <!-- VOLANTE DERECHO -->
    <div class="flyer-card flyer-half">
      ${flyerInnerContent}
    </div>
  </div>
</body>
</html>
  `;

  // 4. Documento HTML para un solo volante individual (Media Carta: 5.5in x 8.5in)
  const singleFlyerHtml = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Volante Media Carta - Reservas CR</title>
  <style>
    ${sharedStyles}

    @page {
      size: 5.5in 8.5in;
      margin: 0;
    }

    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #ffffff;
    }

    .single-flyer-wrap {
      width: 100vw;
      height: 100vh;
    }
  </style>
</head>
<body>
  <div class="flyer-card single-flyer-wrap">
    ${flyerInnerContent}
  </div>
</body>
</html>
  `;

  // Guardar archivos HTML en public
  const sheet2UpPath = path.join(rootDir, 'public', 'volante_comercios_2x_carta.html');
  const sheet2UpCleanPath = path.join(rootDir, 'public', 'volante_comercios_2x_clean.html');
  const singleFlyerPath = path.join(rootDir, 'public', 'volante_comercios.html');

  fs.writeFileSync(sheet2UpPath, getSheetHtml(true), 'utf8');
  fs.writeFileSync(sheet2UpCleanPath, getSheetHtml(false), 'utf8');
  fs.writeFileSync(singleFlyerPath, singleFlyerHtml, 'utf8');

  console.log('✅ Archivos HTML guardados en public/:');
  console.log('   - public/volante_comercios_2x_carta.html (Hoja carta interactiva con 2 volantes y botones)');
  console.log('   - public/volante_comercios.html (Volante individual media carta)');

  // 5. Renderizar imágenes con Microsoft Edge headless
  const msedgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  if (fs.existsSync(msedgePath)) {
    console.log('🖼️ Renderizando imágenes ultra-nítidas y PDF con Microsoft Edge...');

    // A) Hoja completa Carta (2 volantes lado a lado sin barras): 2200 x 1700 px (Relación 11 : 8.5)
    const outSheetPng = path.join(rootDir, 'public', 'hoja_completa_2_volantes.png');
    const cmdSheet = `"${msedgePath}" --headless --disable-gpu --screenshot="${outSheetPng}" --window-size=2200,1700 --hide-scrollbars "file:///${sheet2UpCleanPath.replace(/\\\\/g, '/')}"`;
    try {
      execSync(cmdSheet);
      console.log('✅ Imagen hoja completa generada:', outSheetPng);
    } catch (e) {
      console.warn('⚠️ Error al generar imagen de hoja completa:', e.message);
    }

    // B) Volante individual Media Carta: 1100 x 1700 px (Relación 5.5 : 8.5)
    const outSinglePng = path.join(rootDir, 'public', 'volante_media_carta.png');
    const cmdSingle = `"${msedgePath}" --headless --disable-gpu --screenshot="${outSinglePng}" --window-size=1100,1700 --hide-scrollbars "file:///${singleFlyerPath.replace(/\\\\/g, '/')}"`;
    try {
      execSync(cmdSingle);
      console.log('✅ Imagen volante individual generada:', outSinglePng);
    } catch (e) {
      console.warn('⚠️ Error al generar imagen individual:', e.message);
    }

    // C) Documento PDF listo para imprimir en tamaño Carta (Landscape)
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

  console.log('🎉 ¡Volantes media carta generados y listos para imprimir y compartir!');
}

main().catch(err => {
  console.error('❌ Error en el generador de volantes:', err);
  process.exit(1);
});
