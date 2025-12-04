/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');
const { sendEmail } = require('../utils/mailer');

const prisma = new PrismaClient();

/**
 * Send deposit due date reminder (3 days before due date)
 */
async function sendDepositDueDateReminder(booking) {
  try {
    const couple = await prisma.couple.findUnique({
      where: { userId: booking.coupleId },
      include: { user: true },
    });

    if (!couple || !couple.user.email) {
      console.warn(`No email found for couple ${booking.coupleId}`);
      return;
    }

    const dueDate = booking.depositDueDate ? new Date(booking.depositDueDate) : null;
    if (!dueDate) {
      return;
    }

    const totalAmount = booking.selectedServices.reduce((sum, service) => {
      return sum + Number(service.totalPrice);
    }, 0);

    const depositAmount = totalAmount * 0.1; // 10% deposit

    const subject = 'Reminder: Deposit Payment Due Soon - Weddding Platform';
    const text = `Dear ${couple.user.name || 'Valued Customer'},

This is a reminder that your deposit payment is due in 3 days.

Booking Details:
- Booking ID: ${booking.id}
- Vendor: ${booking.vendor?.user?.name || 'Vendor'}
- Wedding Date: ${new Date(booking.reservedDate).toLocaleDateString()}
- Deposit Due Date: ${dueDate.toLocaleDateString()}
- Deposit Amount: RM ${depositAmount.toLocaleString()}
- Total Booking Amount: RM ${totalAmount.toLocaleString()}

Please make your deposit payment before the due date to confirm your booking. If payment is not received by the due date, your booking will be automatically cancelled.

You can make your payment by logging into your account and navigating to the Payment Center.

Thank you for choosing Weddding Platform.

Best regards,
Weddding Platform Team`;

    await sendEmail(couple.user.email, subject, text);
    console.log(`✅ Deposit reminder sent to ${couple.user.email} for booking ${booking.id}`);
  } catch (error) {
    console.error(`❌ Error sending deposit reminder for booking ${booking.id}:`, error);
  }
}

/**
 * Send final payment due date reminder (3 days before due date)
 */
async function sendFinalPaymentDueDateReminder(booking) {
  try {
    const couple = await prisma.couple.findUnique({
      where: { userId: booking.coupleId },
      include: { user: true },
    });

    if (!couple || !couple.user.email) {
      console.warn(`No email found for couple ${booking.coupleId}`);
      return;
    }

    const dueDate = booking.finalDueDate ? new Date(booking.finalDueDate) : null;
    if (!dueDate) {
      return;
    }

    const totalAmount = booking.selectedServices.reduce((sum, service) => {
      return sum + Number(service.totalPrice);
    }, 0);

    // Calculate final payment amount (total - deposit)
    const depositPaid = booking.payments
      .filter((p) => p.paymentType === 'deposit')
      .reduce((sum, p) => sum + Number(p.amount), 0);
    const finalAmount = totalAmount - depositPaid;

    const subject = 'Reminder: Final Payment Due Soon - Weddding Platform';
    const text = `Dear ${couple.user.name || 'Valued Customer'},

This is a reminder that your final payment is due in 3 days.

Booking Details:
- Booking ID: ${booking.id}
- Vendor: ${booking.vendor?.user?.name || 'Vendor'}
- Wedding Date: ${new Date(booking.reservedDate).toLocaleDateString()}
- Final Payment Due Date: ${dueDate.toLocaleDateString()}
- Final Payment Amount: RM ${finalAmount.toLocaleString()}
- Total Booking Amount: RM ${totalAmount.toLocaleString()}

Please make your final payment before the due date. If payment is not received by the due date, your booking will be automatically cancelled.

You can make your payment by logging into your account and navigating to the Payment Center.

Thank you for choosing Weddding Platform.

Best regards,
Weddding Platform Team`;

    await sendEmail(couple.user.email, subject, text);
    console.log(`✅ Final payment reminder sent to ${couple.user.email} for booking ${booking.id}`);
  } catch (error) {
    console.error(`❌ Error sending final payment reminder for booking ${booking.id}:`, error);
  }
}

/**
 * Send notification when booking is auto-cancelled
 */
async function sendAutoCancellationNotification(booking, reason) {
  try {
    const couple = await prisma.couple.findUnique({
      where: { userId: booking.coupleId },
      include: { user: true },
    });

    if (!couple || !couple.user.email) {
      console.warn(`No email found for couple ${booking.coupleId}`);
      return;
    }

    const subject = 'Booking Auto-Cancelled - Weddding Platform';
    const text = `Dear ${couple.user.name || 'Valued Customer'},

We regret to inform you that your booking has been automatically cancelled.

Booking Details:
- Booking ID: ${booking.id}
- Vendor: ${booking.vendor?.user?.name || 'Vendor'}
- Wedding Date: ${new Date(booking.reservedDate).toLocaleDateString()}
- Reason: ${reason}

Your booking was cancelled because the payment was not received by the due date. If you have any questions or concerns, please contact our support team.

We hope to serve you in the future.

Best regards,
Weddding Platform Team`;

    await sendEmail(couple.user.email, subject, text);
    console.log(`✅ Auto-cancellation notification sent to ${couple.user.email} for booking ${booking.id}`);
  } catch (error) {
    console.error(`❌ Error sending auto-cancellation notification for booking ${booking.id}:`, error);
  }
}

