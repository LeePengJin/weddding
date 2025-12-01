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
    const couple = await prisma.couple.findUnique({
      where: { userId: booking.coupleId },
      include: { user: true },
    });

    if (!couple || !couple.user.email) {
      console.warn(`No email found for couple ${booking.coupleId}`);
      return;
    }

    const isVendorCancellation = booking.status === 'cancelled_by_vendor';
    const cancelledBy = isVendorCancellation ? 'the vendor' : 'you';

    const subject = 'Booking Cancellation Confirmed - Weddding Platform';
    const text = `Dear ${couple.user.name || 'Valued Customer'},

Your booking has been successfully cancelled.

Booking Details:
- Booking ID: ${booking.id}
- Vendor: ${booking.vendor?.user?.name || 'Vendor'}
- Wedding Date: ${new Date(booking.reservedDate).toLocaleDateString()}
- Cancelled by: ${cancelledBy}
- Cancellation Date: ${new Date(cancellation.cancelledAt).toLocaleDateString()}
${cancellation.cancellationFee !== null ? `- Cancellation Fee: RM ${parseFloat(cancellation.cancellationFee).toLocaleString()}` : ''}

${isVendorCancellation ? 'The vendor has cancelled this booking. If you have any questions, please contact our support team.' : 'Your booking cancellation is complete. If you have any questions, please contact our support team.'}

We hope to serve you in the future.

Best regards,
Weddding Platform Team`;

    await sendEmail(couple.user.email, subject, text);
    console.log(`✅ Cancellation completed notification sent to ${couple.user.email} for booking ${booking.id}`);
  } catch (error) {
    console.error(`❌ Error sending cancellation completed notification for booking ${booking.id}:`, error);
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

    const subject = 'Important: Venue Booking Cancelled - Action Required - Weddding Platform';
    const text = `Dear ${couple.user.name || 'Valued Customer'},

Your venue booking has been cancelled.

Venue Booking Details:
- Booking ID: ${venueBooking.id}
- Venue: ${venueBooking.vendor?.user?.name || 'Venue'}
- Wedding Date: ${weddingDate.toLocaleDateString()}
- Cancellation Reason: ${reason}

${dependentBookings.length > 0 ? `⚠️ IMPORTANT: You have ${dependentBookings.length} other service booking(s) that depend on this venue:
${dependentBookings.map((b, i) => `  ${i + 1}. ${b.vendor?.user?.name || 'Vendor'} - ${b.selectedServices?.[0]?.serviceListing?.name || 'Service'}`).join('\n')}

` : ''}${isDisaster ? 'Due to the unforeseen circumstances, ' : ''}You have a grace period until your wedding date (${weddingDate.toLocaleDateString()}) to select a replacement venue.

If you do not select a new venue by your wedding date, all dependent service bookings will be automatically cancelled and refunds will be processed according to our refund policy.

Please log into your account to:
1. Select a new venue for your wedding date
2. Contact affected vendors if needed
3. Review your booking status

${isDisaster ? 'We understand this is a difficult situation. Our team is here to help you find a solution.\n\n' : ''}If you have any questions, please contact our support team.

Best regards,
Weddding Platform Team`;

    await sendEmail(couple.user.email, subject, text);
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

module.exports = {
  sendDepositDueDateReminder,
  sendFinalPaymentDueDateReminder,
  sendAutoCancellationNotification,
  sendCancellationFeeRequiredNotification,
  sendCancellationCompletedNotification,
  sendVenueCancellationNotification,
  sendVenueCancellationVendorNotification,
};

