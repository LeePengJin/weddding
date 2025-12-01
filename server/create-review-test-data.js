/* eslint-disable no-console */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Creating test data for review functionality...\n');

  try {
    // Get existing users (assuming they exist from seed)
    const couple1 = await prisma.user.findUnique({
      where: { email: 'couple1@example.com' },
      include: { couple: true },
    });

    if (!couple1 || !couple1.couple) {
      console.error('❌ Couple 1 not found. Please run seed.js first.');
      process.exit(1);
    }

    const venueVendor = await prisma.user.findUnique({
      where: { email: 'venue@example.com' },
      include: { vendor: true },
    });

    const photographerVendor = await prisma.user.findUnique({
      where: { email: 'photographer@example.com' },
      include: { vendor: true },
    });

    const floristVendor = await prisma.user.findUnique({
      where: { email: 'florist@example.com' },
      include: { vendor: true },
    });

    if (!venueVendor || !venueVendor.vendor) {
      console.error('❌ Venue vendor not found. Please run seed.js first.');
      process.exit(1);
    }

    // Get or create a project for couple1
    let project = await prisma.weddingProject.findFirst({
      where: { coupleId: couple1.id },
    });

    if (!project) {
      project = await prisma.weddingProject.create({
        data: {
          coupleId: couple1.id,
          projectName: 'Test Wedding Project',
          weddingDate: new Date('2024-01-15'), // Past date
          weddingType: 'self_organized',
        },
      });
      console.log('✅ Created test project');
    }

    // Create service listings if they don't exist
    console.log('\n📋 Creating service listings...');

    const venueService = await prisma.serviceListing.upsert({
      where: { id: 'service-venue-test' },
      update: {},
      create: {
        id: 'service-venue-test',
        vendorId: venueVendor.id,
        name: 'Grand Ballroom A',
        description: 'Elegant ballroom for wedding ceremonies',
        category: 'Venue',
        price: 15000,
        pricingPolicy: 'fixed_package',
        isActive: true,
        images: [],
      },
    });
    console.log('✅ Created/Found venue service');

    let photographerService = null;
    if (photographerVendor && photographerVendor.vendor) {
      photographerService = await prisma.serviceListing.upsert({
        where: { id: 'service-photographer-test' },
        update: {},
        create: {
          id: 'service-photographer-test',
          vendorId: photographerVendor.id,
          name: 'Full Day Wedding Photography',
          description: 'Professional wedding photography package',
          category: 'Photographer',
          price: 5000,
          pricingPolicy: 'fixed_package',
          isActive: true,
          images: [],
        },
      });
      console.log('✅ Created/Found photographer service');
    }

    let floristService = null;
    if (floristVendor && floristVendor.vendor) {
      floristService = await prisma.serviceListing.upsert({
        where: { id: 'service-florist-test' },
        update: {},
        create: {
          id: 'service-florist-test',
          vendorId: floristVendor.id,
          name: 'Premium Rose Centerpieces',
          description: 'Beautiful rose centerpieces for tables',
          category: 'Florist',
          price: 150,
          pricingPolicy: 'per_table',
          isActive: true,
          images: [],
        },
      });
      console.log('✅ Created/Found florist service');
    }

    // Create completed bookings with payments
    console.log('\n📅 Creating completed bookings...');

    // Calculate dates: wedding date in the past, booking created before that
    const weddingDate = new Date('2024-01-15');
    const bookingDate = new Date('2023-12-01');
    const depositPaymentDate = new Date('2023-12-15');
    const finalPaymentDate = new Date('2024-01-20'); // After wedding date

    // Booking 1: Venue only
    const booking1 = await prisma.booking.upsert({
      where: { id: 'booking-completed-1' },
      update: {
        status: 'completed',
      },
      create: {
        id: 'booking-completed-1',
        coupleId: couple1.id,
        projectId: project.id,
        vendorId: venueVendor.id,
        bookingDate,
        reservedDate: weddingDate,
        status: 'completed',
        depositDueDate: new Date('2023-12-10'),
        finalDueDate: new Date('2024-01-18'),
        selectedServices: {
          create: {
            serviceListingId: venueService.id,
            quantity: 1,
            totalPrice: 15000,
          },
        },
        payments: {
          create: [
            {
              paymentType: 'deposit',
              amount: 7500,
              paymentMethod: 'bank_transfer',
              paymentDate: depositPaymentDate,
            },
            {
              paymentType: 'final',
              amount: 7500,
              paymentMethod: 'bank_transfer',
              paymentDate: finalPaymentDate,
            },
          ],
        },
      },
      include: {
        selectedServices: true,
        payments: true,
      },
    });
    console.log('✅ Created completed booking 1 (Venue)');

    // Booking 2: Photographer only (to test single service review)
    let booking2 = null;
    if (photographerService && photographerVendor) {
      booking2 = await prisma.booking.upsert({
        where: { id: 'booking-completed-2' },
        update: {
          status: 'completed',
        },
        create: {
          id: 'booking-completed-2',
          coupleId: couple1.id,
          projectId: project.id,
          vendorId: photographerVendor.id,
          bookingDate,
          reservedDate: weddingDate,
          status: 'completed',
          depositDueDate: new Date('2023-12-10'),
          finalDueDate: new Date('2024-01-18'),
          selectedServices: {
            create: {
              serviceListingId: photographerService.id,
              quantity: 1,
              totalPrice: 5000,
            },
          },
          payments: {
            create: [
              {
                paymentType: 'deposit',
                amount: 2500,
                paymentMethod: 'credit_card',
                paymentDate: depositPaymentDate,
              },
              {
                paymentType: 'final',
                amount: 2500,
                paymentMethod: 'credit_card',
                paymentDate: finalPaymentDate,
              },
            ],
          },
        },
        include: {
          selectedServices: true,
          payments: true,
        },
      });
      console.log('✅ Created completed booking 2 (Photographer)');
    }

    // Booking 3: Florist with multiple tables (to test multiple services scenario)
    // Note: Since one booking = one vendor, we'll create a separate booking for florist
    // But we can create a booking with multiple services if the vendor has multiple listings
    let booking3 = null;
    if (floristVendor && floristVendor.vendor) {
      // Create another florist service for the same vendor to test multiple services
      const floristService2 = await prisma.serviceListing.upsert({
        where: { id: 'service-florist-bouquet-test' },
        update: {},
        create: {
          id: 'service-florist-bouquet-test',
          vendorId: floristVendor.id,
          name: 'Bridal Bouquet',
          description: 'Elegant bridal bouquet',
          category: 'Florist',
          price: 500,
          pricingPolicy: 'fixed_package',
          isActive: true,
          images: [],
        },
      });

      booking3 = await prisma.booking.upsert({
        where: { id: 'booking-completed-3' },
        update: {
          status: 'completed',
        },
        create: {
          id: 'booking-completed-3',
          coupleId: couple1.id,
          projectId: project.id,
          vendorId: floristVendor.id,
          bookingDate,
          reservedDate: weddingDate,
          status: 'completed',
          depositDueDate: new Date('2023-12-10'),
          finalDueDate: new Date('2024-01-18'),
          selectedServices: {
            create: [
              {
                serviceListingId: floristService.id,
                quantity: 20, // 20 tables
                totalPrice: 3000, // 20 * 150
              },
              {
                serviceListingId: floristService2.id,
                quantity: 1,
                totalPrice: 500,
              },
            ],
          },
          payments: {
            create: [
              {
                paymentType: 'deposit',
                amount: 1750,
                paymentMethod: 'bank_transfer',
                paymentDate: depositPaymentDate,
              },
              {
                paymentType: 'final',
                amount: 1750,
                paymentMethod: 'bank_transfer',
                paymentDate: finalPaymentDate,
              },
            ],
          },
        },
        include: {
          selectedServices: true,
          payments: true,
        },
      });
      console.log('✅ Created completed booking 3 (Florist - Multiple Services)');
    }

    // Helper function to upsert review by booking+service+reviewer (prevents duplicates)
    const upsertReview = async (reviewData) => {
      // First, check if a review already exists for this combination
      const existing = await prisma.review.findFirst({
        where: {
          bookingId: reviewData.bookingId,
          serviceListingId: reviewData.serviceListingId,
          reviewerId: reviewData.reviewerId,
        },
      });

      if (existing) {
        // Update existing review
        return await prisma.review.update({
          where: { id: existing.id },
          data: {
            rating: reviewData.rating,
            comment: reviewData.comment,
            reviewDate: reviewData.reviewDate,
          },
        });
      } else {
        // Create new review
        return await prisma.review.create({
          data: reviewData,
        });
      }
    };

    // Create additional bookings and reviews for more test data
    console.log('\n📝 Creating additional bookings and reviews...');

    // Get couple2 for more diverse test data
    const couple2 = await prisma.user.findUnique({
      where: { email: 'couple2@example.com' },
      include: { couple: true },
    });

    if (couple2 && couple2.couple) {
      // Get or create a project for couple2
      let project2 = await prisma.weddingProject.findFirst({
        where: { coupleId: couple2.id },
      });

      if (!project2) {
        project2 = await prisma.weddingProject.create({
          data: {
            coupleId: couple2.id,
            projectName: 'Garden Wedding Project',
            weddingDate: new Date('2024-02-20'),
            weddingType: 'self_organized',
          },
        });
        console.log('✅ Created project 2 for couple2');
      }

      // Create booking 4: Venue for couple2
      const booking4 = await prisma.booking.upsert({
        where: { id: 'booking-completed-4' },
        update: {
          status: 'completed',
        },
        create: {
          id: 'booking-completed-4',
          coupleId: couple2.id,
          projectId: project2.id,
          vendorId: venueVendor.id,
          bookingDate: new Date('2023-12-15'),
          reservedDate: new Date('2024-02-20'),
          status: 'completed',
          depositDueDate: new Date('2024-01-10'),
          finalDueDate: new Date('2024-02-25'),
          selectedServices: {
            create: {
              serviceListingId: venueService.id,
              quantity: 1,
              totalPrice: 15000,
            },
          },
          payments: {
            create: [
              {
                paymentType: 'deposit',
                amount: 7500,
                paymentMethod: 'bank_transfer',
                paymentDate: new Date('2024-01-15'),
              },
              {
                paymentType: 'final',
                amount: 7500,
                paymentMethod: 'bank_transfer',
                paymentDate: new Date('2024-02-25'),
              },
            ],
          },
        },
        include: {
          selectedServices: true,
          payments: true,
        },
      });
      console.log('✅ Created completed booking 4 (Venue for couple2)');

      // Create reviews for existing bookings
      console.log('\n⭐ Creating sample reviews...');

      // Cleanup: Remove duplicate reviews for test bookings (keep only the first one for each booking+service+reviewer)
      console.log('🧹 Cleaning up duplicate reviews for test bookings...');
      const testBookingIds = [
        booking1.id,
        booking4.id,
        ...(booking2 ? [booking2.id] : []),
        ...(booking3 ? [booking3.id] : []),
      ].filter(Boolean);

      for (const bookingId of testBookingIds) {
        const reviews = await prisma.review.findMany({
          where: { bookingId },
        });

        // Group by serviceListingId + reviewerId
        const reviewGroups = {};
        reviews.forEach((review) => {
          const key = `${review.serviceListingId}_${review.reviewerId}`;
          if (!reviewGroups[key]) {
            reviewGroups[key] = [];
          }
          reviewGroups[key].push(review);
        });

        // For each group with duplicates, keep the first and delete the rest
        for (const key in reviewGroups) {
          const group = reviewGroups[key];
          if (group.length > 1) {
            // Keep the first review, delete the rest
            const toDelete = group.slice(1);
            for (const review of toDelete) {
              await prisma.review.delete({ where: { id: review.id } });
            }
            console.log(`  🗑️  Removed ${toDelete.length} duplicate review(s) for booking ${bookingId}`);
          }
        }
      }

      // Review for booking1 (Venue) - couple1
      await upsertReview({
        bookingId: booking1.id,
        serviceListingId: venueService.id,
        reviewerId: couple1.id,
        rating: 5,
        comment: 'Absolutely stunning venue! The ballroom was elegant and spacious. Perfect for our wedding ceremony.',
        reviewDate: new Date('2024-01-25'),
      });
      console.log('✅ Created/Updated review 1 (Venue - 5 stars)');

      // Review for booking4 (Venue) - couple2
      await upsertReview({
        bookingId: booking4.id,
        serviceListingId: venueService.id,
        reviewerId: couple2.id,
        rating: 4,
        comment: 'Great venue with excellent service. The staff was very accommodating and helpful throughout the event.',
        reviewDate: new Date('2024-02-28'),
      });
      console.log('✅ Created/Updated review 2 (Venue - 4 stars)');

      if (photographerService && photographerVendor && booking2) {
        // Review for booking2 (Photographer) - couple1
        await upsertReview({
          bookingId: booking2.id,
          serviceListingId: photographerService.id,
          reviewerId: couple1.id,
          rating: 5,
          comment: 'Outstanding photography service! The photographer captured every special moment beautifully. Highly recommended!',
          reviewDate: new Date('2024-01-22'),
        });
        console.log('✅ Created/Updated review 3 (Photographer - 5 stars)');
      }

    }

    // Create reviews for couple1's bookings (outside couple2 block so booking3 is accessible)
    if (floristService && floristVendor && booking3) {
      // Review for booking3 - Florist service 1 (Centerpieces)
      await upsertReview({
        bookingId: booking3.id,
        serviceListingId: floristService.id,
        reviewerId: couple1.id,
        rating: 5,
        comment: 'Beautiful centerpieces! The roses were fresh and arranged perfectly. All our guests complimented the floral arrangements.',
        reviewDate: new Date('2024-01-20'),
      });
      console.log('✅ Created/Updated review 4 (Florist Centerpieces - 5 stars)');

      // Review for booking3 - Florist service 2 (Bouquet)
      const floristService2 = await prisma.serviceListing.findUnique({
        where: { id: 'service-florist-bouquet-test' },
      });
      if (floristService2) {
        await upsertReview({
          bookingId: booking3.id,
          serviceListingId: floristService2.id,
          reviewerId: couple1.id,
          rating: 4,
          comment: 'Lovely bridal bouquet. The design was elegant and matched perfectly with our wedding theme.',
          reviewDate: new Date('2024-01-21'),
        });
        console.log('✅ Created/Updated review 5 (Florist Bouquet - 4 stars)');
      }
    }

    // Create more bookings for couple1 with different vendors
    const catererVendor = await prisma.user.findUnique({
      where: { email: 'caterer@example.com' },
      include: { vendor: true },
    });

    if (catererVendor && catererVendor.vendor) {
      // Create a catering service
      const cateringService = await prisma.serviceListing.upsert({
        where: { id: 'service-catering-test' },
        update: {},
        create: {
          id: 'service-catering-test',
          vendorId: catererVendor.id,
          name: 'Premium Buffet Catering',
          description: 'Delicious buffet catering for your wedding',
          category: 'Caterer',
          price: 80,
          pricingPolicy: 'per_table',
          isActive: true,
          images: [],
        },
      });

      // Booking 5: Catering
      const booking5 = await prisma.booking.upsert({
        where: { id: 'booking-completed-5' },
        update: {
          status: 'completed',
        },
        create: {
          id: 'booking-completed-5',
          coupleId: couple1.id,
          projectId: project.id,
          vendorId: catererVendor.id,
          bookingDate: new Date('2023-12-05'),
          reservedDate: weddingDate,
          status: 'completed',
          depositDueDate: new Date('2023-12-10'),
          finalDueDate: new Date('2024-01-18'),
          selectedServices: {
            create: {
              serviceListingId: cateringService.id,
              quantity: 25, // 25 tables
              totalPrice: 2000, // 25 * 80
            },
          },
          payments: {
            create: [
              {
                paymentType: 'deposit',
                amount: 1000,
                paymentMethod: 'credit_card',
                paymentDate: depositPaymentDate,
              },
              {
                paymentType: 'final',
                amount: 1000,
                paymentMethod: 'credit_card',
                paymentDate: finalPaymentDate,
              },
            ],
          },
        },
        include: {
          selectedServices: true,
          payments: true,
        },
      });
      console.log('✅ Created completed booking 5 (Catering)');

      // Review for booking5
      await upsertReview({
        bookingId: booking5.id,
        serviceListingId: cateringService.id,
        reviewerId: couple1.id,
        rating: 5,
        comment: 'Excellent catering service! The food was delicious and the presentation was beautiful. Our guests were very satisfied.',
        reviewDate: new Date('2024-01-23'),
      });
      console.log('✅ Created/Updated review 6 (Catering - 5 stars)');
    }

    console.log('\n✨ Test data created successfully!');
    console.log('\n📝 You can now test the review functionality:');
    console.log('   1. Login as couple1@example.com (password: password123)');
    console.log('   2. Go to "Booked Suppliers" or "My Bookings"');
    console.log('   3. You should see completed bookings with existing reviews');
    console.log('\n💡 Test Scenarios:');
    console.log('   - Booking 1: Venue (has review) - see existing review');
    console.log('   - Booking 2: Photographer (has review) - see existing review');
    console.log('   - Booking 3: Florist (has 2 reviews) - see multiple reviews');
    console.log('   - Booking 5: Catering (has review) - see existing review');
    console.log('\n   Login as couple2@example.com to see:');
    console.log('   - Booking 4: Venue (has review) - different couple review');
  } catch (error) {
    console.error('❌ Error creating test data:', error);
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

