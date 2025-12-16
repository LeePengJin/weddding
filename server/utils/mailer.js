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

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatRM(amount) {
  const n = Number(amount || 0);
  if (!Number.isFinite(n)) return 'RM 0';
  return `RM ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

/**
 * Generate a styled payment reminder email (deposit or final).
 * @param {object} params
 * @param {'deposit'|'final'} params.paymentType
 * @param {string} params.name
 * @param {string} params.bookingId
 * @param {string} params.vendorName
 * @param {string} params.weddingDateLabel
 * @param {string} params.dueDateLabel
 * @param {number} params.amountDue
 * @param {number} params.totalAmount
 * @param {string} params.actionUrl
 * @returns {{text:string, html:string}}
 */
function generatePaymentReminderEmail(params) {
  const paymentType = params?.paymentType === 'final' ? 'final' : 'deposit';
  const title = paymentType === 'deposit' ? 'Deposit Payment Reminder' : 'Final Payment Reminder';
  const subtitle = 'Payment due in 3 days';
  const accent =
    paymentType === 'deposit'
      ? 'linear-gradient(135deg,#f9739b,#ec4899)'
      : 'linear-gradient(135deg,#6366f1,#3b82f6)';

  const name = escapeHtml(params?.name || 'there');
  const bookingId = escapeHtml(params?.bookingId || '');
  const vendorName = escapeHtml(params?.vendorName || 'Vendor');
  const weddingDateLabel = escapeHtml(params?.weddingDateLabel || '');
  const dueDateLabel = escapeHtml(params?.dueDateLabel || '');
  const actionUrl = escapeHtml(params?.actionUrl || (process.env.FRONTEND_BASE_URL || 'https://localhost:3000'));

  const amountDue = formatRM(params?.amountDue);
  const totalAmount = formatRM(params?.totalAmount);

  const text = `Hi ${params?.name || 'there'},

This is a reminder that your ${paymentType === 'deposit' ? 'deposit' : 'final'} payment is due in 3 days.

Booking Details:
- Booking ID: ${params?.bookingId || ''}
- Vendor: ${params?.vendorName || 'Vendor'}
- Wedding Date: ${params?.weddingDateLabel || ''}
- Due Date: ${params?.dueDateLabel || ''}
- Amount Due: ${amountDue}
- Total Booking Amount: ${totalAmount}

Please make your payment before the due date to avoid automatic cancellation.

Pay now: ${params?.actionUrl || ''}`;

  const html = `
    <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f5f5f7; padding:24px;">
      <table align="center" width="100%" style="max-width:640px; margin:0 auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 10px 30px rgba(15,23,42,0.08);">
        <tr>
          <td style="padding:24px 32px 16px; background:${accent}; color:#ffffff;">
            <h1 style="margin:0; font-size:24px; letter-spacing:0.03em; text-transform:uppercase;">${title}</h1>
            <p style="margin:8px 0 0; opacity:0.9;">${subtitle}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 8px;">
            <p style="margin:0 0 16px; color:#111827;">Hi ${name},</p>
            <p style="margin:0 0 16px; color:#4b5563; line-height:1.6;">
              This is a reminder that your <strong>${paymentType === 'deposit' ? 'deposit' : 'final'}</strong> payment is due in <strong>3 days</strong>.
              Please make your payment before the due date to avoid automatic cancellation.
            </p>

            <div style="margin:24px 0; padding:16px 18px; border-radius:12px; background:#f9fafb; border:1px solid #e5e7eb;">
              <h2 style="margin:0 0 12px; font-size:16px; color:#111827;">Booking Summary</h2>
              <table style="width:100%; font-size:14px; color:#374151;">
                <tr>
                  <td style="padding:4px 0; width:40%; opacity:0.7;">Booking ID</td>
                  <td style="padding:4px 0; font-family:monospace;">${bookingId}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0; opacity:0.7;">Vendor</td>
                  <td style="padding:4px 0;">${vendorName}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0; opacity:0.7;">Wedding Date</td>
                  <td style="padding:4px 0;">${weddingDateLabel}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0; opacity:0.7;">Due Date</td>
                  <td style="padding:4px 0; font-weight:600;">${dueDateLabel}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0; opacity:0.7;">Amount Due</td>
                  <td style="padding:8px 0; font-weight:700; color:#111827;">${amountDue}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0; opacity:0.7;">Total Booking Amount</td>
                  <td style="padding:8px 0; font-weight:600; color:#111827;">${totalAmount}</td>
                </tr>
              </table>
            </div>

            <div style="margin:24px 0;">
              <a href="${actionUrl}"
                 style="display:inline-block; padding:10px 18px; border-radius:999px;
                        background:#111827; color:#ffffff; text-decoration:none; font-size:14px; font-weight:600;">
                Pay Now
              </a>
            </div>

            <p style="margin:16px 0 0; font-size:12px; color:#9ca3af;">
              If you’ve already completed this payment, you can ignore this reminder.
            </p>
          </td>
        </tr>
      </table>
    </div>
  `;

  return { text, html };
}

/**
 * Generate a styled refund processed email.
 * @param {object} params
 * @param {string} params.name
 * @param {string} params.bookingId
 * @param {string} params.vendorName
 * @param {number|string} params.refundAmount
 * @param {string} [params.refundMethod]
 * @param {string} [params.refundNotes]
 * @returns {{text:string, html:string}}
 */
function generateRefundProcessedEmail(params) {
  const name = escapeHtml(params?.name || 'there');
  const bookingId = escapeHtml(params?.bookingId || '');
  const vendorName = escapeHtml(params?.vendorName || 'Vendor');
  const refundMethod = escapeHtml(params?.refundMethod || '');
  const refundNotes = escapeHtml(params?.refundNotes || '');
  const refundAmountLabel = formatRM(params?.refundAmount);
  const actionUrl = escapeHtml(process.env.FRONTEND_BASE_URL || 'https://localhost:3000');

  const text = `Hi ${params?.name || 'there'},

Your refund has been processed.

Refund Summary:
- Booking ID: ${params?.bookingId || ''}
- Vendor: ${params?.vendorName || 'Vendor'}
- Refund Amount: ${refundAmountLabel}
${params?.refundMethod ? `- Refund Method: ${params.refundMethod}` : ''}

You can log in to Weddding to view your booking details: ${actionUrl}

Weddding Platform Team`;

  const html = `
    <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f5f5f7; padding:24px;">
      <table align="center" width="100%" style="max-width:640px; margin:0 auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 10px 30px rgba(15,23,42,0.08);">
        <tr>
          <td style="padding:24px 32px 16px; background:linear-gradient(135deg,#10b981,#22c55e); color:#ffffff;">
            <h1 style="margin:0; font-size:24px; letter-spacing:0.03em; text-transform:uppercase;">Refund Processed</h1>
            <p style="margin:8px 0 0; opacity:0.92;">Your refund has been completed successfully.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 8px;">
            <p style="margin:0 0 16px; color:#111827;">Hi ${name},</p>
            <p style="margin:0 0 16px; color:#4b5563; line-height:1.6;">
              We&apos;ve processed your refund for the cancelled booking. Below is the summary for your reference.
            </p>

            <div style="margin:24px 0; padding:16px 18px; border-radius:12px; background:#f9fafb; border:1px solid #e5e7eb;">
              <h2 style="margin:0 0 12px; font-size:16px; color:#111827;">Refund Summary</h2>
              <table style="width:100%; font-size:14px; color:#374151;">
                <tr>
                  <td style="padding:4px 0; width:40%; opacity:0.7;">Booking ID</td>
                  <td style="padding:4px 0; font-family:monospace;">${bookingId}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0; opacity:0.7;">Vendor</td>
                  <td style="padding:4px 0;">${vendorName}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0; opacity:0.7;">Refund Amount</td>
                  <td style="padding:8px 0; font-weight:800; color:#111827;">${refundAmountLabel}</td>
                </tr>
                ${refundMethod ? `
                <tr>
                  <td style="padding:4px 0; opacity:0.7;">Refund Method</td>
                  <td style="padding:4px 0;">${refundMethod}</td>
                </tr>` : ''}
              </table>
              ${refundNotes ? `
                <div style="margin-top:12px; padding-top:12px; border-top:1px dashed #e5e7eb;">
                  <div style="font-size:12px; color:#6b7280; text-transform:uppercase; letter-spacing:0.08em;">Notes</div>
                  <div style="margin-top:6px; color:#374151; font-size:13px; line-height:1.5;">${refundNotes}</div>
                </div>` : ''}
            </div>

            <div style="margin:24px 0;">
              <a href="${actionUrl}"
                 style="display:inline-block; padding:10px 18px; border-radius:999px;
                        background:#111827; color:#ffffff; text-decoration:none; font-size:14px; font-weight:700;">
                Open Weddding
              </a>
            </div>

            <p style="margin:16px 0 0; font-size:12px; color:#9ca3af;">
              If you have questions, reply to this email and we&apos;ll help you.
            </p>
          </td>
        </tr>
      </table>
    </div>
  `;

  return { text, html };
}

module.exports = { sendEmail, generateOtpEmail, generatePaymentReminderEmail, generateRefundProcessedEmail };


