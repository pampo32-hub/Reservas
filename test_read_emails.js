import imapSimple from 'imap-simple';
import { simpleParser } from 'mailparser';
import { parseSinpeEmail } from './src/services/sinpeParser.js';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
  const cleanPassword = (process.env.SINPE_EMAIL_PASSWORD || 'nbanoxskrwrgwwvy').replace(/\s+/g, '');
  const config = {
    imap: {
      user: process.env.SINPE_EMAIL_USER || 'pampo32@gmail.com',
      password: cleanPassword,
      host: process.env.SINPE_IMAP_HOST || 'imap.gmail.com',
      port: 993,
      tls: true,
      authTimeout: 10000,
      tlsOptions: { rejectUnauthorized: false }
    }
  };

  console.log('Connecting to IMAP...');
  const conn = await imapSimple.connect(config);
  const box = await conn.openBox('INBOX');
  console.log('Total messages in INBOX:', box.messages.total);

  const startSeq = Math.max(1, box.messages.total - 40);
  const searchCriteria = [`${startSeq}:${box.messages.total}`];
  const messages = await conn.search(searchCriteria, {
    bodies: ['HEADER', 'TEXT', ''],
    markSeen: false
  });

  console.log(`Found ${messages.length} messages.`);

  for (const msg of messages) {
    const headerPart = msg.parts.find(p => p.which === 'HEADER');
    const rawHeader = headerPart ? headerPart.body : {};
    const subject = Array.isArray(rawHeader.subject) ? rawHeader.subject[0] : (rawHeader.subject || '');
    const from = Array.isArray(rawHeader.from) ? rawHeader.from[0] : (rawHeader.from || '');
    const date = Array.isArray(rawHeader.date) ? rawHeader.date[0] : (rawHeader.date || '');

    const allPart = msg.parts.find(p => p.which === '' || p.which === 'TEXT');
    let bodyText = '';
    let bodyHtml = '';
    if (allPart && allPart.body) {
      const parsed = await simpleParser(allPart.body);
      bodyText = parsed.text || '';
      bodyHtml = parsed.html || '';
    }

    if (
      from.toLowerCase().includes('hotmail') || 
      from.toLowerCase().includes('pampo') || 
      subject.toLowerCase().includes('transferencia') || 
      subject.toLowerCase().includes('5555') ||
      bodyText.includes('5555')
    ) {
      const parsedSinpe = parseSinpeEmail(subject, bodyText, bodyHtml, from);
      console.log('\n==============================');
      console.log('Date:', date);
      console.log('From:', from);
      console.log('Subject:', subject);
      console.log('Body:\n', bodyText.trim());
      console.log('------------------------------');
      console.log('Parsed =>', parsedSinpe);
    }
  }

  conn.end();
}

run().catch(console.error);
