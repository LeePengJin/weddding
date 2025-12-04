const { PrismaClient } = require('@prisma/client');
const { sendEmail } = require('../utils/mailer');

const prisma = new PrismaClient();

async function approveVendor(userId) {
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      include: { vendor: true },
    });
    if (!user || user.role !== 'vendor') {
      throw new Error('Vendor not found');
    }
    if (user.status !== 'pending_verification') {
      throw new Error('Vendor is not pending verification');
    }

    await tx.user.update({
      where: { id: userId },
      data: { status: 'active' },
    });

    return user;
  });

  // Send approval email
  const subject = 'Your Vendor Account Has Been Approved';
  const text = 'Your vendor account has been approved. You can now log in to your account.';
  const html = `
    <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f5f5f7; padding:24px;">
      <table align="center" width="100%" style="max-width:560px; margin:0 auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 10px 30px rgba(15,23,42,0.08);">
        <tr>
          <td style="padding:22px 30px; background:linear-gradient(135deg,#38bdf8,#0ea5e9); color:#ffffff;">
            <h1 style="margin:0; font-size:22px; letter-spacing:0.05em; text-transform:uppercase;">Welcome to Weddding</h1>
            <p style="margin:8px 0 0; opacity:0.9;">Your vendor account is now live.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 30px 20px;">
            <p style="margin:0 0 16px; color:#111827;">Hi ${result.vendor?.name || result.email},</p>
            <p style="margin:0 0 16px; color:#4b5563; line-height:1.6;">
              Your vendor account has been <strong>approved</strong>. You can now log in, manage your profile, respond to
              booking requests, and showcase your services to couples planning their weddings.
            </p>
            <div style="margin:20px 0 24px;">
              <a href="${process.env.FRONTEND_BASE_URL || 'https://localhost:3000'}/login"
                 style="display:inline-block; padding:10px 18px; border-radius:999px;
                        background:#111827; color:#ffffff; text-decoration:none; font-size:14px; font-weight:600;">
                Log In to Vendor Dashboard
              </a>
            </div>
            <p style="margin:0 0 12px; color:#9ca3af; font-size:12px;">
              If you did not request a vendor account on Weddding, please contact our support team immediately.
            </p>
          </td>
        </tr>
      </table>
    </div>
  `;

  await sendEmail(result.email, subject, { text, html });

  return result;
}

async function rejectVendor(userId, reason) {
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      include: { vendor: true },
    });
    if (!user || user.role !== 'vendor') {
      throw new Error('Vendor not found');
    }
    if (user.status !== 'pending_verification') {
      throw new Error('Vendor is not pending verification');
    }

    await tx.user.update({
      where: { id: userId },
      data: { status: 'rejected' },
    });

    return user;
  });

  // Send rejection email
  const reasonText = reason ? `<p style="margin:0 0 8px;">Reason: ${reason}</p>` : '';
  const subject = 'Vendor Account Request Declined';
  const text = `Your vendor account request has been declined.${reason ? '\n\nReason: ' + reason : ''}\n\nYou can resubmit your request with updated information.`;
  const html = `
    <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#fef2f2; padding:24px;">
      <table align="center" width="100%" style="max-width:560px; margin:0 auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 10px 30px rgba(127,29,29,0.08);">
        <tr>
          <td style="padding:22px 30px; background:linear-gradient(135deg,#f97373,#b91c1c); color:#ffffff;">
            <h1 style="margin:0; font-size:22px; letter-spacing:0.05em; text-transform:uppercase;">Vendor Request Declined</h1>
            <p style="margin:8px 0 0; opacity:0.9;">We&apos;re unable to approve your account at this time.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 30px 20px;">
            <p style="margin:0 0 16px; color:#111827;">Hi ${result.vendor?.name || result.email},</p>
            <p style="margin:0 0 16px; color:#4b5563; line-height:1.6;">
              After reviewing your application, we&apos;re currently unable to approve your vendor account on Weddding.
            </p>
            ${reasonText}
            <p style="margin:0 0 16px; color:#4b5563; line-height:1.6;">
              You may update your information and <strong>resubmit your request</strong> for consideration.
            </p>
          </td>
        </tr>
      </table>
    </div>
  `;

  await sendEmail(result.email, subject, { text, html });

  return result;
}

module.exports = { approveVendor, rejectVendor };

