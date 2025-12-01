/* eslint-disable no-console */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Clearing booking-related data...\n');

  try {
    // Delete in order to respect foreign key constraints
    console.log('1. Deleting Cancellations...');
    const deletedCancellations = await prisma.cancellation.deleteMany({});
    console.log(`   ✓ Deleted ${deletedCancellations.count} cancellation(s)`);

    console.log('2. Deleting Reviews...');
    const deletedReviews = await prisma.review.deleteMany({});
    console.log(`   ✓ Deleted ${deletedReviews.count} review(s)`);

    console.log('3. Deleting Payments...');
    const deletedPayments = await prisma.payment.deleteMany({});
    console.log(`   ✓ Deleted ${deletedPayments.count} payment(s)`);

    console.log('4. Updating PlacedElements (removing booking references)...');
    const updatedPlacedElements = await prisma.placedElement.updateMany({
      where: { bookingId: { not: null } },
      data: {
        bookingId: null,
        isBooked: false,
      },
    });
    console.log(`   ✓ Updated ${updatedPlacedElements.count} placed element(s)`);

    console.log('5. Updating ProjectServices (removing booking references)...');
    const updatedProjectServices = await prisma.projectService.updateMany({
      where: { bookingId: { not: null } },
      data: {
        bookingId: null,
        isBooked: false,
      },
    });
    console.log(`   ✓ Updated ${updatedProjectServices.count} project service(s)`);

    console.log('6. Deleting SelectedServices...');
    const deletedSelectedServices = await prisma.selectedService.deleteMany({});
    console.log(`   ✓ Deleted ${deletedSelectedServices.count} selected service(s)`);

    console.log('7. Deleting Bookings...');
    const deletedBookings = await prisma.booking.deleteMany({});
    console.log(`   ✓ Deleted ${deletedBookings.count} booking(s)`);

    console.log('\n✅ All booking-related data cleared successfully!');
    console.log('\n📝 Note: Users, vendors, service listings, and projects are preserved.');
  } catch (error) {
    console.error('❌ Error clearing data:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('❌ Script error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

