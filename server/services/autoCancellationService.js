/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');
const { prefixedUlid } = require('../utils/id');
const notificationService = require('./notificationService');

const prisma = new PrismaClient();

/**
 * Check if a payment of a specific type exists for a booking
 */
async function hasPayment(bookingId, paymentType) {
  const payment = await prisma.payment.findFirst({
    where: {
      bookingId,
      paymentType,
    },
  });
  return !!payment;
}

/**
 * Calculate total booking amount from selected services
 */
function calculateTotalBookingAmount(selectedServices) {
  return selectedServices.reduce((total, service) => {
    return total + Number(service.totalPrice);
  }, 0);
}

/**
 * Auto-cancel a booking due to overdue payment
 * Creates a Cancellation record and updates booking status
 */
async function autoCancelBooking(booking, reason) {
  try {
    await prisma.$transaction(async (tx) => {
      // Create cancellation record
      await tx.cancellation.create({
        data: {
          id: prefixedUlid('cncl'),
          bookingId: booking.id,
          cancelledBy: booking.coupleId, // Auto-cancel is always by couple (system)
          cancellationReason: reason,
          cancellationFee: null, // No fee for auto-cancellation due to non-payment
          cancellationFeePaymentId: null,
        },
      });

      // Update booking status
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: 'cancelled_by_couple',
        },
      });

      // Update linked design items (clear booking references)
      await tx.placedElement.updateMany({
        where: { bookingId: booking.id },
        data: {
          bookingId: null,
          isBooked: false,
        },
      });

      await tx.projectService.updateMany({
        where: { bookingId: booking.id },
        data: {
          bookingId: null,
          isBooked: false,
        },
      });
    });

    // Send notification
    await notificationService.sendAutoCancellationNotification(booking, reason);

    console.log(`✅ Auto-cancelled booking ${booking.id}: ${reason}`);
    return true;
  } catch (error) {
    console.error(`❌ Error auto-cancelling booking ${booking.id}:`, error);
    return false;
  }
}

/**
 * Check and auto-cancel bookings with overdue deposit payments
 */
async function checkOverdueDepositPayments() {
  const now = new Date();
  
  // Find bookings that:
  // 1. Are in pending_deposit_payment status
  // 2. Have a depositDueDate that has passed
  // 3. Don't have a deposit payment yet
  const overdueBookings = await prisma.booking.findMany({
    where: {
      status: 'pending_deposit_payment',
      depositDueDate: {
        lte: now, // Due date has passed
      },
    },
    include: {
      payments: true,
      selectedServices: true,
    },
  });

  let cancelledCount = 0;

  for (const booking of overdueBookings) {
    // Check if deposit payment exists
    const hasDeposit = await hasPayment(booking.id, 'deposit');
    
    if (!hasDeposit) {
      const reason = `Deposit payment overdue (due date: ${booking.depositDueDate?.toISOString()})`;
      const cancelled = await autoCancelBooking(booking, reason);
      if (cancelled) {
        cancelledCount++;
      }
    }
  }

  if (cancelledCount > 0) {
    console.log(`📊 Auto-cancelled ${cancelledCount} booking(s) due to overdue deposit payments`);
  }

  return cancelledCount;
}

/**
 * Check and auto-cancel bookings with overdue final payments
 */
async function checkOverdueFinalPayments() {
  const now = new Date();
  
  // Find bookings that:
  // 1. Are in pending_final_payment status
  // 2. Have a finalDueDate that has passed
  // 3. Don't have a final payment yet
  const overdueBookings = await prisma.booking.findMany({
    where: {
      status: 'pending_final_payment',
      finalDueDate: {
        lte: now, // Due date has passed
      },
    },
    include: {
      payments: true,
      selectedServices: true,
    },
  });

  let cancelledCount = 0;

  for (const booking of overdueBookings) {
    // Check if final payment exists
    const hasFinal = await hasPayment(booking.id, 'final');
    
    if (!hasFinal) {
      const reason = `Final payment overdue (due date: ${booking.finalDueDate?.toISOString()})`;
      const cancelled = await autoCancelBooking(booking, reason);
      if (cancelled) {
        cancelledCount++;
      }
    }
  }

  if (cancelledCount > 0) {
    console.log(`📊 Auto-cancelled ${cancelledCount} booking(s) due to overdue final payments`);
  }

  return cancelledCount;
}