/**
 * Send notification when cancellation fee is required
 */
async function sendCancellationFeeRequiredNotification(booking, feeCalculation) {
  try {
    const couple = await prisma.couple.findUnique({
      where: { userId: booking.coupleId },
      include: { user: true },
    });

    if (!couple || !couple.user.email) {
      console.warn(`No email found for couple ${booking.coupleId}`);
      return;
    }

    const subject = 'Cancellation Fee Required - Weddding Platform';
    const text = `Dear ${couple.user.name || 'Valued Customer'},

You have requested to cancel your booking. A cancellation fee is required to complete the cancellation.

Booking Details:
- Booking ID: ${booking.id}
- Vendor: ${booking.vendor?.user?.name || 'Vendor'}
- Wedding Date: ${new Date(booking.reservedDate).toLocaleDateString()}

Cancellation Fee Details:
- Cancellation Fee: RM ${feeCalculation.feeAmount.toLocaleString()}
- Amount Already Paid: RM ${feeCalculation.amountPaid.toLocaleString()}
- Payment Required: RM ${feeCalculation.feeDifference.toLocaleString()}

Please make the cancellation fee payment to complete the cancellation. You can do this by logging into your account and navigating to the booking details.

Thank you for your understanding.

Best regards,
Weddding Platform Team`;

    await sendEmail(couple.user.email, subject, text);
    console.log(`✅ Cancellation fee required notification sent to ${couple.user.email} for booking ${booking.id}`);
  } catch (error) {
    console.error(`❌ Error sending cancellation fee required notification for booking ${booking.id}:`, error);
  }
}

/**
 * Send notification when cancellation is completed
 */
async function sendCancellationCompletedNotification(booking, cancellation) {
  try {
    let coupleUser = booking.couple?.user;
    if (!coupleUser || !coupleUser.email) {
      const couple = await prisma.couple.findUnique({
        where: { userId: booking.coupleId },
        include: { user: true },
      });
      coupleUser = couple?.user;
    }

    if (!coupleUser || !coupleUser.email) {
      console.warn(`No email found for couple ${booking.coupleId}`);
      return;
    }

    const isVendorCancellation = booking.status === 'cancelled_by_vendor';
    const cancelledBy = isVendorCancellation ? 'the vendor' : 'you';
    const cancellationReason = cancellation.cancellationReason || 'Not provided';
    const cancellationFee =
      cancellation.cancellationFee !== null && cancellation.cancellationFee !== undefined
        ? `Cancellation Fee: RM ${Number(cancellation.cancellationFee).toLocaleString()}`
        : null;
    const cancellationDate = cancellation.cancelledAt
      ? new Date(cancellation.cancelledAt).toLocaleDateString()
      : new Date().toLocaleDateString();
    const weddingDate = booking.reservedDate ? new Date(booking.reservedDate).toLocaleDateString() : 'N/A';

    const refundInstruction = isVendorCancellation
      ? 'Please reply to this email with your preferred refund method (for example bank transfer details, Touch ’n Go wallet, or another method) so our team can coordinate the refund with the vendor immediately.'
      : 'If you believe a refund is due based on the vendor’s policy, reply to this email with your preferred refund method and we will assist you further.';

    const subject = 'Booking Cancelled - Summary & Next Steps';
    const text = `Hi ${coupleUser.name || 'there'},

Your booking with ${booking.vendor?.user?.name || 'the vendor'} has been cancelled.

Booking Details:
- Booking ID: ${booking.id}
- Wedding Date: ${weddingDate}
- Cancelled by: ${cancelledBy}
- Cancellation Date: ${cancellationDate}
- Reason: ${cancellationReason}
${cancellationFee ? `- ${cancellationFee}` : ''}

${refundInstruction}

We’re here if you need help planning your next steps.

Best regards,
Weddding Platform Team`;

    const html = `
      <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f5f5f7; padding:24px;">
        <table align="center" width="100%" style="max-width:640px; margin:0 auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 10px 30px rgba(15,23,42,0.08);">
          <tr>
            <td style="padding:24px 32px 16px; background:linear-gradient(135deg,#f97373,#e11d48); color:#ffffff;">
              <h1 style="margin:0; font-size:24px; letter-spacing:0.03em; text-transform:uppercase;">Booking Cancelled</h1>
              <p style="margin:8px 0 0; opacity:0.9;">Your booking has been cancelled. Please review the details below.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 8px;">
              <p style="margin:0 0 16px; color:#111827;">Hi ${coupleUser.name || 'there'},</p>
              <p style="margin:0 0 16px; color:#4b5563; line-height:1.6;">
                Your booking with <strong>${booking.vendor?.user?.name || 'the vendor'}</strong> has been
                <strong>cancelled</strong>. Here is a quick summary of what changed.
              </p>

              <div style="margin:24px 0; padding:16px 18px; border-radius:12px; background:#f9fafb; border:1px solid #e5e7eb;">
                <h2 style="margin:0 0 12px; font-size:16px; color:#111827;">Booking Summary</h2>
                <table style="width:100%; font-size:14px; color:#374151;">
                  <tr>
                    <td style="padding:4px 0; width:40%; opacity:0.7;">Booking ID</td>
                    <td style="padding:4px 0; font-family:monospace;">${booking.id}</td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0; opacity:0.7;">Vendor</td>
                    <td style="padding:4px 0;">${booking.vendor?.user?.name || 'Vendor'}</td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0; opacity:0.7;">Wedding Date</td>
                    <td style="padding:4px 0;">${weddingDate}</td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0; opacity:0.7;">Cancelled by</td>
                    <td style="padding:4px 0;">${cancelledBy}</td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0; opacity:0.7;">Cancellation Date</td>
                    <td style="padding:4px 0;">${cancellationDate}</td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0; opacity:0.7; vertical-align:top;">Reason</td>
                    <td style="padding:4px 0;">${cancellationReason}</td>
                  </tr>
                  ${
                    cancellationFee
                      ? `<tr>
                          <td style="padding:8px 0; opacity:0.7;">Cancellation Fee</td>
                          <td style="padding:8px 0; font-weight:600; color:#b91c1c;">${cancellationFee}</td>
                         </tr>`
                      : ''
                  }
                </table>
              </div>

              <div style="margin:16px 0; padding:16px 18px; border-radius:12px; background:#fef2f2; border:1px solid #fecaca;">
                <h2 style="margin:0 0 12px; font-size:15px; color:#b91c1c;">Refund & Next Steps</h2>
                <p style="margin:0; font-size:14px; color:#7f1d1d; line-height:1.6;">
                  ${refundInstruction}
                </p>
              </div>

              <p style="margin:0 0 16px; color:#4b5563; line-height:1.6;">
                You can review all your bookings and their latest status from the
                <strong>My Bookings</strong> page.
              </p>

              <div style="margin:24px 0;">
                <a href="${process.env.FRONTEND_BASE_URL || 'https://localhost:3000'}/my-bookings"
                   style="display:inline-block; padding:10px 18px; border-radius:999px;
                          background:#111827; color:#ffffff; text-decoration:none; font-size:14px; font-weight:600;">
                  Go to My Bookings
                </a>
              </div>

              <p style="margin:16px 0 0; font-size:12px; color:#9ca3af;">
                If you have any questions about this cancellation or a potential refund, please contact your vendor
                directly or reach out to our support team.
              </p>
            </td>
          </tr>
        </table>
      </div>
    `;

    await sendEmail(coupleUser.email, subject, { text, html });
    console.log(`✅ Cancellation completed notification sent to ${coupleUser.email} for booking ${booking.id}`);
  } catch (error) {
    console.error(`❌ Error sending cancellation completed notification for booking ${booking.id}:`, error);
  }
}

