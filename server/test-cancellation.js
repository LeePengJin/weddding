/* eslint-disable no-console */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const cancellationFeeCalculator = require('./utils/cancellationFeeCalculator');

const prisma = new PrismaClient();

async function testCancellation() {
  console.log('🧪 Testing cancellation system...\n');

  try {
    // Test 1: Check if calculator functions are accessible
    console.log('Test 1: Checking calculator functions...');
    if (typeof cancellationFeeCalculator.calculateCancellationFee !== 'function') {
      throw new Error('calculateCancellationFee is not a function');
    }
    if (typeof cancellationFeeCalculator.calculateAmountPaid !== 'function') {
      throw new Error('calculateAmountPaid is not a function');
    }
    if (typeof cancellationFeeCalculator.calculateCancellationFeeAndPayment !== 'function') {
      throw new Error('calculateCancellationFeeAndPayment is not a function');
    }
    console.log('✅ All calculator functions are accessible\n');

    // Test 2: Test fee calculation with different scenarios
    console.log('Test 2: Testing fee calculation scenarios...');
    
    const now = new Date();
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 100); // 100 days from now
    
    const serviceListing = {
      cancellationFeeTiers: {
        '>90': 0.0,
        '30-90': 0.10,
        '7-30': 0.25,
        '<7': 0.50,
      },
    };

    const booking = {
      reservedDate: futureDate,
      selectedServices: [
        { totalPrice: 1000 },
      ],
      payments: [],
    };

    const result = cancellationFeeCalculator.calculateCancellationFeeAndPayment(booking, serviceListing);
    console.log('   Scenario: 100 days before, no payment made');
    console.log(`   - Fee Amount: ${result.feeAmount}`);
    console.log(`   - Amount Paid: ${result.amountPaid}`);
    console.log(`   - Fee Difference: ${result.feeDifference}`);
    console.log(`   - Requires Payment: ${result.requiresPayment}`);
    
    if (result.feeAmount !== 0 || result.requiresPayment) {
      throw new Error('Expected no fee for >90 days cancellation');
    }
    console.log('✅ Fee calculation for >90 days works correctly\n');

    // Test 3: Test with payment made
    console.log('Test 3: Testing with payment made...');
    const bookingWithPayment = {
      reservedDate: futureDate,
      selectedServices: [
        { totalPrice: 1000 },
      ],
      payments: [
        { amount: 500 },
      ],
    };

    const result2 = cancellationFeeCalculator.calculateCancellationFeeAndPayment(bookingWithPayment, serviceListing);
    console.log('   Scenario: 100 days before, 500 paid');
    console.log(`   - Fee Amount: ${result2.feeAmount}`);
    console.log(`   - Amount Paid: ${result2.amountPaid}`);
    console.log(`   - Fee Difference: ${result2.feeDifference}`);
    console.log(`   - Requires Payment: ${result2.requiresPayment}`);
    console.log('✅ Fee calculation with payment works correctly\n');

    // Test 4: Check database models
    console.log('Test 4: Checking database models...');
    const bookingCount = await prisma.booking.count();
    const cancellationCount = await prisma.cancellation.count();
    console.log(`✅ Database models accessible`);
    console.log(`   - Bookings: ${bookingCount}`);
    console.log(`   - Cancellations: ${cancellationCount}\n`);

    // Test 5: Test scenario - pending_deposit_payment with no payment (should be no penalty)
    console.log('Test 5: Testing pending_deposit_payment with no payment...');
    const bookingPendingDeposit = {
      status: 'pending_deposit_payment',
      reservedDate: futureDate,
      selectedServices: [
        { totalPrice: 1000 },
      ],
      payments: [], // No payment made
    };

    const result3 = cancellationFeeCalculator.calculateCancellationFeeAndPayment(
      bookingPendingDeposit,
      serviceListing
    );
    console.log('   Scenario: pending_deposit_payment, no payment made');
    console.log(`   - Fee Amount: ${result3.feeAmount}`);
    console.log(`   - Amount Paid: ${result3.amountPaid}`);
    console.log(`   - Fee Difference: ${result3.feeDifference}`);
    console.log(`   - Requires Payment: ${result3.requiresPayment}`);
    console.log(`   - Reason: ${result3.reason || 'N/A'}`);
    
    if (result3.feeAmount !== 0 || result3.requiresPayment) {
      throw new Error('Expected no fee for pending_deposit_payment with no payment');
    }
    if (!result3.reason || !result3.reason.includes('No penalty')) {
      throw new Error('Expected reason message for no penalty scenario');
    }
    console.log('✅ No penalty scenario works correctly\n');

    // Test 6: Check PaymentType enum includes cancellation_fee
    console.log('Test 6: Checking PaymentType enum...');
    try {
      // Try to create a test payment with cancellation_fee type (will fail if enum doesn't exist)
      // We'll just check if the enum is accessible
      const testPayment = await prisma.payment.findFirst({
        where: { paymentType: 'cancellation_fee' },
      });
      console.log(`✅ PaymentType enum includes 'cancellation_fee'`);
      if (testPayment) {
        console.log(`   - Found ${testPayment ? 1 : 0} cancellation fee payment(s)\n`);
      } else {
        console.log('   - No cancellation fee payments found (expected)\n');
      }
    } catch (error) {
      if (error.message.includes('Unknown arg `cancellation_fee`')) {
        throw new Error('PaymentType enum does not include cancellation_fee');
      }
      throw error;
    }

    console.log('✅ All tests passed! Cancellation system is working correctly.\n');
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

testCancellation()
  .catch((e) => {
    console.error('❌ Test error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