/**
 * Transition confirmed bookings to pending_final_payment status
 * when they enter 2 weeks before the wedding date
 * This gives couples 1 week to make payment before the final due date (1 week before wedding)
 */
async function transitionToPendingFinalPayment() {
  const now = new Date();
  const twoWeeksFromNow = new Date(now);
  twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);

  // Find bookings that:
  // 1. Are in confirmed status
  // 2. Have a reservedDate that is 2 weeks or less away
  //    (This gives couples 1 week to pay before the final due date, which is 1 week before wedding)
  // 3. Don't already have a final payment
  const bookingsToTransition = await prisma.booking.findMany({
    where: {
      status: 'confirmed',
      reservedDate: {
        lte: twoWeeksFromNow, // 2 weeks or less before wedding
        gte: now, // But not in the past
      },
    },
    include: {
      payments: true,
    },
  });

  let transitionedCount = 0;

  for (const booking of bookingsToTransition) {
    // Check if final payment already exists
    const hasFinal = await hasPayment(booking.id, 'final');
    
    if (!hasFinal) {
      // Calculate final due date (1 week before reserved date, or use existing finalDueDate if set)
      const finalDueDate = booking.finalDueDate || (() => {
        const dueDate = new Date(booking.reservedDate);
        dueDate.setDate(dueDate.getDate() - 7);
        return dueDate;
      })();

      // Don't transition if final due date has already passed
      if (finalDueDate < now) {
        console.log(`⚠️  Skipping booking ${booking.id} - final due date has already passed (${finalDueDate.toISOString()})`);
        continue;
      }

      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: 'pending_final_payment',
          finalDueDate: finalDueDate,
        },
      });

      console.log(`✅ Transitioned booking ${booking.id} to pending_final_payment (wedding date: ${booking.reservedDate.toISOString()}, final due date: ${finalDueDate.toISOString()})`);
      transitionedCount++;
    }
  }

  if (transitionedCount > 0) {
    console.log(`📊 Transitioned ${transitionedCount} booking(s) to pending_final_payment status`);
  }

  return transitionedCount;
}

/**
 * Check and send deposit due date reminders (3 days before due date)
 */