async function sendCancellationVendorNotification(booking, cancellation) {
  try {
    const vendorEmail = booking.vendor?.user?.email;
    if (!vendorEmail) {
      console.warn(`No email found for vendor ${booking.vendorId}`);
      return;
    }

    const coupleName = booking.couple?.user?.name || 'the couple';
    const cancellationReason = cancellation.cancellationReason || 'Not provided';
    const cancellationDate = cancellation.cancelledAt
      ? new Date(cancellation.cancelledAt).toLocaleDateString()
      : new Date().toLocaleDateString();
    const isCoupleCancellation = booking.status === 'cancelled_by_couple';
    const subject = isCoupleCancellation
      ? `Booking ${booking.id} cancelled by ${coupleName}`
      : `Booking ${booking.id} has been cancelled`;
    const amountPaid = booking.payments?.reduce((sum, payment) => sum + Number(payment.amount || 0), 0) || 0;

    const text = `Hello ${booking.vendor?.user?.name || 'Vendor'},

${coupleName} has cancelled booking ${booking.id}.

Details:
- Wedding Date: ${booking.reservedDate ? new Date(booking.reservedDate).toLocaleDateString() : 'N/A'}
- Cancellation Date: ${cancellationDate}
- Reason: ${cancellationReason}
- Amount Paid To Date: RM ${amountPaid.toLocaleString()}

If a refund is required, please reach out to the couple and request their preferred refund method so you can process it quickly.

Thank you,
Weddding Platform Team`;

    const html = `
      <div style="font-family: 'Inter', Arial, sans-serif; color: #2f3542; line-height: 1.6;">
        <h2 style="color:#1565c0;margin-bottom:12px;">Booking Update</h2>
        <p>Hello ${booking.vendor?.user?.name || 'Vendor'},</p>
        <p>${coupleName} has cancelled <strong>booking ${booking.id}</strong>.</p>
        <div style="background:#f1f5f9;border-radius:12px;padding:16px;margin:18px 0;">
          <ul style="padding-left:18px;margin:0;">
            <li><strong>Wedding Date:</strong> ${booking.reservedDate ? new Date(booking.reservedDate).toLocaleDateString() : 'N/A'}</li>
            <li><strong>Cancellation Date:</strong> ${cancellationDate}</li>
            <li><strong>Reason:</strong> ${cancellationReason}</li>
            <li><strong>Amount Paid To Date:</strong> RM ${amountPaid.toLocaleString()}</li>
          </ul>
        </div>
        <p>Please contact the couple to confirm the next steps and ask for their preferred refund method (bank transfer, Touch ’n Go, etc.) so refunds can be processed without delay.</p>
        <p style="margin-top:24px;">Thank you,<br/>Weddding Platform Team</p>
      </div>
    `;

    await sendEmail(vendorEmail, subject, { text, html });
    console.log(`✅ Cancellation notification sent to vendor ${vendorEmail} for booking ${booking.id}`);
  } catch (error) {
    console.error(`❌ Error sending cancellation vendor notification for booking ${booking.id}:`, error);
  }
}

