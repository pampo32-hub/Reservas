import { parseSinpeEmail } from './src/services/sinpeParser.js';

const testCases = [
  {
    name: 'Test Email 5555',
    subject: 'Notificación de transferencia',
    bodyText: 'Comprobante de transferencia: 5555\nMonto: 5 colones\nDe: Juan Jival',
    from: 'Juan Jival <pampo32@hotmail.com>',
    expectedRef: '5555',
    expectedAmount: 5
  },
  {
    name: 'BAC Email',
    subject: 'Notificación de transferencia SINPE Móvil',
    bodyText: 'Ha recibido una transferencia por un monto de ₡5,000.00 de Carlos Soto (8888-1234). Comprobante: 987654321. Detalle: Pago reserva.',
    from: 'notificaciones@baccredomatic.cr',
    expectedRef: '987654321',
    expectedAmount: 5000
  },
  {
    name: 'BNCR Email',
    subject: 'BN Móvil - Comprobante de Transferencia SINPE Móvil',
    bodyText: 'Estimado cliente, Comprobante: 202409190123. Monto: ₡ 10.000,00. Teléfono: 87654321.',
    from: 'banco@bncr.fi.cr',
    expectedRef: '202409190123',
    expectedAmount: 10000
  },
  {
    name: 'Short Reference test',
    subject: 'Comprobante 5555',
    bodyText: 'Monto: 5\nComprobante: 5555',
    from: 'pampo32@hotmail.com',
    expectedRef: '5555',
    expectedAmount: 5
  }
];

let allPassed = true;
for (const tc of testCases) {
  const result = parseSinpeEmail(tc.subject, tc.bodyText, '', tc.from);
  const refOk = result.referenceNumber === tc.expectedRef;
  const amtOk = result.amountCrc === tc.expectedAmount;
  const sinpeOk = result.isSinpe === true;
  console.log(`[${tc.name}] => isSinpe: ${result.isSinpe}, Ref: "${result.referenceNumber}" (Expected: "${tc.expectedRef}"), Amount: ${result.amountCrc} (Expected: ${tc.expectedAmount}), Bank: ${result.originBank}`);
  if (!refOk || !amtOk || !sinpeOk) {
    allPassed = false;
    console.error(`FAILED: ${tc.name}`);
  }
}

if (allPassed) {
  console.log('✅ ALL TEST CASES PASSED!');
} else {
  console.error('❌ SOME TEST CASES FAILED');
}
