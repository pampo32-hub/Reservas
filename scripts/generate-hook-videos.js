import { execFileSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const TARGET_DIR = path.resolve('video publicidad');
const PUBLIC_DIR = path.resolve('public/video publicidad');

const videos = [
  {
    id: 1,
    filename: 'video_1_agenda_247_hook',
    badge: '🚨 ¡ERROR NÚMERO 1 EN TU NEGOCIO!',
    badgeColor: '#ef4444',
    title: '¿Aún agendas citas a mano <span class="hl-yellow">a las 11 PM?</span>',
    subtitle: 'Tardas en contestar y tu cliente se va con la competencia.',
    htmlContent: `
      <div class="time-header">
        <span class="moon">🌙</span>
        <span class="clock">11:43 PM</span>
        <span class="status">• Domingo por la noche</span>
      </div>
      <div class="chat-container">
        <div class="chat-bubble left">
          <div class="sender">Cliente 1</div>
          <div class="msg">Hola buenas, ¿tienen espacio mañana a las 10 am? 🙏</div>
          <div class="msg-time">11:38 PM</div>
        </div>
        <div class="chat-bubble left">
          <div class="sender">Cliente 2</div>
          <div class="msg">Buenas noches, ¿a qué hora atienden el sábado?</div>
          <div class="msg-time">11:41 PM</div>
        </div>
        <div class="chat-bubble left">
          <div class="sender">Cliente 3</div>
          <div class="msg">¿Cuánto cobran por corte y barba? Me urge para mañana temprano!!</div>
          <div class="msg-time">11:43 PM</div>
        </div>
      </div>
      <div class="alert-pill">
        ⚠️ 5 MENSAJES SIN RESPONDER MIENTRAS DUERMES
      </div>
    `,
    footer: '⚡ AGENDA INTELIGENTE 24/7 EN RESERVASCR.APP 🇨🇷'
  },
  {
    id: 2,
    filename: 'video_2_sinpe_movil_hook',
    badge: '🛑 EL MAYOR DOLOR DE CABEZA',
    badgeColor: '#dc2626',
    title: '¿Clientes que apartan cita y <span class="hl-red">NUNCA llegan?</span>',
    subtitle: 'El "no-show" le cuesta miles de colones a tu negocio cada semana.',
    htmlContent: `
      <div class="warning-box">
        <div class="cross-icon">❌</div>
        <div class="warning-title">CITA CANCELADA A ÚLTIMA HORA</div>
        <div class="warning-sub">Cliente no llegó ni contestó el teléfono</div>
      </div>
      <div class="loss-card">
        <div class="loss-row">
          <span>Servicio agendado:</span>
          <strong>Tatuaje / Estética Completa</strong>
        </div>
        <div class="loss-row">
          <span>Horario bloqueado:</span>
          <strong>2:00 PM - 4:00 PM (2 horas vacías)</strong>
        </div>
        <div class="loss-row highlight-loss">
          <span>Pérdida estimada:</span>
          <span class="loss-val">₡25.000 botados hoy</span>
        </div>
      </div>
      <div class="alert-pill green-pill">
        🛡️ SOLUCIÓN: COBRA ADELANTO AUTOMÁTICO POR SINPE MÓVIL
      </div>
    `,
    footer: '🔒 VALIDA COMPROBANTES SINPE AL INSTANTE CON RESERVASCR'
  },
  {
    id: 3,
    filename: 'video_3_vitrina_digital_hook',
    badge: '🛍️ ¡NUEVA FUNCIÓN EN COSTA RICA!',
    badgeColor: '#f59e0b',
    title: '¡No solo vendas citas,<br><span class="hl-gold">VENDE TUS PRODUCTOS!</span>',
    subtitle: 'Tus cremas, ceras y shampoos no tienen por qué estar empolvados.',
    htmlContent: `
      <div class="shelf-grid">
        <div class="prod-card">
          <div class="prod-icon">🧴</div>
          <div class="prod-info">
            <div class="prod-name">Pomada Mate Fijación Fuerte</div>
            <div class="prod-price">₡6.500</div>
          </div>
          <div class="wa-btn">💬 Pedir por WhatsApp</div>
        </div>
        <div class="prod-card">
          <div class="prod-icon">✨</div>
          <div class="prod-info">
            <div class="prod-name">Aceite Hidratante Profesional</div>
            <div class="prod-price">₡8.000</div>
          </div>
          <div class="wa-btn">💬 Pedir por WhatsApp</div>
        </div>
      </div>
      <div class="alert-pill gold-pill">
        💰 SUBE TU STOCK EN 2 MINUTOS Y VENDE SIN COMISIONES
      </div>
    `,
    footer: '🚀 ACTIVA TU VITRINA DIGITAL HOY EN RESERVASCR.APP'
  },
  {
    id: 4,
    filename: 'video_4_fidelizacion_qr_hook',
    badge: '🗑️ ADIÓS A LO ANTIGUO',
    badgeColor: '#8b5cf6',
    title: '¡Bota las tarjetas de cartón <span class="hl-purple">A LA BASURA!</span>',
    subtitle: 'A tus clientes se les pierden, se les mojan o las botan.',
    htmlContent: `
      <div class="comparison-grid">
        <div class="comp-box old">
          <div class="comp-tag bad">❌ ANTES: OBSOLETO</div>
          <div class="crumpled-card">
            <div style="font-size: 20px; font-weight: bold; text-decoration: line-through;">Tarjeta de Sellos</div>
            <div class="stamps-row">
              <span class="stamp-circle bad">✂️</span>
              <span class="stamp-circle bad">✂️</span>
              <span class="stamp-circle empty">?</span>
              <span class="stamp-circle empty">?</span>
            </div>
            <div style="font-size: 14px; color: #ef4444; margin-top: 10px; font-weight: bold;">Manchada y rota en el bolsillo</div>
          </div>
        </div>
        <div class="comp-box new">
          <div class="comp-tag good">✨ AHORA: DIGITAL QR</div>
          <div class="qr-preview-box">
            <div style="font-size: 44px; margin-bottom: 6px;">📱</div>
            <div style="font-size: 18px; font-weight: 800; color: #10b981;">Sellos en el Celular</div>
            <div style="font-size: 13px; color: #94a3b8;">Escaneo instantáneo con QR</div>
          </div>
        </div>
      </div>
      <div class="alert-pill purple-pill">
        🎯 RETIENE A TUS CLIENTES COMO LAS GRANDES FRANQUICIAS
      </div>
    `,
    footer: '📲 TARJETAS DE FIDELIZACIÓN DIGITALES EN RESERVASCR'
  },
  {
    id: 5,
    filename: 'video_5_recordatorios_whatsapp_hook',
    badge: '⏱️ AHORRA 2 HORAS AL DÍA',
    badgeColor: '#10b981',
    title: '¿Cuánto tiempo pierdes <span class="hl-green">recordando citas a mano?</span>',
    subtitle: 'Escribir uno por uno "¿Hola, vas a venir hoy?" es cosa del pasado.',
    htmlContent: `
      <div class="reminder-mockup">
        <div class="reminder-header">
          <span style="font-size: 24px;">💬</span>
          <strong>WhatsApp Business Oficial</strong>
        </div>
        <div class="notif-card">
          <div class="notif-badge">🔔 RECORDATORIO AUTOMÁTICO</div>
          <div class="notif-title">Tu cita es hoy a las 3:00 PM</div>
          <div class="notif-details">
            📍 Barbería / Salón Estudio CR<br>
            ✂️ Servicio: Corte y Barba Premium<br>
            👤 Especialista: Carlos Monge
          </div>
          <div class="notif-btn">✅ Cita Confirmada por el Cliente</div>
        </div>
      </div>
      <div class="alert-pill green-pill">
        🤖 REDUCE EL 80% DE AUSENCIAS SIN MOVER UN DEDO
      </div>
    `,
    footer: '✨ RECORDATORIOS AUTOMÁTICOS POR WHATSAPP Y CORREO'
  },
  {
    id: 6,
    filename: 'video_6_pos_caja_hook',
    badge: '📊 CONTROL TOTAL DE TU DINERO',
    badgeColor: '#f97316',
    title: '¿Tu cierre de caja sigue siendo <span class="hl-orange">un cuaderno de papel?</span>',
    subtitle: 'Llegar a la noche intentando cuadrar qué entró en efectivo y SINPE...',
    htmlContent: `
      <div class="notebook-alert">
        <div class="notebook-sheet">
          <div class="notebook-title">Caja del Día (Cuaderno) 🤦‍♂️</div>
          <div class="note-line">Corte - ₡6.000 (¿era SINPE?)</div>
          <div class="note-line crossed">Tinte - ₡25.000 (tachado)</div>
          <div class="note-line">Barba - ₡4.000 efectivo</div>
          <div class="note-line error-line">⚠️ TOTAL NO CUADRA (-₡8.000)</div>
        </div>
      </div>
      <div class="pos-badge-preview">
        <div class="pos-icon">🖥️</div>
        <div>
          <div style="font-weight: 800; font-size: 20px; color: #f97316;">Punto de Venta POS Integrado</div>
          <div style="font-size: 14px; color: #94a3b8;">Efectivo, Tarjetas y SINPE en tiempo real</div>
        </div>
      </div>
      <div class="alert-pill orange-pill">
        💼 CIERRA CAJA EN 10 SEGUNDOS Y SIN ERRORES
      </div>
    `,
    footer: '📈 TODO EL CONTROL DE TU NEGOCIO EN RESERVASCR.APP'
  }
];

function buildHtml(v) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&family=Space+Grotesk:wght@700;800;900&display=swap');

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      width: 1080px;
      height: 1920px;
      background: radial-gradient(circle at 50% 25%, #1e293b 0%, #0a0f1d 75%, #050811 100%);
      color: #ffffff;
      font-family: 'Inter', -apple-system, sans-serif;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      padding: 100px 70px 90px 70px;
      overflow: hidden;
      position: relative;
    }

    /* Background glow circle */
    .glow-circle {
      position: absolute;
      top: 15%;
      left: 50%;
      transform: translateX(-50%);
      width: 800px;
      height: 800px;
      background: radial-gradient(circle, rgba(16, 185, 129, 0.12) 0%, rgba(0,0,0,0) 70%);
      filter: blur(60px);
      z-index: 0;
      pointer-events: none;
    }

    .top-section {
      width: 100%;
      text-align: center;
      z-index: 2;
    }

    .badge-pill {
      display: inline-block;
      background: ${v.badgeColor};
      color: #ffffff;
      font-family: 'Space Grotesk', sans-serif;
      font-size: 26px;
      font-weight: 800;
      padding: 14px 38px;
      border-radius: 9999px;
      text-transform: uppercase;
      letter-spacing: 2px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
      margin-bottom: 40px;
    }

    h1 {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 64px;
      font-weight: 900;
      line-height: 1.15;
      letter-spacing: -1px;
      color: #ffffff;
      margin-bottom: 22px;
      text-shadow: 0 4px 20px rgba(0,0,0,0.5);
    }

    .subtitle {
      font-size: 30px;
      color: #94a3b8;
      font-weight: 500;
      max-width: 880px;
      margin: 0 auto;
      line-height: 1.35;
    }

    /* Colors */
    .hl-yellow { color: #facc15; text-shadow: 0 0 25px rgba(250, 204, 21, 0.4); }
    .hl-red { color: #f87171; text-shadow: 0 0 25px rgba(248, 113, 113, 0.4); }
    .hl-gold { color: #fbbf24; text-shadow: 0 0 25px rgba(251, 191, 36, 0.4); }
    .hl-purple { color: #c084fc; text-shadow: 0 0 25px rgba(192, 132, 252, 0.4); }
    .hl-green { color: #34d399; text-shadow: 0 0 25px rgba(52, 211, 153, 0.4); }
    .hl-orange { color: #fb923c; text-shadow: 0 0 25px rgba(251, 146, 60, 0.4); }

    /* Middle Visual Card */
    .middle-section {
      width: 100%;
      max-width: 940px;
      z-index: 2;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    /* Common Card / Pill styles */
    .alert-pill {
      margin-top: 36px;
      background: rgba(239, 68, 68, 0.2);
      border: 2px solid #ef4444;
      color: #fca5a5;
      font-size: 26px;
      font-weight: 800;
      padding: 16px 32px;
      border-radius: 9999px;
      text-align: center;
      width: 100%;
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
    }
    .green-pill { background: rgba(16, 185, 129, 0.2); border-color: #10b981; color: #6ee7b7; }
    .gold-pill { background: rgba(245, 158, 11, 0.2); border-color: #f59e0b; color: #fde68a; }
    .purple-pill { background: rgba(139, 92, 246, 0.2); border-color: #8b5cf6; color: #ddd6fe; }
    .orange-pill { background: rgba(249, 115, 22, 0.2); border-color: #f97316; color: #fdba74; }

    /* Video 1 Specifics: WhatsApp Chat */
    .time-header {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid #334155;
      padding: 10px 24px;
      border-radius: 9999px;
      font-size: 24px;
      color: #cbd5e1;
      margin-bottom: 24px;
    }
    .clock { font-weight: 800; color: #facc15; font-family: monospace; font-size: 28px; }
    .chat-container {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }
    .chat-bubble {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 20px 20px 20px 4px;
      padding: 20px 24px;
      max-width: 820px;
      box-shadow: 0 10px 20px rgba(0,0,0,0.3);
      position: relative;
    }
    .sender { font-size: 20px; color: #22c55e; font-weight: 700; margin-bottom: 6px; }
    .msg { font-size: 28px; color: #f1f5f9; line-height: 1.3; font-weight: 500; }
    .msg-time { font-size: 18px; color: #64748b; text-align: right; margin-top: 6px; }

    /* Video 2 Specifics: No show */
    .warning-box {
      background: rgba(220, 38, 38, 0.25);
      border: 2px dashed #ef4444;
      border-radius: 24px;
      padding: 30px;
      text-align: center;
      width: 100%;
      margin-bottom: 24px;
    }
    .cross-icon { font-size: 60px; line-height: 1; margin-bottom: 10px; }
    .warning-title { font-size: 34px; font-weight: 900; color: #fca5a5; }
    .warning-sub { font-size: 22px; color: #cbd5e1; margin-top: 6px; }
    .loss-card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 20px;
      padding: 24px 30px;
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 16px;
      font-size: 24px;
    }
    .loss-row { display: flex; justify-content: space-between; color: #94a3b8; }
    .loss-row strong { color: #ffffff; }
    .highlight-loss { border-top: 1px solid #334155; padding-top: 14px; font-size: 28px; }
    .loss-val { color: #ef4444; font-weight: 900; }

    /* Video 3 Specifics: Shelf */
    .shelf-grid {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .prod-card {
      background: #1e293b;
      border: 2px solid #334155;
      border-radius: 24px;
      padding: 22px 28px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.3);
    }
    .prod-icon { font-size: 60px; background: rgba(255,255,255,0.05); padding: 12px; border-radius: 16px; }
    .prod-info { flex: 1; }
    .prod-name { font-size: 28px; font-weight: 800; color: #ffffff; }
    .prod-price { font-size: 32px; font-weight: 900; color: #f59e0b; margin-top: 4px; }
    .wa-btn {
      background: #22c55e;
      color: #ffffff;
      font-size: 22px;
      font-weight: 800;
      padding: 16px 24px;
      border-radius: 16px;
      white-space: nowrap;
      box-shadow: 0 6px 15px rgba(34, 197, 94, 0.4);
    }

    /* Video 4 Specifics: Loyalty Card */
    .comparison-grid {
      width: 100%;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
    }
    .comp-box {
      border-radius: 24px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
    .comp-box.old { background: #1e293b; border: 2px dashed #64748b; }
    .comp-box.new { background: rgba(16, 185, 129, 0.15); border: 2px solid #10b981; }
    .comp-tag { font-size: 18px; font-weight: 800; padding: 6px 16px; border-radius: 9999px; margin-bottom: 16px; }
    .comp-tag.bad { background: #ef4444; color: white; }
    .comp-tag.good { background: #10b981; color: white; }
    .crumpled-card {
      background: #fde68a;
      color: #78350f;
      padding: 20px;
      border-radius: 12px;
      transform: rotate(-3deg);
      box-shadow: 0 8px 16px rgba(0,0,0,0.3);
      width: 100%;
    }
    .stamps-row { display: flex; justify-content: center; gap: 8px; margin-top: 10px; }
    .stamp-circle {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
    }
    .stamp-circle.bad { background: rgba(0,0,0,0.1); border: 2px dashed #b45309; }
    .stamp-circle.empty { background: white; border: 2px dashed #d97706; color: #d97706; }
    .qr-preview-box {
      padding: 20px;
      background: rgba(0,0,0,0.3);
      border-radius: 16px;
      width: 100%;
    }

    /* Video 5 Specifics: Reminders */
    .reminder-mockup {
      width: 100%;
      background: #1e293b;
      border: 2px solid #334155;
      border-radius: 28px;
      padding: 30px;
    }
    .reminder-header {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 24px;
      color: #22c55e;
      border-bottom: 1px solid #334155;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .notif-card {
      background: rgba(15, 23, 42, 0.7);
      border-radius: 18px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .notif-badge { font-size: 18px; font-weight: 800; color: #38bdf8; }
    .notif-title { font-size: 28px; font-weight: 900; color: #ffffff; }
    .notif-details { font-size: 22px; color: #cbd5e1; line-height: 1.4; }
    .notif-btn {
      background: #22c55e;
      color: white;
      font-size: 20px;
      font-weight: 800;
      padding: 12px 20px;
      border-radius: 12px;
      text-align: center;
      margin-top: 8px;
    }

    /* Video 6 Specifics: POS notebook */
    .notebook-alert { width: 100%; margin-bottom: 20px; }
    .notebook-sheet {
      background: #fffbeb;
      color: #1e293b;
      border-radius: 18px;
      padding: 24px 30px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.3);
      font-family: monospace;
      transform: rotate(-1deg);
    }
    .notebook-title { font-size: 26px; font-weight: 900; color: #92400e; margin-bottom: 12px; border-bottom: 2px solid #fde68a; padding-bottom: 6px; }
    .note-line { font-size: 24px; padding: 6px 0; border-bottom: 1px dashed #fcd34d; }
    .note-line.crossed { text-decoration: line-through; color: #94a3b8; }
    .error-line { color: #dc2626; font-weight: 900; background: #fee2e2; padding: 8px; border-radius: 6px; }
    .pos-badge-preview {
      width: 100%;
      background: #1e293b;
      border: 2px solid #f97316;
      border-radius: 20px;
      padding: 20px 26px;
      display: flex;
      align-items: center;
      gap: 20px;
    }
    .pos-icon { font-size: 54px; }

    /* Footer */
    .footer-section {
      width: 100%;
      text-align: center;
      z-index: 2;
      border-top: 2px solid rgba(255, 255, 255, 0.12);
      padding-top: 30px;
    }

    .footer-text {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 26px;
      font-weight: 800;
      letter-spacing: 1px;
      color: #34d399;
    }
  </style>
</head>
<body>
  <div class="glow-circle"></div>

  <div class="top-section">
    <div class="badge-pill">${v.badge}</div>
    <h1>${v.title}</h1>
    <div class="subtitle">${v.subtitle}</div>
  </div>

  <div class="middle-section">
    ${v.htmlContent}
  </div>

  <div class="footer-section">
    <div class="footer-text">${v.footer}</div>
  </div>
</body>
</html>`;
}

async function run() {
  console.log('🚀 Iniciando generación de los 6 clips de video (4 segundos cada uno)...');

  for (const v of videos) {
    console.log(`\n🎬 [${v.id}/6] Procesando: ${v.filename}...`);

    const htmlPath = path.resolve(`temp_${v.filename}.html`);
    const pngPath = path.join(TARGET_DIR, `${v.filename}.png`);
    const mp4Path = path.join(TARGET_DIR, `${v.filename}.mp4`);
    const publicPngPath = path.join(PUBLIC_DIR, `${v.filename}.png`);
    const publicMp4Path = path.join(PUBLIC_DIR, `${v.filename}.mp4`);

    // 1. Guardar HTML
    fs.writeFileSync(htmlPath, buildHtml(v));

    // 2. Tomar captura vertical en alta resolución (1080x1920)
    console.log('   📸 Tomando captura en 1080x1920...');
    execFileSync(EDGE_PATH, [
      '--headless',
      '--disable-gpu',
      '--no-sandbox',
      '--window-size=1080,1920',
      '--screenshot=' + pngPath,
      'file:///' + htmlPath.replace(/\\/g, '/')
    ]);

    // 3. Renderizar video MP4 de 4 segundos con movimiento dinámico
    console.log('   🎞️ Renderizando video MP4 con efecto zoompan (4s @ 30fps)...');
    execFileSync('ffmpeg', [
      '-y',
      '-loop', '1',
      '-i', pngPath,
      '-vf', "scale=1080:1920,zoompan=z='min(zoom+0.0012,1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=120:s=1080x1920:fps=30",
      '-t', '4',
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-preset', 'fast',
      mp4Path
    ]);

    // 4. Copiar a la carpeta pública
    fs.copyFileSync(pngPath, publicPngPath);
    fs.copyFileSync(mp4Path, publicMp4Path);

    // 5. Eliminar temporal HTML
    if (fs.existsSync(htmlPath)) fs.unlinkSync(htmlPath);

    const sizeMb = (fs.statSync(mp4Path).size / (1024 * 1024)).toFixed(2);
    console.log(`   ✅ Clip generado con éxito: ${v.filename}.mp4 (${sizeMb} MB)`);
  }

  console.log('\n🎉 ¡Los 6 videos de 4 segundos fueron generados exitosamente!');
  console.log(`📁 Carpeta local: ${TARGET_DIR}`);
  console.log(`🌐 Carpeta pública: ${PUBLIC_DIR}`);
}

run().catch(err => {
  console.error('Error generando videos:', err);
  process.exit(1);
});
