/**
 * Parser de Notificaciones Bancarias de SINPE Móvil (Costa Rica)
 * Extrae montos en colones, teléfonos emisores, comprobantes y banco de origen.
 */

export function parseSinpeEmail(subject = '', bodyText = '', bodyHtml = '', from = '') {
  const fullText = `${subject}\n${bodyText}\n${stripHtml(bodyHtml)}`.trim();
  const cleanFrom = String(from || '').toLowerCase();

  let detectedBank = 'SINPE Móvil CR';
  if (cleanFrom.includes('bac') || fullText.toLowerCase().includes('bac credomatic') || fullText.toLowerCase().includes('bac san jose')) {
    detectedBank = 'BAC Credomatic';
  } else if (cleanFrom.includes('bncr') || fullText.toLowerCase().includes('banco nacional') || fullText.toLowerCase().includes('bn móvil')) {
    detectedBank = 'Banco Nacional (BNCR)';
  } else if (cleanFrom.includes('bancobcr') || cleanFrom.includes('bcr') || fullText.toLowerCase().includes('banco de costa rica')) {
    detectedBank = 'Banco de Costa Rica (BCR)';
  } else if (cleanFrom.includes('promerica') || fullText.toLowerCase().includes('promerica')) {
    detectedBank = 'Banco Promerica';
  } else if (cleanFrom.includes('scotiabank') || fullText.toLowerCase().includes('scotiabank')) {
    detectedBank = 'Scotiabank';
  } else if (cleanFrom.includes('wink') || cleanFrom.includes('coopenae') || fullText.toLowerCase().includes('wink')) {
    detectedBank = 'Wink (Coopenae)';
  }

  // 1. Extraer Monto en Colones (₡)
  let amountCrc = null;
  const amountPatterns = [
    /monto\s*(?:transferido|acreditado|recibido)?\s*[:#]?\s*₡?\s*([0-9]+(?:[,.][0-9]+)*)\s*(?:colones|crc)?/i,
    /₡\s*([0-9]+(?:[,.][0-9]{2,3})*(?:\.[0-9]{2})?)/i,
    /(?:CRC|colones)\s*([0-9.,]+)/i,
    /([0-9]+(?:[,.][0-9]+)*)\s*(?:colones|CRC)/i
  ];

  for (const regex of amountPatterns) {
    const match = fullText.match(regex);
    if (match && match[1]) {
      const cleanNumStr = match[1].replace(/,/g, '').trim();
      const parsedNum = parseFloat(cleanNumStr);
      if (!isNaN(parsedNum) && parsedNum > 0) {
        amountCrc = parsedNum;
        break;
      }
    }
  }

  // 2. Extraer Teléfono Emisor (8 dígitos en Costa Rica: prefijo 2, 4, 5, 6, 7, 8)
  let senderPhone = null;
  const phonePatterns = [
    /(?:tel[eé]fono|origen|celular|m[oó]vil|de|remitente|emisor)\s*[:#]?\s*(?:\+?506\s*[-.]?)?([245678]\d{3}[-\s.]?\d{4})/i,
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

  // 3. Extraer Número de Comprobante / Referencia
  let referenceNumber = null;
  const refPatterns = [
    /(?:n[uú]mero\s*de\s*comprobante|n[uú]mero\s*de\s*referencia|n[uú]mero\s*de\s*transacci[oó]n|comprobante|referencia|documento|autorizaci[oó]n|transacci[oó]n|folio|ref|trf|pase)\s*[:#\.\-]?\s*([A-Za-z0-9\-_]{3,30})/i,
    /#\s*([A-Za-z0-9\-_]{3,24})/,
    /(?:SINPE|TRF|DOC|REF|AUT)[-_]?([0-9]{4,20})/i
  ];

  for (const regex of refPatterns) {
    const match = fullText.match(regex);
    if (match && match[1]) {
      const candidate = match[1].trim().replace(/^[#:\.\-\s]+/, '');
      if (candidate.length >= 3 && !['colon', 'colones', 'banco', 'sinpe', 'cuenta', 'monto', 'destinatario'].includes(candidate.toLowerCase())) {
        referenceNumber = candidate;
        break;
      }
    }
  }

  // Si no se detectó número de referencia explícito pero hay palabras clave
  if (!referenceNumber) {
    const generalNumMatch = fullText.match(/\b([0-9]{6,14})\b/);
    if (generalNumMatch && generalNumMatch[1]) {
      referenceNumber = generalNumMatch[1];
    } else {
      referenceNumber = `SINPE-${Date.now().toString().slice(-6)}`;
    }
  }

  // 4. Extraer Nombre del Emisor
  let senderName = null;
  const namePatterns = [
    /(?:de parte de|enviado por|titular|nombre del cliente|ordenante)\s*[:#]?\s*([A-Za-zÁÉÍÓÚáéíóúñÑ\s]{3,40})/i
  ];

  for (const regex of namePatterns) {
    const match = fullText.match(regex);
    if (match && match[1]) {
      senderName = match[1].trim().replace(/\s+/g, ' ');
      break;
    }
  }

  // 5. Extraer Detalle o Motivo
  let detail = '';
  const detailMatch = fullText.match(/(?:motivo|detalle|pase|concepto|descripci[oó]n)\s*[:#]?\s*([^\n\r<]{3,80})/i);
  if (detailMatch && detailMatch[1]) {
    detail = detailMatch[1].trim();
  }

  return {
    isSinpe: !!amountCrc || fullText.toLowerCase().includes('sinpe') || fullText.toLowerCase().includes('transferencia'),
    amountCrc: amountCrc || 0,
    senderPhone: senderPhone || '',
    senderName: senderName || 'Cliente SINPE',
    referenceNumber,
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
