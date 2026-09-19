/**
 * Parser de Notificaciones Bancarias de SINPE Móvil (Costa Rica) y Correos de Prueba
 * Extrae montos en colones, teléfonos emisores, comprobantes y banco de origen.
 */

export function parseSinpeEmail(subject = '', bodyText = '', bodyHtml = '', from = '') {
  const fullText = `${subject}\n${bodyText}\n${stripHtml(bodyHtml)}`.trim();
  const cleanFrom = String(from || '').toLowerCase();
  const lowerText = fullText.toLowerCase();

  // Descartar inmediatamente remitentes conocidos que no son transferencias ni bancos
  const ignoredSenders = ['uber', 'netflix', 'spotify', 'google', 'render', 'microsoft', 'resend', 'facebook', 'instagram', 'apple', 'amazon', 'adobe', 'steam'];
  if (ignoredSenders.some(ign => cleanFrom.includes(ign))) {
    return {
      isSinpe: false,
      amountCrc: 0,
      senderPhone: '',
      senderName: '',
      referenceNumber: '',
      originBank: 'Ignorado',
      detail: '',
      rawSummary: subject || ''
    };
  }

  // 1. Detección de Banco
  let detectedBank = 'SINPE Móvil CR';
  if (cleanFrom.includes('bac') || lowerText.includes('bac credomatic') || lowerText.includes('bac san jose')) {
    detectedBank = 'BAC Credomatic';
  } else if (cleanFrom.includes('bncr') || lowerText.includes('banco nacional') || lowerText.includes('bn móvil') || lowerText.includes('bn movil')) {
    detectedBank = 'Banco Nacional (BNCR)';
  } else if (cleanFrom.includes('bancobcr') || cleanFrom.includes('bcr') || lowerText.includes('banco de costa rica')) {
    detectedBank = 'Banco de Costa Rica (BCR)';
  } else if (cleanFrom.includes('promerica') || lowerText.includes('promerica')) {
    detectedBank = 'Banco Promerica';
  } else if (cleanFrom.includes('scotiabank') || lowerText.includes('scotiabank')) {
    detectedBank = 'Scotiabank';
  } else if (cleanFrom.includes('davivienda') || lowerText.includes('davivienda')) {
    detectedBank = 'Davivienda';
  } else if (cleanFrom.includes('wink') || cleanFrom.includes('coopenae') || lowerText.includes('wink')) {
    detectedBank = 'Wink (Coopenae)';
  } else if (cleanFrom.includes('hotmail') || cleanFrom.includes('gmail') || cleanFrom.includes('yahoo') || cleanFrom.includes('outlook')) {
    detectedBank = 'Prueba / Personal';
  }

  // 2. Extraer Monto en Colones (₡)
  let amountCrc = null;
  const amountPatterns = [
    // "monto: 5", "monto transferido: ₡5,000.00", "monto: 5 colones", "monto: 5 crc"
    /(?:monto|importe|valor|cantidad|transferido|acreditado|recibido)\s*(?:transferido|acreditado|recibido)?\s*[:#=\-]?\s*₡?\s*([0-9]+(?:[,.][0-9]+)*)\s*(?:colones|crc|¢)?/i,
    // "₡ 5,000.00" or "₡5"
    /₡\s*([0-9]+(?:[,.][0-9]+)*)/i,
    // "5000 CRC" or "5 colones"
    /([0-9]+(?:[,.][0-9]+)*)\s*(?:colones|crc|¢)/i,
    // "CRC 5,000" or "colones: 5000"
    /(?:crc|colones)\s*[:#=\-]?\s*([0-9]+(?:[,.][0-9]+)*)/i
  ];

  for (const regex of amountPatterns) {
    const match = fullText.match(regex);
    if (match && match[1]) {
      let numStr = match[1].trim();
      if (numStr.includes('.') && numStr.includes(',')) {
        if (numStr.indexOf('.') < numStr.indexOf(',')) {
          // 5.000,00
          numStr = numStr.replace(/\./g, '').replace(',', '.');
        } else {
          // 5,000.00
          numStr = numStr.replace(/,/g, '');
        }
      } else if (numStr.includes(',')) {
        const parts = numStr.split(',');
        if (parts[1] && parts[1].length === 2) {
          numStr = parts[0] + '.' + parts[1];
        } else {
          numStr = numStr.replace(/,/g, '');
        }
      }
      const parsedNum = parseFloat(numStr);
      if (!isNaN(parsedNum) && parsedNum > 0) {
        amountCrc = parsedNum;
        break;
      }
    }
  }

  // 3. Extraer Teléfono Emisor (8 dígitos)
  let senderPhone = null;
  const phonePatterns = [
    /(?:tel[eé]fono|origen|celular|m[oó]vil|remitente|emisor)\s*[:#=\-]?\s*(?:\+?506\s*[-.]?)?([245678]\d{3}[-\s.]?\d{4})/i,
    /(?:\+?506\s*[-.]?)?([245678]\d{3}[-\s.]?\d{4})/i
  ];

  for (const regex of phonePatterns) {
    const match = fullText.match(regex);
    if (match && match[1]) {
      const digits = match[1].replace(/\D/g, '');
      if (digits.length === 8) {
        senderPhone = `${digits.slice(0, 4)}-${digits.slice(4)}`;
        break;
      }
    }
  }

  // 4. Extraer Número de Comprobante / Referencia
  let referenceNumber = null;
  const ignoreWords = new Set([
    'de', 'la', 'el', 'en', 'un', 'una', 'por', 'con', 'para',
    'transferencia', 'transferencias', 'pago', 'pagos', 'deposito', 'depósito',
    'sinpe', 'movil', 'móvil', 'banco', 'bac', 'bncr', 'bcr', 'promerica',
    'colones', 'colon', 'crc', 'monto', 'saldo', 'cuenta', 'tarjeta',
    'destinatario', 'remitente', 'cliente', 'fecha', 'hora', 'detalle', 'motivo',
    'notificacion', 'notificación', 'comprobante', 'referencia'
  ]);

  const refPatterns = [
    /(?:n[uú]mero\s*(?:de\s*)?|n[o°º]\.?\s*(?:de\s*)?|c[oó]digo\s*(?:de\s*)?)?(?:comprobante|referencia|transacci[oó]n|autorizaci[oó]n|operaci[oó]n|documento|folio|confirmaci[oó]n|trf|ref|pase|doc|aut)(?:\s+de\s+(?:transferencia|pago|operaci[oó]n|dep[oó]sito|transacci[oó]n))?\s*[:#=\.\-]?\s*([A-Za-z0-9\-_]{3,35})/i,
    /#\s*([A-Za-z0-9\-_]{3,24})/,
    /(?:SINPE|TRF|DOC|REF|AUT)[-_]?([0-9]{3,20})/i
  ];

  for (const regex of refPatterns) {
    const match = fullText.match(regex);
    if (match && match[1]) {
      const candidate = match[1].trim().replace(/^[#:\.\-=\s]+/, '');
      if (candidate.length >= 3 && !ignoreWords.has(candidate.toLowerCase())) {
        referenceNumber = candidate;
        break;
      }
    }
  }

  // Fallback: si no se extrajo con prefijo, buscar si hay números de 3 a 16 dígitos en el texto
  if (!referenceNumber) {
    const standaloneMatch = fullText.match(/\b([0-9]{3,16})\b/g);
    if (standaloneMatch) {
      for (const candidate of standaloneMatch) {
        if (
          candidate !== '2026' && 
          candidate !== '2025' && 
          candidate !== '506' &&
          candidate !== String(amountCrc) &&
          (!senderPhone || !senderPhone.replace(/\D/g, '').includes(candidate))
        ) {
          referenceNumber = candidate;
          break;
        }
      }
    }
  }

  // 5. Extraer Nombre del Emisor
  let senderName = null;
  const namePatterns = [
    /(?:de\s+parte\s+de|enviado\s+por|titular|nombre\s+del\s+cliente|ordenante|remitente)\s*[:#=\-]?\s*([A-Za-zÁÉÍÓÚáéíóúñÑ\s]{3,40})/i
  ];

  for (const regex of namePatterns) {
    const match = fullText.match(regex);
    if (match && match[1]) {
      const candidateName = match[1].trim().replace(/\s+/g, ' ');
      if (!ignoreWords.has(candidateName.toLowerCase())) {
        senderName = candidateName;
        break;
      }
    }
  }

  // 6. Extraer Detalle o Motivo
  let detail = '';
  const detailMatch = fullText.match(/(?:motivo|detalle|pase|concepto|descripci[oó]n|asunto)\s*[:#=\-]?\s*([^\n\r<]{2,80})/i);
  if (detailMatch && detailMatch[1]) {
    detail = detailMatch[1].trim();
  }

  // Es SINPE válido si tiene un monto positivo y un número de comprobante/referencia
  const isSinpe = Boolean(amountCrc && amountCrc > 0 && referenceNumber);

  return {
    isSinpe,
    amountCrc: amountCrc || 0,
    senderPhone: senderPhone || '',
    senderName: senderName || 'Cliente SINPE',
    referenceNumber: referenceNumber || '',
    originBank: detectedBank,
    detail,
    rawSummary: subject || fullText.slice(0, 120)
  };
}

function stripHtml(html = '') {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