/**
 * Send notification to couple when venue booking is cancelled
 * Informs them about dependent bookings and grace period
 */
async function sendVenueCancellationNotification(venueBooking, dependentBookings, reason) {
  try {
    const couple = await prisma.couple.findUnique({
      where: { userId: venueBooking.coupleId },
      include: { user: true },
    });

    if (!couple || !couple.user.email) {
      console.warn(`No email found for couple ${venueBooking.coupleId}`);
      return;
    }

    const weddingDate = new Date(venueBooking.reservedDate);
    const isDisaster = reason.toLowerCase().includes('disaster') || reason.toLowerCase().includes('fire') || reason.toLowerCase().includes('earthquake');
    const formattedWeddingDate = weddingDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    const subject = 'Important: Venue Booking Cancelled - Action Required - Weddding Platform';
    
    // Plain text version
    const text = `Dear ${couple.user.name || 'Valued Customer'},

Your venue booking has been cancelled.

Venue Booking Details:
- Booking ID: ${venueBooking.id}
- Venue: ${venueBooking.vendor?.user?.name || 'Venue'}
- Wedding Date: ${formattedWeddingDate}
- Cancellation Reason: ${reason}

${dependentBookings.length > 0 ? `⚠️ IMPORTANT: You have ${dependentBookings.length} other service booking(s) that depend on this venue:
${dependentBookings.map((b, i) => `  ${i + 1}. ${b.vendor?.user?.name || 'Vendor'} - ${b.selectedServices?.[0]?.serviceListing?.name || 'Service'}`).join('\n')}

` : ''}${isDisaster ? 'Due to the unforeseen circumstances, ' : ''}You have a grace period until your wedding date (${formattedWeddingDate}) to select a replacement venue.

If you do not select a new venue by your wedding date, all dependent service bookings will be automatically cancelled and refunds will be processed according to our refund policy.

Please log into your account to:
1. Select a new venue for your wedding date
2. Contact affected vendors if needed
3. Review your booking status

${isDisaster ? 'We understand this is a difficult situation. Our team is here to help you find a solution.\n\n' : ''}If you have any questions, please contact our support team.

Best regards,
Weddding Platform Team`;

    // HTML version
    const dependentServicesList = dependentBookings.length > 0 
      ? dependentBookings.map((b, i) => `
            <tr>
              <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb;">
                <strong>${i + 1}.</strong> ${b.vendor?.user?.name || 'Vendor'} - ${b.selectedServices?.[0]?.serviceListing?.name || 'Service'}
              </td>
            </tr>
          `).join('')
      : '';

    const html = `
      <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f5f5f7; padding:24px;">
        <table align="center" width="100%" style="max-width:600px; margin:0 auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 10px 30px rgba(15,23,42,0.08);">
          <tr>
            <td style="padding:24px 28px; background:linear-gradient(135deg,#ef4444,#dc2626); color:#ffffff;">
              <h1 style="margin:0; font-size:24px; letter-spacing:0.06em; text-transform:uppercase;">Venue Booking Cancelled</h1>
              <p style="margin:8px 0 0; opacity:0.95; font-size:16px;">Action Required</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 20px; color:#111827; font-size:16px; line-height:1.6;">Hi ${couple.user.name || 'Valued Customer'},</p>
              
              <p style="margin:0 0 20px; color:#4b5563; line-height:1.6;">
                We regret to inform you that your venue booking has been cancelled.
              </p>

              <div style="background:#f9fafb; border-left:4px solid #ef4444; padding:16px; margin:20px 0; border-radius:4px;">
                <h3 style="margin:0 0 12px; color:#111827; font-size:16px; font-weight:600;">Venue Booking Details</h3>
                <table style="width:100%; border-collapse:collapse;">
                  <tr>
                    <td style="padding:6px 0; color:#6b7280; font-size:14px; width:140px;">Booking ID:</td>
                    <td style="padding:6px 0; color:#111827; font-size:14px; font-weight:500;">${venueBooking.id}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0; color:#6b7280; font-size:14px;">Venue:</td>
                    <td style="padding:6px 0; color:#111827; font-size:14px; font-weight:500;">${venueBooking.vendor?.user?.name || 'Venue'}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0; color:#6b7280; font-size:14px;">Wedding Date:</td>
                    <td style="padding:6px 0; color:#111827; font-size:14px; font-weight:500;">${formattedWeddingDate}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0; color:#6b7280; font-size:14px;">Reason:</td>
                    <td style="padding:6px 0; color:#111827; font-size:14px;">${reason}</td>
                  </tr>
                </table>
              </div>

              ${dependentBookings.length > 0 ? `
              <div style="background:#fef3c7; border-left:4px solid #f59e0b; padding:16px; margin:20px 0; border-radius:4px;">
                <h3 style="margin:0 0 12px; color:#92400e; font-size:16px; font-weight:600;">
                  ⚠️ IMPORTANT: ${dependentBookings.length} Dependent Service Booking${dependentBookings.length !== 1 ? 's' : ''}
                </h3>
                <p style="margin:0 0 12px; color:#78350f; font-size:14px; line-height:1.6;">
                  You have ${dependentBookings.length} other service booking${dependentBookings.length !== 1 ? 's' : ''} that depend${dependentBookings.length === 1 ? 's' : ''} on this venue:
                </p>
                <table style="width:100%; border-collapse:collapse; background:#ffffff; border-radius:4px; overflow:hidden;">
                  ${dependentServicesList}
                </table>
              </div>
              ` : ''}

              <div style="background:#dbeafe; border-left:4px solid #3b82f6; padding:16px; margin:20px 0; border-radius:4px;">
                <h3 style="margin:0 0 12px; color:#1e40af; font-size:16px; font-weight:600;">⏰ Grace Period</h3>
                <p style="margin:0 0 8px; color:#1e3a8a; font-size:14px; line-height:1.6; font-weight:600;">
                  ${isDisaster ? 'Due to the unforeseen circumstances, ' : ''}You have a <strong>grace period until your wedding date (${formattedWeddingDate})</strong> to select a replacement venue.
                </p>
                <p style="margin:8px 0 0; color:#1e3a8a; font-size:14px; line-height:1.6;">
                  If you do not select a new venue by your wedding date, all dependent service bookings will be automatically cancelled and refunds will be processed according to our refund policy.
                </p>
              </div>

              <div style="background:#f0fdf4; border-left:4px solid #10b981; padding:16px; margin:20px 0; border-radius:4px;">
                <h3 style="margin:0 0 12px; color:#065f46; font-size:16px; font-weight:600;">Next Steps</h3>
                <p style="margin:0 0 12px; color:#047857; font-size:14px; line-height:1.6;">
                  Please log into your account to:
                </p>
                <ol style="margin:0; padding-left:20px; color:#047857; font-size:14px; line-height:1.8;">
                  <li>Select a new venue for your wedding date</li>
                  <li>Contact affected vendors if needed</li>
                  <li>Review your booking status</li>
                </ol>
              </div>

              ${isDisaster ? `
              <div style="background:#fef2f2; border-left:4px solid #ef4444; padding:16px; margin:20px 0; border-radius:4px;">
                <p style="margin:0; color:#991b1b; font-size:14px; line-height:1.6;">
                  We understand this is a difficult situation. Our team is here to help you find a solution.
                </p>
              </div>
              ` : ''}

              <p style="margin:24px 0 0; color:#6b7280; font-size:14px; line-height:1.6;">
                If you have any questions, please contact our support team.
              </p>

              <p style="margin:24px 0 0; color:#111827; font-size:14px;">
                Best regards,<br>
                <strong>Weddding Platform Team</strong>
              </p>
            </td>
          </tr>
        </table>
      </div>
    `;

    await sendEmail(couple.user.email, subject, { text, html });
    console.log(`✅ Venue cancellation notification sent to ${couple.user.email} for venue booking ${venueBooking.id}`);
  } catch (error) {
    console.error(`❌ Error sending venue cancellation notification for booking ${venueBooking.id}:`, error);
  }
}