async function checkDepositDueDateReminders() {
  const now = new Date();
  const threeDaysFromNow = new Date(now);
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

  const bookings = await prisma.booking.findMany({
    where: {
      status: 'pending_deposit_payment',
      depositDueDate: {
        gte: now,
        lte: threeDaysFromNow,
      },
    },
    include: {
      selectedServices: true,
      payments: true,
      vendor: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  let reminderCount = 0;
  for (const booking of bookings) {
    // Check if deposit payment already exists
    const hasDeposit = await hasPayment(booking.id, 'deposit');
    if (!hasDeposit) {
      await notificationService.sendDepositDueDateReminder(booking);
      reminderCount++;
    }
  }

  if (reminderCount > 0) {
    console.log(`📧 Sent ${reminderCount} deposit due date reminder(s)`);
  }

  return reminderCount;
}

/**
 * Check and send final payment due date reminders (3 days before due date)
 */
async function checkFinalPaymentDueDateReminders() {
  const now = new Date();
  const threeDaysFromNow = new Date(now);
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

  const bookings = await prisma.booking.findMany({
    where: {
      status: 'pending_final_payment',
      finalDueDate: {
        gte: now,
        lte: threeDaysFromNow,
      },
    },
    include: {
      selectedServices: true,
      payments: true,
      vendor: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  let reminderCount = 0;
  for (const booking of bookings) {
    // Check if final payment already exists
    const hasFinal = await hasPayment(booking.id, 'final');
    if (!hasFinal) {
      await notificationService.sendFinalPaymentDueDateReminder(booking);
      reminderCount++;
    }
  }

  if (reminderCount > 0) {
    console.log(`📧 Sent ${reminderCount} final payment due date reminder(s)`);
  }

  return reminderCount;
}

/**
 * Check and auto-cancel dependent bookings when venue is cancelled and no replacement by wedding date
 * Grace period: dependent bookings are auto-cancelled on the wedding date if no replacement venue exists
 */
async function checkVenueCancellationDependentBookings() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Find cancelled venue bookings
  // Check based on service listing category, not vendor category
  const cancelledVenueBookings = await prisma.booking.findMany({
    where: {
      status: {
        in: ['cancelled_by_couple', 'cancelled_by_vendor'],
      },
      selectedServices: {
        some: {
          serviceListing: {
        category: 'Venue',
          },
        },
      },
      cancellation: {
        isNot: null,
      },
    },
    include: {
      cancellation: true,
      project: {
        select: {
          id: true,
          weddingDate: true,
        },
      },
    },
  });

  let autoCancelledCount = 0;

  for (const cancelledVenue of cancelledVenueBookings) {
    const weddingDate = cancelledVenue.project?.weddingDate 
      ? new Date(cancelledVenue.project.weddingDate)
      : new Date(cancelledVenue.reservedDate);

    // Check if there's a replacement venue booking for the same project and date
    // Check based on service listing category, not vendor category
    const replacementVenue = await prisma.booking.findFirst({
      where: {
        projectId: cancelledVenue.projectId,
        reservedDate: cancelledVenue.reservedDate,
        status: {
          in: ['pending_deposit_payment', 'confirmed', 'pending_final_payment', 'completed'],
        },
        selectedServices: {
          some: {
            serviceListing: {
          category: 'Venue',
            },
          },
        },
        id: {
          not: cancelledVenue.id, // Exclude the cancelled venue
        },
      },
    });

    // If replacement venue exists, skip auto-cancellation
    if (replacementVenue) {
      console.log(`✅ Replacement venue found for cancelled venue ${cancelledVenue.id}, skipping auto-cancel`);
      continue;
    }

    // Find all dependent bookings that are still active and waiting for venue replacement
    const dependentBookings = await prisma.booking.findMany({
      where: {
        dependsOnVenueBookingId: cancelledVenue.id,
        isPendingVenueReplacement: true,
        status: {
          notIn: ['cancelled_by_couple', 'cancelled_by_vendor', 'rejected', 'completed'],
        },
      },
      include: {
        selectedServices: true,
        payments: true,
        vendor: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        couple: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    // Auto-cancel each dependent booking if grace period has expired
    for (const dependentBooking of dependentBookings) {
      // Check if grace period has expired
      if (dependentBooking.gracePeriodEndDate) {
        const gracePeriodEnd = new Date(dependentBooking.gracePeriodEndDate);
        const gracePeriodEndOnly = new Date(gracePeriodEnd.getFullYear(), gracePeriodEnd.getMonth(), gracePeriodEnd.getDate());
        
        // Only auto-cancel if grace period has passed
        if (gracePeriodEndOnly > today) {
          continue; // Grace period still active
        }
      } else {
        // Fallback: use wedding date if gracePeriodEndDate is not set (for old bookings)
        const weddingDateOnly = new Date(weddingDate.getFullYear(), weddingDate.getMonth(), weddingDate.getDate());
        if (weddingDateOnly > today) {
          continue; // Grace period still active
        }
      }

      const totalPaid = dependentBooking.payments.reduce((sum, p) => sum + Number(p.amount), 0);
      const gracePeriodEndStr = dependentBooking.gracePeriodEndDate 
        ? new Date(dependentBooking.gracePeriodEndDate).toLocaleDateString()
        : new Date(weddingDate).toLocaleDateString();
      const cancellationReason = `Auto-cancelled: No replacement venue selected by grace period end date (${gracePeriodEndStr}). Original venue booking was cancelled: ${cancelledVenue.cancellation?.cancellationReason || 'Venue unavailable'}`;

      await prisma.$transaction(async (tx) => {
        // Create cancellation record with refund flag
        // Since cancellation is not by couple (venue issue), refund is required
        await tx.cancellation.create({
          data: {
            id: prefixedUlid('cncl'),
            bookingId: dependentBooking.id,
            cancelledBy: dependentBooking.coupleId, // System auto-cancel, but record as couple
            cancellationReason,
            cancellationFee: null, // No cancellation fee for auto-cancel due to venue issue
            cancellationFeePaymentId: null,
            refundRequired: totalPaid > 0, // Refund required if any payment was made
            refundAmount: totalPaid > 0 ? totalPaid : null,
            refundStatus: totalPaid > 0 ? 'pending' : 'not_applicable',
            refundMethod: null,
            refundNotes: null,
          },
        });

        // Update booking status
        await tx.booking.update({
          where: { id: dependentBooking.id },
          data: {
            status: 'cancelled_by_vendor', // Auto-cancel by system, but mark as vendor cancellation for refund logic
          },
        });

        // Clear linked design items
        await tx.placedElement.updateMany({
          where: { bookingId: dependentBooking.id },
          data: {
            bookingId: null,
            isBooked: false,
          },
        });

        await tx.projectService.updateMany({
          where: { bookingId: dependentBooking.id },
          data: {
            bookingId: null,
            isBooked: false,
          },
        });
      });

      // Send notification
      await notificationService.sendAutoCancellationNotification(
        dependentBooking,
        cancellationReason
      ).catch((err) => {
        console.error(`Error sending auto-cancellation notification for booking ${dependentBooking.id}:`, err);
      });

      console.log(`✅ Auto-cancelled dependent booking ${dependentBooking.id} (venue ${cancelledVenue.id} cancelled, no replacement by wedding date)`);
      autoCancelledCount++;
    }
  }

  if (autoCancelledCount > 0) {
    console.log(`📊 Auto-cancelled ${autoCancelledCount} dependent booking(s) due to venue cancellation (grace period expired)`);
  }

  return autoCancelledCount;
}

/**
 * Run all auto-cancellation checks
 */
async function runAutoCancellationChecks() {
  console.log('\n🔄 Running auto-cancellation checks...');
  
  try {
    // 1. Transition confirmed bookings to pending_final_payment (2 weeks before wedding, giving 1 week before due date)
    await transitionToPendingFinalPayment();
    
    // 2. Check overdue deposit payments
    await checkOverdueDepositPayments();
    
    // 3. Check overdue final payments
    await checkOverdueFinalPayments();
    
    // 4. Check venue cancellation dependent bookings (grace period auto-cancel)
    await checkVenueCancellationDependentBookings();
    
    console.log('✅ Auto-cancellation checks completed\n');
  } catch (error) {
    console.error('❌ Error running auto-cancellation checks:', error);
    throw error;
  }
}

/**
 * Run payment reminder checks
 */
async function runPaymentReminderChecks() {
  console.log('\n📧 Running payment reminder checks...');
  
  try {
    await checkDepositDueDateReminders();
    await checkFinalPaymentDueDateReminders();
    console.log('✅ Payment reminder checks completed\n');
  } catch (error) {
    console.error('❌ Error running payment reminder checks:', error);
    throw error;
  }
}

module.exports = {
  checkOverdueDepositPayments,
  checkOverdueFinalPayments,
  transitionToPendingFinalPayment,
  checkVenueCancellationDependentBookings,
  runAutoCancellationChecks,
  checkDepositDueDateReminders,
  checkFinalPaymentDueDateReminders,
  runPaymentReminderChecks,
};

