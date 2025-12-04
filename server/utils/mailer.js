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

/**
 * Generate a styled OTP email HTML template
 * @param {string} name - Recipient name
 * @param {string} code - OTP code
 * @param {string} purpose - Purpose of OTP: 'register', 'register_vendor', 'resubmit_vendor', 'reset'
 * @returns {object} Object with text and html properties
 */
function generateOtpEmail(name, code, purpose = 'register') {
  const purposeConfig = {
    register: {
      title: 'Verify Your Email',
      subtitle: 'Complete your Weddding account setup.',
      description: 'Use the one-time code below to verify your email address. This code is valid for <strong>10 minutes</strong>.',
    },
    register_vendor: {
      title: 'Verify Your Email',
      subtitle: 'Complete your Weddding vendor account setup.',
      description: 'Use the one-time code below to verify your email address. This code is valid for <strong>10 minutes</strong>.',
    },
    resubmit_vendor: {
      title: 'Verify Your Email',
      subtitle: 'Complete your vendor account resubmission.',
      description: 'Use the one-time code below to verify your email address. This code is valid for <strong>10 minutes</strong>.',
    },
    reset: {
      title: 'Reset Your Password',
      subtitle: 'Verify your identity to reset your password.',
      description: 'Use the one-time code below to reset your password. This code is valid for <strong>10 minutes</strong>.',
    },
  };

  const config = purposeConfig[purpose] || purposeConfig.register;
  const text = `Your OTP is: ${code} (valid for 10 minutes)`;

  const html = `
    <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f5f5f7; padding:24px;">
      <table align="center" width="100%" style="max-width:480px; margin:0 auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 10px 30px rgba(15,23,42,0.08);">
        <tr>
          <td style="padding:20px 28px; background:linear-gradient(135deg,#f9739b,#ec4899); color:#ffffff;">
            <h1 style="margin:0; font-size:22px; letter-spacing:0.06em; text-transform:uppercase;">${config.title}</h1>
            <p style="margin:8px 0 0; opacity:0.9;">${config.subtitle}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 28px 20px;">
            <p style="margin:0 0 16px; color:#111827;">Hi ${name},</p>
            <p style="margin:0 0 16px; color:#4b5563; line-height:1.6;">
              ${config.description}
            </p>
            <div style="margin:16px 0 20px; text-align:center;">
              <div style="display:inline-block; padding:10px 20px; border-radius:999px; background:#111827; color:#ffffff; font-size:20px; font-weight:700; letter-spacing:0.3em;">
                ${code}
              </div>
            </div>
            <p style="margin:0 0 12px; color:#9ca3af; font-size:12px;">
              If you didn&apos;t request this code, you can safely ignore this email.
            </p>
          </td>
        </tr>
      </table>
    </div>
  `;

  return { text, html };
}

module.exports = { sendEmail, generateOtpEmail };