/**
 * Send notification to vendor when their service booking's venue is cancelled
 */
async function sendVenueCancellationVendorNotification(dependentBooking, cancelledVenueBooking, reason) {
  try {
    const vendor = await prisma.vendor.findUnique({
      where: { userId: dependentBooking.vendorId },
      include: { user: true },
    });

    if (!vendor || !vendor.user.email) {
      console.warn(`No email found for vendor ${dependentBooking.vendorId}`);
      return;
    }

    const weddingDate = new Date(cancelledVenueBooking.reservedDate);

    const subject = 'Notice: Venue Cancelled for Your Booking - Weddding Platform';
    const text = `Dear ${vendor.user.name || 'Vendor'},

The venue booking for a wedding where your service is booked has been cancelled.

Your Booking Details:
- Booking ID: ${dependentBooking.id}
- Service: ${dependentBooking.selectedServices?.[0]?.serviceListing?.name || 'Service'}
- Wedding Date: ${weddingDate.toLocaleDateString()}
- Couple: ${dependentBooking.couple?.user?.name || 'Couple'}

Venue Cancellation:
- Venue: ${cancelledVenueBooking.vendor?.user?.name || 'Venue'}
- Reason: ${reason}

The couple has a grace period until the wedding date (${weddingDate.toLocaleDateString()}) to select a replacement venue. If no replacement venue is selected by then, this booking will be automatically cancelled.

You may want to contact the couple to discuss:
- Whether you can accommodate a new venue location
- Any adjustments needed for the new venue
- Or if you prefer to cancel this booking

If the booking is auto-cancelled due to no replacement venue, refunds will be processed according to our policy.

Best regards,
Weddding Platform Team`;

    await sendEmail(vendor.user.email, subject, text);
    console.log(`✅ Venue cancellation vendor notification sent to ${vendor.user.email} for booking ${dependentBooking.id}`);
  } catch (error) {
    console.error(`❌ Error sending venue cancellation vendor notification for booking ${dependentBooking.id}:`, error);
  }
}

/**
 * Send notification to couple when booking request is created
 */
