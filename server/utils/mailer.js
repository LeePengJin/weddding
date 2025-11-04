let mailerTransport = null;

async function getMailer() {
  if (mailerTransport !== null) return mailerTransport;
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true';
  if (host && port && user && pass) {
    const nodemailer = require('nodemailer');
    mailerTransport = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
  } else {
    mailerTransport = undefined; // dev stub
  }
  return mailerTransport;
}

async function sendEmail(to, subject, text) {
  const transport = await getMailer();
  if (!transport) {
    console.log(`[EMAIL:DEV] to=${to} subject=${subject} body=${text}`);
    return;
  }
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  try {
    await transport.sendMail({ from, to, subject, text });
  } catch (e) {
    console.error('SMTP sendMail failed, falling back to console log:', e);
    console.log(`[EMAIL:DEV] to=${to} subject=${subject} body=${text}`);
  }
}

module.exports = { sendEmail };


