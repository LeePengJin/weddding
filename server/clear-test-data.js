/* eslint-disable no-console */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Clearing test data while preserving accounts, listings, and design elements...\n');

  try {
    // Delete in order to respect foreign key constraints
    
    // 1. Delete BookedTable records (new model for per-table service bookings)
    console.log('1. Deleting BookedTable records...');
    const deletedBookedTables = await prisma.bookedTable.deleteMany({});
    console.log(`   ✓ Deleted ${deletedBookedTables.count} booked table record(s)`);

    // 2. Delete Cancellations
    console.log('2. Deleting Cancellations...');
    const deletedCancellations = await prisma.cancellation.deleteMany({});
    console.log(`   ✓ Deleted ${deletedCancellations.count} cancellation(s)`);

    // 3. Delete Reviews
    console.log('3. Deleting Reviews...');
    const deletedReviews = await prisma.review.deleteMany({});
    console.log(`   ✓ Deleted ${deletedReviews.count} review(s)`);

    // 4. Delete Payments
    console.log('4. Deleting Payments...');
    const deletedPayments = await prisma.payment.deleteMany({});
    console.log(`   ✓ Deleted ${deletedPayments.count} payment(s)`);

    // 5. Delete SelectedServices
    console.log('5. Deleting SelectedServices...');
    const deletedSelectedServices = await prisma.selectedService.deleteMany({});
    console.log(`   ✓ Deleted ${deletedSelectedServices.count} selected service(s)`);

    // 6. Delete Bookings
    console.log('6. Deleting Bookings...');
    const deletedBookings = await prisma.booking.deleteMany({});
    console.log(`   ✓ Deleted ${deletedBookings.count} booking(s)`);

    // 7. Delete Subtasks (must be before Tasks)
    console.log('7. Deleting Subtasks...');
    const deletedSubtasks = await prisma.subtask.deleteMany({});
    console.log(`   ✓ Deleted ${deletedSubtasks.count} subtask(s)`);

    // 8. Delete Tasks
    console.log('8. Deleting Tasks...');
    const deletedTasks = await prisma.task.deleteMany({});
    console.log(`   ✓ Deleted ${deletedTasks.count} task(s)`);

    // 9. Delete Expenses
    console.log('9. Deleting Expenses...');
    const deletedExpenses = await prisma.expense.deleteMany({});
    console.log(`   ✓ Deleted ${deletedExpenses.count} expense(s)`);

    // 10. Delete BudgetCategories
    console.log('10. Deleting BudgetCategories...');
    const deletedBudgetCategories = await prisma.budgetCategory.deleteMany({});
    console.log(`   ✓ Deleted ${deletedBudgetCategories.count} budget categor(ies)`);

    // 11. Delete Budgets
    console.log('11. Deleting Budgets...');
    const deletedBudgets = await prisma.budget.deleteMany({});
    console.log(`   ✓ Deleted ${deletedBudgets.count} budget(s)`);

    // 12. Delete PlacedElements (3D venue design elements)
    console.log('12. Deleting PlacedElements...');
    const deletedPlacedElements = await prisma.placedElement.deleteMany({});
    console.log(`   ✓ Deleted ${deletedPlacedElements.count} placed element(s)`);

    // 13. Delete VenueDesigns
    console.log('13. Deleting VenueDesigns...');
    const deletedVenueDesigns = await prisma.venueDesign.deleteMany({});
    console.log(`   ✓ Deleted ${deletedVenueDesigns.count} venue design(s)`);

    // 14. Delete ProjectServices
    console.log('14. Deleting ProjectServices...');
    const deletedProjectServices = await prisma.projectService.deleteMany({});
    console.log(`   ✓ Deleted ${deletedProjectServices.count} project service(s)`);

    // 15. Delete WeddingProjects
    console.log('15. Deleting WeddingProjects...');
    const deletedProjects = await prisma.weddingProject.deleteMany({});
    console.log(`   ✓ Deleted ${deletedProjects.count} wedding project(s)`);

    // 16. Delete Coordinates (orphaned after deleting VenueDesigns)
    console.log('16. Deleting orphaned Coordinates...');
    const deletedCoordinates = await prisma.coordinates.deleteMany({});
    console.log(`   ✓ Deleted ${deletedCoordinates.count} coordinate(s)`);

    // 17. Delete Conversations and Messages (optional - related to bookings)
    console.log('17. Deleting Messages...');
    const deletedMessages = await prisma.message.deleteMany({});
    console.log(`   ✓ Deleted ${deletedMessages.count} message(s)`);

    console.log('18. Deleting Conversations...');
    const deletedConversations = await prisma.conversation.deleteMany({});
    console.log(`   ✓ Deleted ${deletedConversations.count} conversation(s)`);

    // 18. Delete TimeSlots (vendor availability - might be related to bookings)
    console.log('19. Deleting TimeSlots...');
    const deletedTimeSlots = await prisma.timeSlot.deleteMany({});
    console.log(`   ✓ Deleted ${deletedTimeSlots.count} time slot(s)`);

    // 19. Delete ServiceAvailability (service-specific availability - might be related to bookings)
    console.log('20. Deleting ServiceAvailability records...');
    const deletedServiceAvailability = await prisma.serviceAvailability.deleteMany({});
    console.log(`   ✓ Deleted ${deletedServiceAvailability.count} service availability record(s)`);

    // 20. Delete OtpTokens (expired tokens can be cleaned up)
    console.log('21. Deleting OtpTokens...');
    const deletedOtpTokens = await prisma.otpToken.deleteMany({});
    console.log(`   ✓ Deleted ${deletedOtpTokens.count} OTP token(s)`);

    console.log('\n✅ All test data cleared successfully!');
    console.log('\n📝 Preserved data:');
    console.log('   ✓ User accounts (Couple, Vendor, SystemAdmin)');
    console.log('   ✓ ServiceListings');
    console.log('   ✓ DesignElements');
    console.log('   ✓ WeddingPackages (templates)');
    console.log('   ✓ PackageDesigns (templates)');
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
