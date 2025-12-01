/* eslint-disable no-console */

/**
 * Calculate cancellation fee based on:
 * - Days until reserved date
 * - Cancellation fee tiers from service listing
 * - Total booking amount
 * 
 * @param {Object} serviceListing - Service listing with cancellationFeeTiers
 * @param {Date} reservedDate - Wedding/reserved date
 * @param {number} totalBookingAmount - Total amount of the booking
 * @returns {Object} { feePercentage, feeAmount, daysUntilWedding }
 */
function calculateCancellationFee(serviceListing, reservedDate, totalBookingAmount) {
  const now = new Date();
  const weddingDate = new Date(reservedDate);
  
  // Calculate days until wedding
  const timeDiff = weddingDate.getTime() - now.getTime();
  const daysUntilWedding = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

  // Default fee tiers if not set
  const defaultTiers = {
    '>90': 0.0,      // No fee if cancelled >90 days before
    '30-90': 0.10,  // 10% fee if cancelled 30-90 days before
    '7-30': 0.25,   // 25% fee if cancelled 7-30 days before
    '<7': 0.50,     // 50% fee if cancelled <7 days before
  };

  // Get fee tiers from service listing or use defaults
  let feeTiers = defaultTiers;
  if (serviceListing.cancellationFeeTiers) {
    try {
      feeTiers = typeof serviceListing.cancellationFeeTiers === 'string'
        ? JSON.parse(serviceListing.cancellationFeeTiers)
        : serviceListing.cancellationFeeTiers;
    } catch (error) {
      console.warn('Error parsing cancellationFeeTiers, using defaults:', error);
      feeTiers = defaultTiers;
    }
  }

  // Determine fee percentage based on days until wedding
  let feePercentage = 0;
  
  if (daysUntilWedding > 90) {
    feePercentage = feeTiers['>90'] || 0;
  } else if (daysUntilWedding >= 30) {
    feePercentage = feeTiers['30-90'] || 0.10;
  } else if (daysUntilWedding >= 7) {
    feePercentage = feeTiers['7-30'] || 0.25;
  } else if (daysUntilWedding >= 0) {
    feePercentage = feeTiers['<7'] || 0.50;
  } else {
    // Wedding date has passed - no fee (shouldn't happen, but handle gracefully)
    feePercentage = 0;
  }

  // Calculate fee amount
  const feeAmount = totalBookingAmount * feePercentage;

  return {
    feePercentage,
    feeAmount: Math.round(feeAmount * 100) / 100, // Round to 2 decimal places
    daysUntilWedding,
    tier: daysUntilWedding > 90 ? '>90' : 
          daysUntilWedding >= 30 ? '30-90' : 
          daysUntilWedding >= 7 ? '7-30' : 
          daysUntilWedding >= 0 ? '<7' : 'past',
  };
}

/**
 * Calculate the amount already paid for a booking
 * @param {Array} payments - Array of payment records
 * @returns {number} Total amount paid
 */
function calculateAmountPaid(payments) {
  if (!payments || payments.length === 0) {
    return 0;
  }
  
  return payments.reduce((total, payment) => {
    return total + Number(payment.amount);
  }, 0);
}

/**
 * Calculate cancellation fee and payment requirement
 * Uses Option B: Fee is deducted from amount already paid
 * 
 * Special case: If booking is in pending_deposit_payment status and no deposit has been paid,
 * then cancellation fee is 0 (no penalty for cancelling before making any payment).
 * 
 * @param {Object} booking - Booking with selectedServices, payments, and status
 * @param {Object} serviceListing - Service listing with cancellationFeeTiers
 * @returns {Object} { feeAmount, amountPaid, feeDifference, requiresPayment }
 */
function calculateCancellationFeeAndPayment(booking, serviceListing) {
  // Calculate amount already paid
  const amountPaid = calculateAmountPaid(booking.payments);

  // Special case: If booking is pending_deposit_payment and no deposit has been paid,
  // there should be no cancellation fee (no penalty)
  if (booking.status === 'pending_deposit_payment' && amountPaid === 0) {
    return {
      feeAmount: 0,
      feePercentage: 0,
      amountPaid: 0,
      feeDifference: 0,
      requiresPayment: false,
      daysUntilWedding: null,
      tier: 'no_payment',
      totalBookingAmount: booking.selectedServices.reduce((total, service) => {
        return total + Number(service.totalPrice);
      }, 0),
      reason: 'No penalty: Booking cancelled before any payment was made',
    };
  }

  // Calculate total booking amount
  const totalBookingAmount = booking.selectedServices.reduce((total, service) => {
    return total + Number(service.totalPrice);
  }, 0);

  // Calculate cancellation fee
  const { feeAmount, feePercentage, daysUntilWedding, tier } = calculateCancellationFee(
    serviceListing,
    booking.reservedDate,
    totalBookingAmount
  );

  // Calculate fee difference (Option B: fee deducted from paid amount)
  // If fee > amountPaid, couple needs to pay the difference
  // If fee <= amountPaid, no additional payment needed
  const feeDifference = feeAmount - amountPaid;
  const requiresPayment = feeDifference > 0;

  return {
    feeAmount,
    feePercentage,
    amountPaid,
    feeDifference: Math.max(0, feeDifference), // Don't return negative
    requiresPayment,
    daysUntilWedding,
    tier,
    totalBookingAmount,
  };
}

module.exports = {
  calculateCancellationFee,
  calculateAmountPaid,
  calculateCancellationFeeAndPayment,
};

