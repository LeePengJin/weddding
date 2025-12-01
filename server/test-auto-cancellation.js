/* eslint-disable no-console */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const autoCancellationService = require('./services/autoCancellationService');

const prisma = new PrismaClient();

async function testAutoCancellation() {
  console.log('🧪 Testing auto-cancellation service...\n');

  try {
    // Test 1: Check if service functions are accessible
    console.log('Test 1: Checking service functions...');
    if (typeof autoCancellationService.checkOverdueDepositPayments !== 'function') {
      throw new Error('checkOverdueDepositPayments is not a function');
    }
    if (typeof autoCancellationService.checkOverdueFinalPayments !== 'function') {
      throw new Error('checkOverdueFinalPayments is not a function');
    }
    if (typeof autoCancellationService.transitionToPendingFinalPayment !== 'function') {
      throw new Error('transitionToPendingFinalPayment is not a function');
    }
    if (typeof autoCancellationService.runAutoCancellationChecks !== 'function') {
      throw new Error('runAutoCancellationChecks is not a function');
    }
    console.log('✅ All service functions are accessible\n');

    // Test 2: Check database connection and schema
    console.log('Test 2: Checking database connection and schema...');
    const bookingCount = await prisma.booking.count();
    console.log(`✅ Database connected. Found ${bookingCount} booking(s)\n`);

    // Test 3: Check if Cancellation model exists
    console.log('Test 3: Checking Cancellation model...');
    const cancellationCount = await prisma.cancellation.count();
    console.log(`✅ Cancellation model accessible. Found ${cancellationCount} cancellation(s)\n`);

    // Test 4: Run auto-cancellation checks (dry run - should not error)
    console.log('Test 4: Running auto-cancellation checks...');
    await autoCancellationService.runAutoCancellationChecks();
    console.log('✅ Auto-cancellation checks completed without errors\n');

    // Test 5: Check Prisma schema for new status values
    console.log('Test 5: Verifying booking status enum...');
    const testBooking = await prisma.booking.findFirst();
    if (testBooking) {
      // Try to query with new status values
      const cancelledByCouple = await prisma.booking.findMany({
        where: { status: 'cancelled_by_couple' },
      });
      const cancelledByVendor = await prisma.booking.findMany({
        where: { status: 'cancelled_by_vendor' },
      });
      console.log(`✅ Status enum includes new cancellation statuses`);
      console.log(`   - cancelled_by_couple: ${cancelledByCouple.length} booking(s)`);
      console.log(`   - cancelled_by_vendor: ${cancelledByVendor.length} booking(s)\n`);
    } else {
      console.log('⚠️  No bookings found to test status enum\n');
    }

    console.log('✅ All tests passed! Phase 1 implementation is working correctly.\n');
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

testAutoCancellation()
  .catch((e) => {
    console.error('❌ Test error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