async function sendBookingRequestCreatedCoupleNotification(booking) {
  try {
    const couple = await prisma.couple.findUnique({
      where: { userId: booking.coupleId },
      include: { user: true },
    });

    if (!couple || !couple.user.email) {
      console.warn(`No email found for couple ${booking.coupleId}`);
      return;
    }

    const totalAmount = booking.selectedServices.reduce((sum, service) => {
      return sum + Number(service.totalPrice);
    }, 0);

    const serviceNames = booking.selectedServices
      .map((s) => `${s.serviceListing?.name || 'Service'} (Qty: ${s.quantity})`)
      .join(', ');

    const subject = 'Booking Request Submitted - Weddding';

    const text = `Dear ${couple.user.name || 'Valued Customer'},

Your booking request has been successfully submitted.

Booking Details:
- Booking ID: ${booking.id}
- Vendor: ${booking.vendor?.user?.name || 'Vendor'}
- Wedding Date: ${new Date(booking.reservedDate).toLocaleDateString()}
- Services: ${serviceNames}
- Total Amount: RM ${totalAmount.toLocaleString()}

Status: Pending Vendor Confirmation

The vendor will review your booking request and respond shortly. You will be notified once the vendor accepts or rejects your request.

You can track the status of your booking in the \"My Bookings\" section of your account.

Thank you for choosing Weddding.

Best regards,
Weddding Team`;

    const html = `
      <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f5f5f7; padding:24px;">
        <table align="center" width="100%" style="max-width:640px; margin:0 auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 10px 30px rgba(15,23,42,0.08);">
          <tr>
            <td style="padding:24px 32px 16px; background:linear-gradient(135deg,#f9739b,#ec4899); color:#ffffff;">
              <h1 style="margin:0; font-size:24px; letter-spacing:0.03em; text-transform:uppercase;">Booking Request Submitted</h1>
              <p style="margin:8px 0 0; opacity:0.9;">Thank you for planning with Weddding.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 8px;">
              <p style="margin:0 0 16px; color:#111827;">Hi ${couple.user.name || 'there'},</p>
              <p style="margin:0 0 16px; color:#4b5563; line-height:1.6;">
                Your booking request has been received and is now <strong>pending vendor confirmation</strong>.
              </p>

              <div style="margin:24px 0; padding:16px 18px; border-radius:12px; background:#f9fafb; border:1px solid #e5e7eb;">
                <h2 style="margin:0 0 12px; font-size:16px; color:#111827;">Booking Details</h2>
                <table style="width:100%; font-size:14px; color:#374151;">
                  <tr>
                    <td style="padding:4px 0; width:40%; opacity:0.7;">Booking ID</td>
                    <td style="padding:4px 0; font-family:monospace;">${booking.id}</td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0; opacity:0.7;">Vendor</td>
                    <td style="padding:4px 0;">${booking.vendor?.user?.name || 'Vendor'}</td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0; opacity:0.7;">Wedding Date</td>
                    <td style="padding:4px 0;">${new Date(booking.reservedDate).toLocaleDateString()}</td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0; opacity:0.7; vertical-align:top;">Services</td>
                    <td style="padding:4px 0;">${serviceNames}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0; opacity:0.7;">Total Amount</td>
                    <td style="padding:8px 0; font-weight:600; color:#111827;">RM ${totalAmount.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0; opacity:0.7;">Current Status</td>
                    <td style="padding:8px 0; font-weight:500; color:#16a34a;">Pending Vendor Confirmation</td>
                  </tr>
                </table>
              </div>

              <p style="margin:0 0 16px; color:#4b5563; line-height:1.6;">
                You’ll receive another email once the vendor has accepted or rejected your request.
                You can also track the status at any time from your <strong>My Bookings</strong> page.
              </p>

              <div style="margin:24px 0;">
                <a href="${process.env.FRONTEND_BASE_URL || 'https://localhost:3000'}/my-bookings"
                   style="display:inline-block; padding:10px 18px; border-radius:999px;
                          background:#111827; color:#ffffff; text-decoration:none; font-size:14px; font-weight:600;">
                  View My Bookings
                </a>
              </div>

              <p style="margin:16px 0 0; font-size:12px; color:#9ca3af;">
                If you didn’t make this request, please contact our support team immediately.
              </p>
            </td>
          </tr>
        </table>
      </div>
    `;

    await sendEmail(couple.user.email, subject, { text, html });
    console.log(`✅ Booking request created notification sent to couple ${couple.user.email} for booking ${booking.id}`);
  } catch (error) {
    console.error(`❌ Error sending booking request created notification to couple for booking ${booking.id}:`, error);
  }
}

/**
 * Send notification when vendor accepts a booking request
 * Includes deposit/final due dates when available.
 */
