/* eslint-disable no-console */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { calculateCancellationFeeAndPayment } = require('./utils/cancellationFeeCalculator');

const prisma = new PrismaClient();

async function testCancellationSystem() {
  console.log('🧪 Testing complete cancellation system...\n');

  try {
    // Test 1: Check database models and enums
    console.log('Test 1: Checking database models and enums...');
    
    // Check BookingStatus enum
    const testBooking = await prisma.booking.findFirst();
    if (testBooking) {
      const cancelledByCouple = await prisma.booking.findMany({
        where: { status: 'cancelled_by_couple' },
      });
      const cancelledByVendor = await prisma.booking.findMany({
        where: { status: 'cancelled_by_vendor' },
      });
      console.log(`✅ BookingStatus enum includes new cancellation statuses`);
      console.log(`   - cancelled_by_couple: ${cancelledByCouple.length} booking(s)`);
      console.log(`   - cancelled_by_vendor: ${cancelledByVendor.length} booking(s)\n`);
    } else {
      console.log('⚠️  No bookings found to test status enum\n');
    }

    // Check PaymentType enum
    try {
      const cancellationFeePayments = await prisma.payment.findMany({
        where: { paymentType: 'cancellation_fee' },
      });
      console.log(`✅ PaymentType enum includes 'cancellation_fee'`);
      console.log(`   - Found ${cancellationFeePayments.length} cancellation fee payment(s)\n`);
    } catch (error) {
      if (error.message.includes('Unknown arg')) {
        throw new Error('PaymentType enum does not include cancellation_fee');
      }
      throw error;
    }

    // Check Cancellation model
    const cancellationCount = await prisma.cancellation.count();
    console.log(`✅ Cancellation model accessible`);
    console.log(`   - Found ${cancellationCount} cancellation record(s)\n`);

    // Test 2: Test cancellation fee calculator scenarios
    console.log('Test 2: Testing cancellation fee calculator...');
    
    const now = new Date();
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 100); // 100 days from now
    
    const serviceListing = {
      cancellationPolicy: 'Standard cancellation policy applies',
      cancellationFeeTiers: {
        '>90': 0.0,
        '30-90': 0.10,
        '7-30': 0.25,
        '<7': 0.50,
      },
    };

    // Scenario 1: pending_deposit_payment with no payment (should be no penalty)
    const booking1 = {
      status: 'pending_deposit_payment',
      reservedDate: futureDate,
      selectedServices: [
        { totalPrice: 1000 },
      ],
      payments: [],
    };

    const result1 = calculateCancellationFeeAndPayment(booking1, serviceListing);
    console.log('   Scenario 1: pending_deposit_payment, no payment made');
    console.log(`   - Fee Amount: ${result1.feeAmount}`);
    console.log(`   - Requires Payment: ${result1.requiresPayment}`);
    console.log(`   - Reason: ${result1.reason || 'N/A'}`);
    
    if (result1.feeAmount !== 0 || result1.requiresPayment) {
      throw new Error('Expected no fee for pending_deposit_payment with no payment');
    }
    console.log('   ✅ No penalty scenario works correctly\n');

    // Scenario 2: confirmed booking, 100 days before, no payment
    const booking2 = {
      status: 'confirmed',
      reservedDate: futureDate,
      selectedServices: [
        { totalPrice: 1000 },
      ],
      payments: [],
    };

    const result2 = calculateCancellationFeeAndPayment(booking2, serviceListing);
    console.log('   Scenario 2: confirmed, 100 days before, no payment');
    console.log(`   - Fee Amount: ${result2.feeAmount}`);
    console.log(`   - Fee Percentage: ${(result2.feePercentage * 100).toFixed(0)}%`);
    console.log(`   - Requires Payment: ${result2.requiresPayment}`);
    
    if (result2.feeAmount !== 0 || result2.feePercentage !== 0) {
      throw new Error('Expected no fee for >90 days cancellation');
    }
    console.log('   ✅ >90 days cancellation works correctly\n');

    // Scenario 3: confirmed booking, 50 days before, 500 paid
    const booking3 = {
      status: 'confirmed',
      reservedDate: new Date(now.getTime() + 50 * 24 * 60 * 60 * 1000),
      selectedServices: [
        { totalPrice: 1000 },
      ],
      payments: [
        { amount: 500 },
      ],
    };

    const result3 = calculateCancellationFeeAndPayment(booking3, serviceListing);
    console.log('   Scenario 3: confirmed, 50 days before, 500 paid');
    console.log(`   - Fee Amount: ${result3.feeAmount} (10% of 1000)`);
    console.log(`   - Amount Paid: ${result3.amountPaid}`);
    console.log(`   - Fee Difference: ${result3.feeDifference}`);
    console.log(`   - Requires Payment: ${result3.requiresPayment}`);
    
    if (result3.feeAmount !== 100) {
      throw new Error(`Expected fee of 100 (10% of 1000), got ${result3.feeAmount}`);
    }
    if (result3.feeDifference !== 0) {
      throw new Error(`Expected no additional payment (fee covered by paid amount), got ${result3.feeDifference}`);
    }
    console.log('   ✅ Fee calculation with payment works correctly\n');

    // Scenario 4: confirmed booking, 10 days before, 200 paid (fee > paid)
    const booking4 = {
      status: 'confirmed',
      reservedDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
      selectedServices: [
        { totalPrice: 1000 },
      ],
      payments: [
        { amount: 200 },
      ],
    };

    const result4 = calculateCancellationFeeAndPayment(booking4, serviceListing);
    console.log('   Scenario 4: confirmed, 10 days before, 200 paid');
    console.log(`   - Fee Amount: ${result4.feeAmount} (25% of 1000)`);
    console.log(`   - Amount Paid: ${result4.amountPaid}`);
    console.log(`   - Fee Difference: ${result4.feeDifference}`);
    console.log(`   - Requires Payment: ${result4.requiresPayment}`);
    
    if (result4.feeAmount !== 250) {
      throw new Error(`Expected fee of 250 (25% of 1000), got ${result4.feeAmount}`);
    }
    if (result4.feeDifference !== 50 || !result4.requiresPayment) {
      throw new Error(`Expected payment of 50 required, got ${result4.feeDifference}`);
    }
    console.log('   ✅ Fee calculation requiring payment works correctly\n');

    // Test 3: Check ServiceListing has cancellation fields
    console.log('Test 3: Checking ServiceListing cancellation fields...');
    const serviceListingCount = await prisma.serviceListing.count({
      where: {
        OR: [
          { cancellationPolicy: { not: null } },
          { cancellationFeeTiers: { not: null } },
        ],
      },
    });
    console.log(`✅ ServiceListing model supports cancellation fields`);
    console.log(`   - Found ${serviceListingCount} service listing(s) with cancellation policy/tiers\n`);

    // Test 4: Verify auto-cancellation service
    console.log('Test 4: Checking auto-cancellation service...');
    const autoCancellationService = require('./services/autoCancellationService');
    if (typeof autoCancellationService.runAutoCancellationChecks !== 'function') {
      throw new Error('Auto-cancellation service not accessible');
    }
    console.log('✅ Auto-cancellation service is accessible\n');

    console.log('✅ All tests passed! Cancellation system is working correctly.\n');
    console.log('📋 Summary:');
    console.log('   - Database models and enums: ✅');
    console.log('   - Cancellation fee calculator: ✅');
    console.log('   - No penalty scenario (pending_deposit_payment): ✅');
    console.log('   - Fee calculation (>90 days): ✅');
    console.log('   - Fee calculation with payment: ✅');
    console.log('   - Fee calculation requiring payment: ✅');
    console.log('   - ServiceListing cancellation fields: ✅');
    console.log('   - Auto-cancellation service: ✅\n');
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

testCancellationSystem()
  .catch((e) => {
    console.error('❌ Test error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

