require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { prefixedUlid } = require('../utils/id');

const prisma = new PrismaClient();

// Helper to get random date within range
function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// Helper to get random element from array
function randomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

async function generateReportData() {
  console.log('🚀 Starting report data generation...\n');

  try {
    // Get existing vendors and couples
    const vendors = await prisma.user.findMany({
      where: { role: 'vendor', status: 'active' },
      include: { vendor: true },
    });

    const couples = await prisma.user.findMany({
      where: { role: 'couple', status: 'active' },
      include: { couple: true },
    });

    if (vendors.length === 0) {
      console.log('❌ No active vendors found. Please run seed script first.');
      return;
    }

    if (couples.length === 0) {
      console.log('❌ No active couples found. Please run seed script first.');
      return;
    }

    console.log(`✅ Found ${vendors.length} vendors and ${couples.length} couples\n`);

    // Find venue vendor specifically
    const venueVendor = vendors.find(v => v.email === 'venue@example.com');
    if (!venueVendor) {
      console.log('❌ Venue vendor (venue@example.com) not found. Please check seed data.');
      return;
    }

    // Get service listings for each vendor
    const serviceListingsByVendor = {};
    for (const vendor of vendors) {
      const listings = await prisma.serviceListing.findMany({
        where: { vendorId: vendor.id, isActive: true },
      });
      serviceListingsByVendor[vendor.id] = listings;
      console.log(`  Vendor ${vendor.name}: ${listings.length} service listings`);
    }

    const venueServiceListings = serviceListingsByVendor[venueVendor.id];
    if (!venueServiceListings || venueServiceListings.length === 0) {
      console.log('❌ Venue vendor has no service listings. Please check seed data.');
      return;
    }

    // Date ranges for generating data
    const now = new Date();
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const oneYearFromNow = new Date(now);
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

    const bookingStatuses = [
      'pending_vendor_confirmation',
      'pending_deposit_payment',
      'confirmed',
      'pending_final_payment',
      'completed',
      'rejected',
      'cancelled_by_couple',
      'cancelled_by_vendor',
    ];

    const paymentMethods = ['credit_card', 'bank_transfer', 'touch_n_go'];

    // Generate more bookings, with 70% for venue vendor
    const venueBookingsToCreate = 40; // 40 bookings for venue vendor
    const otherBookingsToCreate = 15; // 15 bookings for other vendors
    const createdBookings = [];

    console.log(`\n📅 Generating ${venueBookingsToCreate + otherBookingsToCreate} bookings...`);
    console.log(`  - ${venueBookingsToCreate} for venue vendor (venue@example.com)`);
    console.log(`  - ${otherBookingsToCreate} for other vendors\n`);

    // Generate bookings for venue vendor
    for (let i = 0; i < venueBookingsToCreate; i++) {
      const couple = randomElement(couples);
      const selectedService = randomElement(venueServiceListings);
      
      // Distribute booking dates across the last 6 months
      const monthsAgo = Math.floor(Math.random() * 6);
      const bookingDate = new Date(now);
      bookingDate.setMonth(bookingDate.getMonth() - monthsAgo);
      bookingDate.setDate(bookingDate.getDate() - Math.floor(Math.random() * 30));
      
      const reservedDate = randomDate(now, oneYearFromNow);
      const status = randomElement(bookingStatuses);

      // Calculate dates based on status
      let depositDueDate = null;
      let finalDueDate = null;
      if (['pending_deposit_payment', 'confirmed', 'pending_final_payment', 'completed'].includes(status)) {
        depositDueDate = new Date(reservedDate);
        depositDueDate.setDate(depositDueDate.getDate() - 60); // 60 days before wedding
      }
      if (['confirmed', 'pending_final_payment', 'completed'].includes(status)) {
        finalDueDate = new Date(reservedDate);
        finalDueDate.setDate(finalDueDate.getDate() - 7); // 7 days before wedding
      }

      // Calculate total price
      const quantity = Math.floor(Math.random() * 5) + 1;
      const basePrice = parseFloat(selectedService.price);
      const totalPrice = basePrice * quantity;

      // Create booking
      const booking = await prisma.booking.create({
        data: {
          id: prefixedUlid('bkg'),
          coupleId: couple.id,
          vendorId: venueVendor.id,
          bookingDate,
          reservedDate,
          status,
          depositDueDate,
          finalDueDate,
          selectedServices: {
            create: {
              id: prefixedUlid('srv'),
              serviceListingId: selectedService.id,
              quantity,
              totalPrice: totalPrice,
            },
          },
        },
        include: {
          selectedServices: true,
        },
      });

      createdBookings.push(booking);

      // Create payments based on booking status
      if (['pending_deposit_payment', 'confirmed', 'pending_final_payment', 'completed'].includes(status)) {
        // Deposit payment
        const depositAmount = totalPrice * 0.3; // 30% deposit
        const depositPaymentDate = new Date(bookingDate);
        depositPaymentDate.setDate(depositPaymentDate.getDate() + Math.floor(Math.random() * 5));
        // Ensure payment date is not in the future
        if (depositPaymentDate > now) {
          depositPaymentDate.setTime(now.getTime() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000));
        }

        await prisma.payment.create({
          data: {
            id: prefixedUlid('pay'),
            bookingId: booking.id,
            paymentType: 'deposit',
            amount: depositAmount,
            paymentMethod: randomElement(paymentMethods),
            paymentDate: depositPaymentDate,
            releasedToVendor: Math.random() > 0.3, // 70% released
            releasedAt: Math.random() > 0.3 ? new Date(depositPaymentDate.getTime() + 7 * 24 * 60 * 60 * 1000) : null,
          },
        });
      }

      if (['confirmed', 'pending_final_payment', 'completed'].includes(status)) {
        // Final payment (if deposit was paid)
        const finalAmount = totalPrice * 0.7; // 70% final
        const finalPaymentDate = new Date(depositDueDate || bookingDate);
        finalPaymentDate.setDate(finalPaymentDate.getDate() + Math.floor(Math.random() * 10) + 5);
        // Ensure payment date is not in the future
        if (finalPaymentDate > now) {
          finalPaymentDate.setTime(now.getTime() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000));
        }

        await prisma.payment.create({
          data: {
            id: prefixedUlid('pay'),
            bookingId: booking.id,
            paymentType: 'final',
            amount: finalAmount,
            paymentMethod: randomElement(paymentMethods),
            paymentDate: finalPaymentDate,
            releasedToVendor: Math.random() > 0.4, // 60% released
            releasedAt: Math.random() > 0.4 ? new Date(finalPaymentDate.getTime() + 14 * 24 * 60 * 60 * 1000) : null,
          },
        });
      }

      if (['cancelled_by_couple', 'cancelled_by_vendor'].includes(status)) {
        // Cancellation fee payment (sometimes)
        if (Math.random() > 0.5) {
          const cancellationFee = totalPrice * 0.1; // 10% cancellation fee
          const cancellationPaymentDate = new Date(bookingDate);
          cancellationPaymentDate.setDate(cancellationPaymentDate.getDate() + Math.floor(Math.random() * 3));

          await prisma.payment.create({
            data: {
              id: prefixedUlid('pay'),
              bookingId: booking.id,
              paymentType: 'cancellation_fee',
              amount: cancellationFee,
              paymentMethod: randomElement(paymentMethods),
              paymentDate: cancellationPaymentDate,
              releasedToVendor: true,
              releasedAt: new Date(cancellationPaymentDate.getTime() + 7 * 24 * 60 * 60 * 1000),
            },
          });
        }
      }

      // Create reviews for venue vendor bookings (higher chance for various statuses)
      // 70% chance for completed, 40% for confirmed/pending_final_payment
      const shouldCreateReview = 
        (status === 'completed' && Math.random() > 0.3) ||
        (['confirmed', 'pending_final_payment'].includes(status) && Math.random() > 0.6);

      if (shouldCreateReview) {
        const reviewDate = new Date(reservedDate);
        reviewDate.setDate(reviewDate.getDate() + Math.floor(Math.random() * 30) + 1);
        // Ensure review date is not in the future
        if (reviewDate > now) {
          reviewDate.setTime(now.getTime() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000));
        }

        // Generate more varied ratings (favor 4-5 stars but include some 3s)
        const ratingOptions = [3, 3, 4, 4, 4, 4, 5, 5, 5, 5]; // 20% 3s, 40% 4s, 40% 5s
        const rating = randomElement(ratingOptions);
        
        const reviewComments = [
          'Excellent service and beautiful venue!',
          'Highly recommended! The staff was very professional.',
          'Great experience overall. Very satisfied!',
          'Amazing venue with stunning decor. Perfect for our wedding!',
          'Outstanding service from start to finish.',
          'Beautiful space and excellent coordination.',
          'Very happy with our choice. Would book again!',
          'Professional team and gorgeous venue.',
          'The venue exceeded our expectations!',
          'Wonderful experience, highly recommend!',
        ];

        await prisma.review.create({
          data: {
            id: prefixedUlid('rev'),
            bookingId: booking.id,
            serviceListingId: selectedService.id,
            reviewerId: couple.id,
            rating,
            reviewDate,
            comment: randomElement(reviewComments),
          },
        });
      }

      if ((i + 1) % 10 === 0) {
        console.log(`  ✅ Created ${i + 1}/${venueBookingsToCreate} venue vendor bookings`);
      }
    }

    // Generate bookings for other vendors
    const otherVendors = vendors.filter(v => v.id !== venueVendor.id);
    for (let i = 0; i < otherBookingsToCreate; i++) {
      const vendor = randomElement(otherVendors);
      const couple = randomElement(couples);
      const serviceListings = serviceListingsByVendor[vendor.id];

      if (!serviceListings || serviceListings.length === 0) {
        continue;
      }

      const selectedService = randomElement(serviceListings);
      // Distribute booking dates across the last 6 months
      const monthsAgo = Math.floor(Math.random() * 6);
      const bookingDate = new Date(now);
      bookingDate.setMonth(bookingDate.getMonth() - monthsAgo);
      bookingDate.setDate(bookingDate.getDate() - Math.floor(Math.random() * 30));
      
      const reservedDate = randomDate(now, oneYearFromNow);
      const status = randomElement(bookingStatuses);

      // Calculate dates based on status
      let depositDueDate = null;
      let finalDueDate = null;
      if (['pending_deposit_payment', 'confirmed', 'pending_final_payment', 'completed'].includes(status)) {
        depositDueDate = new Date(reservedDate);
        depositDueDate.setDate(depositDueDate.getDate() - 60);
      }
      if (['confirmed', 'pending_final_payment', 'completed'].includes(status)) {
        finalDueDate = new Date(reservedDate);
        finalDueDate.setDate(finalDueDate.getDate() - 7);
      }

      const quantity = Math.floor(Math.random() * 5) + 1;
      const basePrice = parseFloat(selectedService.price);
      const totalPrice = basePrice * quantity;

      const booking = await prisma.booking.create({
        data: {
          id: prefixedUlid('bkg'),
          coupleId: couple.id,
          vendorId: venueVendor.id,
          bookingDate,
          reservedDate,
          status,
          depositDueDate,
          finalDueDate,
          selectedServices: {
            create: {
              id: prefixedUlid('srv'),
              serviceListingId: selectedService.id,
              quantity,
              totalPrice: totalPrice,
            },
          },
        },
        include: {
          selectedServices: true,
        },
      });

      createdBookings.push(booking);

      // Create payments
      if (['pending_deposit_payment', 'confirmed', 'pending_final_payment', 'completed'].includes(status)) {
        const depositAmount = totalPrice * 0.3;
        const depositPaymentDate = new Date(bookingDate);
        depositPaymentDate.setDate(depositPaymentDate.getDate() + Math.floor(Math.random() * 5));
        if (depositPaymentDate > now) {
          depositPaymentDate.setTime(now.getTime() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000));
        }

        await prisma.payment.create({
          data: {
            id: prefixedUlid('pay'),
            bookingId: booking.id,
            paymentType: 'deposit',
            amount: depositAmount,
            paymentMethod: randomElement(paymentMethods),
            paymentDate: depositPaymentDate,
            releasedToVendor: Math.random() > 0.3,
            releasedAt: Math.random() > 0.3 ? new Date(depositPaymentDate.getTime() + 7 * 24 * 60 * 60 * 1000) : null,
          },
        });
      }

      if (['confirmed', 'pending_final_payment', 'completed'].includes(status)) {
        const finalAmount = totalPrice * 0.7;
        const finalPaymentDate = new Date(depositDueDate || bookingDate);
        finalPaymentDate.setDate(finalPaymentDate.getDate() + Math.floor(Math.random() * 10) + 5);
        if (finalPaymentDate > now) {
          finalPaymentDate.setTime(now.getTime() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000));
        }

        await prisma.payment.create({
          data: {
            id: prefixedUlid('pay'),
            bookingId: booking.id,
            paymentType: 'final',
            amount: finalAmount,
            paymentMethod: randomElement(paymentMethods),
            paymentDate: finalPaymentDate,
            releasedToVendor: Math.random() > 0.4,
            releasedAt: Math.random() > 0.4 ? new Date(finalPaymentDate.getTime() + 14 * 24 * 60 * 60 * 1000) : null,
          },
        });
      }

      // Create reviews for other vendors (50% chance for completed)
      if (status === 'completed' && Math.random() > 0.5) {
        const reviewDate = new Date(reservedDate);
        reviewDate.setDate(reviewDate.getDate() + Math.floor(Math.random() * 30) + 1);
        if (reviewDate > now) {
          reviewDate.setTime(now.getTime() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000));
        }

        const ratingOptions = [3, 4, 4, 4, 5, 5, 5];
        const rating = randomElement(ratingOptions);

        await prisma.review.create({
          data: {
            id: prefixedUlid('rev'),
            bookingId: booking.id,
            serviceListingId: selectedService.id,
            reviewerId: couple.id,
            rating,
            reviewDate,
            comment: `Great service! ${Math.random() > 0.5 ? 'Highly recommended!' : 'Very satisfied with the quality.'}`,
          },
        });
      }
    }

    console.log(`\n✅ Successfully generated ${createdBookings.length} bookings with payments and reviews!`);
    console.log('\n📊 Summary:');
    console.log(`  - Total Bookings: ${createdBookings.length}`);
    console.log(`  - Venue Vendor Bookings: ${venueBookingsToCreate}`);
    console.log(`  - Other Vendor Bookings: ${otherBookingsToCreate}`);
    
    const payments = await prisma.payment.count({
      where: {
        booking: {
          vendorId: venueVendor.id,
        },
      },
    });
    console.log(`  - Venue Vendor Payments: ${payments}`);

    const reviews = await prisma.review.count({
      where: {
        serviceListing: {
          vendorId: venueVendor.id,
        },
      },
    });
    console.log(`  - Venue Vendor Reviews: ${reviews}`);

    console.log('\n✨ Report data generation complete!');
    console.log('   You can now test the reports page with venue vendor account (venue@example.com).');

  } catch (error) {
    console.error('❌ Error generating report data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  generateReportData()
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { generateReportData };