async function sendBookingAcceptedCoupleNotification(booking) {
  try {
    const couple = await prisma.couple.findUnique({
      where: { userId: booking.coupleId },
      include: { user: true },
    });

    if (!couple || !couple.user.email) {
      console.warn(`No email found for couple ${booking.coupleId}`);
      return;
    }

    const totalAmount = booking.selectedServices.reduce((sum, service) => {
      return sum + Number(service.totalPrice);
    }, 0);

    const serviceNames = booking.selectedServices
      .map((s) => `${s.serviceListing?.name || 'Service'} (Qty: ${s.quantity})`)
      .join(', ');

    const subject = 'Booking Accepted - Next Steps & Payment Due Dates';

    const depositAmount = Math.round(totalAmount * 0.30 * 100) / 100;
    const finalAmount = Math.max(0, Math.round((totalAmount - depositAmount) * 100) / 100);

    const depositDue =
      booking.depositDueDate
        ? new Date(booking.depositDueDate).toLocaleDateString()
        : 'To be provided by vendor';
    const finalDue =
      booking.finalDueDate
        ? new Date(booking.finalDueDate).toLocaleDateString()
        : 'Will be set after deposit is paid';

    const text = `Dear ${couple.user.name || 'Valued Customer'},

Good news! Your booking request has been accepted by the vendor.

Booking Details:
- Booking ID: ${booking.id}
- Vendor: ${booking.vendor?.user?.name || 'Vendor'}
- Wedding Date: ${new Date(booking.reservedDate).toLocaleDateString()}
- Services: ${serviceNames}
- Total Amount: RM ${totalAmount.toLocaleString()}

Payment Schedule:
- Deposit: RM ${depositAmount.toLocaleString()} (30% of total) — Due by ${depositDue}
- Final Payment: RM ${finalAmount.toLocaleString()} — Due by ${finalDue}

Please pay the deposit by the due date to confirm your booking. You can make payment from the "My Bookings" section.

Thank you for choosing Weddding.

Best regards,
Weddding Team`;

    const html = `
      <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f5f5f7; padding:24px;">
        <table align="center" width="100%" style="max-width:640px; margin:0 auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 10px 30px rgba(15,23,42,0.08);">
          <tr>
            <td style="padding:24px 32px 16px; background:linear-gradient(135deg,#22c55e,#16a34a); color:#ffffff;">
              <h1 style="margin:0; font-size:24px; letter-spacing:0.03em; text-transform:uppercase;">Booking Accepted</h1>
              <p style="margin:8px 0 0; opacity:0.9;">Your vendor has accepted your booking request.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 8px;">
              <p style="margin:0 0 16px; color:#111827;">Hi ${couple.user.name || 'there'},</p>
              <p style="margin:0 0 16px; color:#4b5563; line-height:1.6;">
                Your booking request has been <strong>accepted</strong>. Please review the payment schedule below
                and pay the deposit to confirm your booking.
              </p>

              <div style="margin:24px 0; padding:16px 18px; border-radius:12px; background:#f9fafb; border:1px solid #e5e7eb;">
                <h2 style="margin:0 0 12px; font-size:16px; color:#111827;">Booking Summary</h2>
                <table style="width:100%; font-size:14px; color:#374151;">
                  <tr>
                    <td style="padding:4px 0; width:40%; opacity:0.7;">Booking ID</td>
                    <td style="padding:4px 0; font-family:monospace;">${booking.id}</td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0; opacity:0.7;">Vendor</td>
                    <td style="padding:4px 0;">${booking.vendor?.user?.name || 'Vendor'}</td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0; opacity:0.7;">Wedding Date</td>
                    <td style="padding:4px 0;">${new Date(booking.reservedDate).toLocaleDateString()}</td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0; opacity:0.7; vertical-align:top;">Services</td>
                    <td style="padding:4px 0;">${serviceNames}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0; opacity:0.7;">Total Amount</td>
                    <td style="padding:8px 0; font-weight:600; color:#111827;">RM ${totalAmount.toLocaleString()}</td>
                  </tr>
                </table>
              </div>

              <div style="margin:16px 0; padding:16px 18px; border-radius:12px; background:#ecfdf5; border:1px solid #bbf7d0;">
                <h2 style="margin:0 0 12px; font-size:15px; color:#166534;">Payment Schedule</h2>
                <table style="width:100%; font-size:14px; color:#166534;">
                  <tr>
                    <td style="padding:4px 0; width:45%; opacity:0.8;">Deposit</td>
                    <td style="padding:4px 0; font-weight:600;">
                      RM ${depositAmount.toLocaleString()} (30% of total)
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0; opacity:0.8;">Deposit Due Date</td>
                    <td style="padding:4px 0; font-weight:600;">${depositDue}</td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0; opacity:0.8;">Final Payment</td>
                    <td style="padding:4px 0; font-weight:600;">
                      RM ${finalAmount.toLocaleString()}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0; opacity:0.8;">Final Payment Due Date</td>
                    <td style="padding:4px 0; font-weight:600;">${finalDue}</td>
                  </tr>
                </table>
              </div>

              <p style="margin:0 0 16px; color:#4b5563; line-height:1.6;">
                You can pay the deposit and view full booking details from your <strong>My Bookings</strong> page.
              </p>

              <div style="margin:24px 0;">
                <a href="${process.env.FRONTEND_BASE_URL || 'https://localhost:3000'}/my-bookings"
                   style="display:inline-block; padding:10px 18px; border-radius:999px;
                          background:#111827; color:#ffffff; text-decoration:none; font-size:14px; font-weight:600;">
                  Go to My Bookings
                </a>
              </div>

              <p style="margin:16px 0 0; font-size:12px; color:#9ca3af;">
                If you have any questions about the payment schedule or services, please contact your vendor directly
                via the in-app messaging feature.
              </p>
            </td>
          </tr>
        </table>
      </div>
    `;

    await sendEmail(couple.user.email, subject, { text, html });
  } catch (error) {
    console.error(`❌ Error sending booking accepted notification for booking ${booking.id}:`, error);
  }
}

