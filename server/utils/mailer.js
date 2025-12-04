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

async function sendEmail(to, subject, body) {
  const transport = await getMailer();
  if (!transport) {
    console.log(
      `[EMAIL:DEV] to=${to} subject=${subject} body=${
        typeof body === 'object' ? JSON.stringify(body, null, 2) : body
      }`
    );
    return;
  }
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  try {
    const mailOptions = { from, to, subject };

    if (typeof body === 'object' && body !== null) {
      mailOptions.text = body.text || '';
      if (body.html) {
        mailOptions.html = body.html;
      }
    } else {
      mailOptions.text = body;
    }

    await transport.sendMail(mailOptions);
  } catch (e) {
    console.error('SMTP sendMail failed, falling back to console log:', e);
    console.log(
      `[EMAIL:DEV] to=${to} subject=${subject} body=${
        typeof body === 'object' ? JSON.stringify(body, null, 2) : body
      }`
    );
  }
}

module.exports = { sendEmail };


