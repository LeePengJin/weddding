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
  await sendEmail(
    result.email,
    'Vendor Account Approved',
    `Your vendor account has been approved. You can now log in to your account.`
  );

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
  const reasonText = reason ? `\n\nReason: ${reason}` : '';
  await sendEmail(
    result.email,
    'Vendor Account Request Declined',
    `Your vendor account request has been declined.${reasonText}\n\nYou can resubmit your request with updated information.`
  );

  return result;
}

module.exports = { approveVendor, rejectVendor };