/**
 * Send notification to vendor when booking request is received
 */
async function sendBookingRequestReceivedVendorNotification(booking) {
  try {
    const vendor = await prisma.vendor.findUnique({
      where: { userId: booking.vendorId },
      include: { user: true },
    });

    if (!vendor || !vendor.user.email) {
      console.warn(`No email found for vendor ${booking.vendorId}`);
      return;
    }

    const couple = await prisma.couple.findUnique({
      where: { userId: booking.coupleId },
      include: { user: true },
    });

    const totalAmount = booking.selectedServices.reduce((sum, service) => {
      return sum + Number(service.totalPrice);
    }, 0);

    const serviceNames = booking.selectedServices
      .map((s) => `${s.serviceListing?.name || 'Service'} (Qty: ${s.quantity})`)
      .join(', ');

    const subject = 'New Booking Request Received - Weddding';

    const text = `Dear ${vendor.user.name || 'Vendor'},

You have received a new booking request.

Booking Details:
- Booking ID: ${booking.id}
- Couple: ${couple?.user?.name || 'Couple'}
- Wedding Date: ${new Date(booking.reservedDate).toLocaleDateString()}
- Services: ${serviceNames}
- Total Amount: RM ${totalAmount.toLocaleString()}

Status: Pending Your Confirmation

Please review this booking request and accept or reject it in the \"Booking Requests\" section of your account.

You have 7 days to respond to this booking request. If no response is received, the booking may be cancelled automatically.

Thank you for being part of Weddding.

Best regards,
Weddding Team`;

    const html = `
      <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f5f5f7; padding:24px;">
        <table align="center" width="100%" style="max-width:640px; margin:0 auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 10px 30px rgba(15,23,42,0.08);">
          <tr>
            <td style="padding:24px 32px 16px; background:linear-gradient(135deg,#38bdf8,#0ea5e9); color:#ffffff;">
              <h1 style="margin:0; font-size:24px; letter-spacing:0.03em; text-transform:uppercase;">New Booking Request</h1>
              <p style="margin:8px 0 0; opacity:0.9;">A couple is interested in your services on Weddding.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 8px;">
              <p style="margin:0 0 16px; color:#111827;">Hi ${vendor.user.name || 'there'},</p>
              <p style="margin:0 0 16px; color:#4b5563; line-height:1.6;">
                You’ve received a new booking request and it is currently <strong>pending your confirmation</strong>.
              </p>

              <div style="margin:24px 0; padding:16px 18px; border-radius:12px; background:#f9fafb; border:1px solid #e5e7eb;">
                <h2 style="margin:0 0 12px; font-size:16px; color:#111827;">Booking Details</h2>
                <table style="width:100%; font-size:14px; color:#374151;">
                  <tr>
                    <td style="padding:4px 0; width:40%; opacity:0.7;">Booking ID</td>
                    <td style="padding:4px 0; font-family:monospace;">${booking.id}</td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0; opacity:0.7;">Couple</td>
                    <td style="padding:4px 0;">${couple?.user?.name || 'Couple'}</td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0; opacity:0.7;">Wedding Date</td>
                    <td style="padding:4px 0;">${new Date(booking.reservedDate).toLocaleDateString()}</td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0; opacity:0.7; vertical-align:top;">Requested Services</td>
                    <td style="padding:4px 0;">${serviceNames}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0; opacity:0.7;">Estimated Total</td>
                    <td style="padding:8px 0; font-weight:600; color:#111827;">RM ${totalAmount.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0; opacity:0.7;">Current Status</td>
                    <td style="padding:8px 0; font-weight:500; color:#f97316;">Pending Your Confirmation</td>
                  </tr>
                </table>
              </div>

              <p style="margin:0 0 16px; color:#4b5563; line-height:1.6;">
                Please log in to your vendor dashboard to review the request details, update availability if needed,
                and accept or reject the booking.
              </p>

              <div style="margin:24px 0;">
                <a href="${process.env.FRONTEND_BASE_URL || 'https://localhost:3000'}/vendor/booking-requests"
                   style="display:inline-block; padding:10px 18px; border-radius:999px;
                          background:#111827; color:#ffffff; text-decoration:none; font-size:14px; font-weight:600;">
                  Review Booking Request
                </a>
              </div>

              <p style="margin:16px 0 0; font-size:12px; color:#9ca3af;">
                If you did not expect this email, you can safely ignore it. No action will be taken until you respond in your dashboard.
              </p>
            </td>
          </tr>
        </table>
      </div>
    `;

    await sendEmail(vendor.user.email, subject, { text, html });
    console.log(`✅ Booking request received notification sent to vendor ${vendor.user.email} for booking ${booking.id}`);
  } catch (error) {
    console.error(`❌ Error sending booking request received notification to vendor for booking ${booking.id}:`, error);
  }
}

module.exports = {
  sendDepositDueDateReminder,
  sendFinalPaymentDueDateReminder,
  sendAutoCancellationNotification,
  sendCancellationFeeRequiredNotification,
  sendCancellationCompletedNotification,
  sendCancellationVendorNotification,
  sendVenueCancellationNotification,
  sendVenueCancellationVendorNotification,
  sendBookingRequestCreatedCoupleNotification,
  sendBookingRequestReceivedVendorNotification,
  sendBookingAcceptedCoupleNotification,
};

