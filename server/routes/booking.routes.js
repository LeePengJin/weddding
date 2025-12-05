const express = require('express');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');
const { requireAuth } = require('../middleware/auth');
const { prefixedUlid } = require('../utils/id');
const { calculateCancellationFeeAndPayment } = require('../utils/cancellationFeeCalculator');
const notificationService = require('../services/notificationService');

const router = express.Router();
const prisma = new PrismaClient();

// Booking statuses that should lock linked design elements/services (non-removable)
const ACTIVE_BOOKING_STATUSES = [
  'pending_vendor_confirmation',
  'pending_deposit_payment',
  'confirmed',
  'pending_final_payment',
  'completed',
];

/**
 * Update isBooked/bookingId for PlacedElement and ProjectService linked to a booking.
 * Rules:
 * - If status is in ACTIVE_BOOKING_STATUSES => mark linked items as booked and attach bookingId.
 * - If status is cancelled_by_couple, cancelled_by_vendor, or rejected => clear bookingId and mark as not booked.
 *
 * Note: This assumes there is at most one active booking for a given project/service at a time.
 */
async function updateLinkedDesignItemsForBooking(bookingId, status) {
  const isActiveStatus = ACTIVE_BOOKING_STATUSES.includes(status);

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      selectedServices: true,
      project: {
        include: {
          venueDesign: {
            include: {
              placedElements: {
                select: {
                  id: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!booking || !booking.projectId) {
    return;
  }

  const serviceListingIds = booking.selectedServices.map(
    (s) => s.serviceListingId
  );

  if (!booking.project.venueDesign) {
    // No 3D design yet – only ProjectService entries will be affected
    if (isActiveStatus) {
      await prisma.projectService.updateMany({
        where: {
          projectId: booking.projectId,
          serviceListingId: { in: serviceListingIds },
        },
        data: {
          isBooked: true,
          bookingId,
        },
      });
    } else if (status === 'cancelled_by_couple' || status === 'cancelled_by_vendor' || status === 'rejected') {
      await prisma.projectService.updateMany({
        where: {
          bookingId,
        },
        data: {
          isBooked: false,
          bookingId: null,
        },
      });
    }
    return;
  }

  const venueDesign = booking.project.venueDesign;
  const layoutData = venueDesign.layoutData || {};
  const placementsMeta = layoutData.placementsMeta || {};

  // Find all placements that match the booked services
  const placementIdsForServices = venueDesign.placedElements
    .filter((placement) => {
      const meta = placementsMeta[placement.id];
      if (!meta) return false;
      
      // Check if this placement's serviceListingId matches any booked service
      if (meta.serviceListingId && serviceListingIds.includes(meta.serviceListingId)) {
        return true;
      }
      
      // For bundle items, also check if any placement in the same bundle is booked
      // This ensures all placements in a bundle are marked as booked together
      if (meta.bundleId) {
        // Find all placements in the same bundle
        const bundlePlacements = venueDesign.placedElements.filter((p) => {
          const pMeta = placementsMeta[p.id];
          return pMeta && pMeta.bundleId === meta.bundleId;
        });
        
        // If any placement in the bundle matches a booked service, mark all
        return bundlePlacements.some((p) => {
          const pMeta = placementsMeta[p.id];
          return pMeta && pMeta.serviceListingId && serviceListingIds.includes(pMeta.serviceListingId);
        });
      }
      
      return false;
    })
    .map((placement) => placement.id);

  if (isActiveStatus) {
    // Mark linked 3D elements and non-3D services as booked
    if (placementIdsForServices.length > 0) {
      await prisma.placedElement.updateMany({
        where: {
          id: { in: placementIdsForServices },
        },
        data: {
          isBooked: true,
          bookingId,
        },
      });
    }

    await prisma.projectService.updateMany({
      where: {
        projectId: booking.projectId,
        serviceListingId: { in: serviceListingIds },
      },
      data: {
        isBooked: true,
        bookingId,
      },
    });
  } else if (status === 'cancelled_by_couple' || status === 'cancelled_by_vendor' || status === 'rejected') {
    // Booking no longer locks linked items – clear flags for this bookingId
    await prisma.placedElement.updateMany({
      where: {
        bookingId,
      },
      data: {
        isBooked: false,
        bookingId: null,
      },
    });

    await prisma.projectService.updateMany({
      where: {
        bookingId,
      },
      data: {
        isBooked: false,
        bookingId: null,
      },
    });
  }
}

// Validation schema for booking status update
const bookingStatusSchema = z.object({
  status: z.enum([
    'pending_vendor_confirmation',
    'pending_deposit_payment',
    'confirmed',
    'pending_final_payment',
    'cancelled_by_couple',
    'cancelled_by_vendor',
    'rejected',
    'completed',
  ]),
  depositDueDate: z.string().datetime().optional().nullable(),
  finalDueDate: z.string().datetime().optional().nullable(),
});

// GET /bookings - Get all bookings for the authenticated user (vendor or couple)
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { status, startDate, endDate, projectId } = req.query;

    const where = {};

    // Filter by role
    if (req.user.role === 'vendor') {
      where.vendorId = req.user.sub;
      // Vendors can see bookings across all projects (no projectId required)
    } else if (req.user.role === 'couple') {
      where.coupleId = req.user.sub;
      // For couples, projectId is required to ensure data isolation between projects
      if (!projectId) {
        return res.status(400).json({ error: 'Project ID is required' });
      }
      // Validate that the project belongs to the couple
      const project = await prisma.weddingProject.findFirst({
        where: {
          id: projectId,
          coupleId: req.user.sub,
        },
      });
      if (!project) {
        return res.status(404).json({ error: 'Project not found or access denied' });
      }
      where.projectId = projectId;
    } else {
      return res.status(403).json({ error: 'Vendor or couple access required' });
    }

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.reservedDate = {};
      if (startDate) {
        where.reservedDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.reservedDate.lte = new Date(endDate);
      }
    }

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        couple: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                contactNumber: true,
              },
            },
          },
        },
        vendor: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                contactNumber: true,
              },
            },
          },
        },
        project: {
          select: {
            id: true,
            projectName: true,
            weddingDate: true,
            eventStartTime: true,
            eventEndTime: true,
            venueServiceListing: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        selectedServices: {
          include: {
            serviceListing: {
              select: {
                id: true,
                name: true,
                category: true,
                price: true,
                images: true,
                pricingPolicy: true,
                hourlyRate: true,
              },
            },
          },
        },
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
        reviews: {
          include: {
            reviewer: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        cancellation: true,
      },
      orderBy: { bookingDate: 'desc' },
    });

    // Convert Decimal to string for JSON response
    const bookingsWithStringPrices = bookings.map((booking) => ({
      ...booking,
      selectedServices: booking.selectedServices.map((service) => ({
        ...service,
        totalPrice: service.totalPrice.toString(),
        serviceListing: {
          ...service.serviceListing,
          price: service.serviceListing.price.toString(),
          hourlyRate: service.serviceListing.hourlyRate ? service.serviceListing.hourlyRate.toString() : null,
        },
      })),
      payments: booking.payments.map((payment) => ({
        ...payment,
        amount: payment.amount.toString(),
      })),
      cancellation: booking.cancellation ? {
        ...booking.cancellation,
        cancellationFee: booking.cancellation.cancellationFee ? booking.cancellation.cancellationFee.toString() : null,
      } : null,
    }));

    res.json(bookingsWithStringPrices);
  } catch (err) {
    next(err);
  }
});

// GET /bookings/:id - Get a specific booking
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const where = {
      id: req.params.id,
    };

    // Filter by role
    if (req.user.role === 'vendor') {
      where.vendorId = req.user.sub;
    } else if (req.user.role === 'couple') {
      where.coupleId = req.user.sub;
    } else {
      return res.status(403).json({ error: 'Vendor or couple access required' });
    }

    const booking = await prisma.booking.findFirst({
      where,
      include: {
        couple: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                contactNumber: true,
              },
            },
          },
        },
        vendor: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                contactNumber: true,
              },
            },
          },
        },
        project: {
          select: {
            id: true,
            projectName: true,
            weddingDate: true,
            eventStartTime: true,
            eventEndTime: true,
            venueServiceListing: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        selectedServices: {
          include: {
            serviceListing: {
              select: {
                id: true,
                name: true,
                category: true,
                price: true,
                images: true,
                description: true,
                pricingPolicy: true,
                hourlyRate: true,
              },
            },
          },
        },
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
        reviews: {
          include: {
            reviewer: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        cancellation: true,
      },
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Convert Decimal to string for JSON response
    const bookingWithStringPrices = {
      ...booking,
      selectedServices: booking.selectedServices.map((service) => ({
        ...service,
        totalPrice: service.totalPrice.toString(),
        serviceListing: {
          ...service.serviceListing,
          price: service.serviceListing.price.toString(),
          hourlyRate: service.serviceListing.hourlyRate ? service.serviceListing.hourlyRate.toString() : null,
        },
      })),
      payments: booking.payments.map((payment) => ({
        ...payment,
        amount: payment.amount.toString(),
      })),
    };

    res.json(bookingWithStringPrices);
  } catch (err) {
    next(err);
  }
});

// PATCH /bookings/:id/status - Update booking status (accept/reject/update)
router.patch('/:id/status', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ error: 'Vendor access required' });
    }

    // Check if booking exists and belongs to vendor
    const existingBooking = await prisma.booking.findFirst({
      where: {
        id: req.params.id,
        vendorId: req.user.sub,
      },
      include: {
        project: {
          select: {
            id: true,
            weddingDate: true,
          },
        },
      },
    });

    if (!existingBooking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const updateData = bookingStatusSchema.parse(req.body);

    // Convert date strings to Date objects if provided
    const updatePayload = {
      status: updateData.status,
    };

    if (updateData.depositDueDate !== undefined) {
      updatePayload.depositDueDate = updateData.depositDueDate
        ? new Date(updateData.depositDueDate)
        : null;
    }

    if (updateData.finalDueDate !== undefined) {
      updatePayload.finalDueDate = updateData.finalDueDate
        ? new Date(updateData.finalDueDate)
        : null;
    }

    // Validate status transitions
    const validTransitions = {
      pending_vendor_confirmation: ['pending_deposit_payment', 'rejected', 'cancelled_by_couple', 'cancelled_by_vendor'],
      pending_deposit_payment: ['confirmed', 'cancelled_by_couple', 'cancelled_by_vendor'],
      confirmed: ['pending_final_payment', 'cancelled_by_couple', 'cancelled_by_vendor'],
      pending_final_payment: ['completed', 'cancelled_by_couple', 'cancelled_by_vendor'],
      rejected: [], // Cannot transition from rejected
      cancelled_by_couple: [], // Cannot transition from cancelled_by_couple
      cancelled_by_vendor: [], // Cannot transition from cancelled_by_vendor
      completed: [], // Cannot transition from completed
    };

    const currentStatus = existingBooking.status;
    const newStatus = updateData.status;

    if (currentStatus !== newStatus) {
      if (!validTransitions[currentStatus]?.includes(newStatus)) {
        return res.status(400).json({
          error: `Invalid status transition from ${currentStatus} to ${newStatus}`,
        });
      }

      // When accepting a booking (pending_vendor_confirmation -> pending_deposit_payment)
      // Create a time slot for the reserved date and set deposit due date
      if (currentStatus === 'pending_vendor_confirmation' && newStatus === 'pending_deposit_payment') {
        const reservedDate = existingBooking.reservedDate;
        const dateStr = reservedDate.toISOString().split('T')[0];

        // Check if time slot already exists
        const existingTimeSlot = await prisma.timeSlot.findUnique({
          where: {
            vendorId_date: {
              vendorId: req.user.sub,
              date: reservedDate,
            },
          },
        });

        if (!existingTimeSlot) {
          await prisma.timeSlot.create({
            data: {
              vendorId: req.user.sub,
              date: reservedDate,
              status: 'booked',
            },
          });
        }
        
        // Set deposit and final payment due dates
        // Handle edge cases where wedding date is near
        if (existingBooking.project?.weddingDate) {
          const weddingDate = new Date(existingBooking.project.weddingDate);
          const today = new Date();
          const daysUntilWedding = Math.ceil((weddingDate - today) / (1000 * 60 * 60 * 24));
          
          // Set deposit due date
        if (!updatePayload.depositDueDate) {
            if (daysUntilWedding >= 7) {
              // Standard: 7 days from now
          const depositDueDate = new Date();
          depositDueDate.setDate(depositDueDate.getDate() + 7);
          updatePayload.depositDueDate = depositDueDate;
            } else if (daysUntilWedding > 1) {
              // Wedding is less than 7 days away: set deposit due to wedding date - 1 day
              const depositDueDate = new Date(weddingDate);
              depositDueDate.setDate(weddingDate.getDate() - 1);
              updatePayload.depositDueDate = depositDueDate;
            } else {
              // Wedding is tomorrow or today: set deposit due to today (immediate)
              updatePayload.depositDueDate = today;
            }
          }
          
          // Set final payment due date automatically (1 week before wedding)
          if (!updatePayload.finalDueDate) {
            // Calculate final due date (1 week before wedding)
            const finalDueDate = new Date(weddingDate);
            finalDueDate.setDate(finalDueDate.getDate() - 7);
            
            // If wedding is less than 7 days away, set final due date to wedding date - 1 day
            // If wedding is less than 1 day away, set to today (immediate payment required)
            if (daysUntilWedding < 7) {
              if (daysUntilWedding < 1) {
                finalDueDate.setTime(today.getTime());
              } else {
                finalDueDate.setDate(weddingDate.getDate() - 1);
              }
            }
            
            // Only set if it's in the future or today
            if (finalDueDate >= today) {
              updatePayload.finalDueDate = finalDueDate;
            }
          }
        } else {
          // No project/wedding date: use standard 7 days for deposit
          if (!updatePayload.depositDueDate) {
            const depositDueDate = new Date();
            depositDueDate.setDate(depositDueDate.getDate() + 7);
            updatePayload.depositDueDate = depositDueDate;
          }
        }
      }
      
      // When deposit is paid (pending_deposit_payment -> confirmed)
      // Set final payment due date to 1 week before wedding date
      if (currentStatus === 'pending_deposit_payment' && newStatus === 'confirmed') {
        const project = await prisma.weddingProject.findUnique({
          where: { id: existingBooking.projectId },
          select: { weddingDate: true },
        });
        
        if (project && project.weddingDate) {
          const weddingDate = new Date(project.weddingDate);
          const finalDueDate = new Date(weddingDate);
          finalDueDate.setDate(finalDueDate.getDate() - 7); // 1 week before wedding
          
          // Only set if it's in the future
          if (finalDueDate > new Date()) {
            updatePayload.finalDueDate = finalDueDate;
          }
        }
      }
    }

    const updatedBooking = await prisma.booking.update({
      where: { id: req.params.id },
      data: updatePayload,
      include: {
        couple: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                contactNumber: true,
              },
            },
          },
        },
        project: {
          select: {
            id: true,
            projectName: true,
            weddingDate: true,
            eventStartTime: true,
            eventEndTime: true,
            venueServiceListing: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        selectedServices: {
          include: {
            serviceListing: {
              select: {
                id: true,
                name: true,
                category: true,
                price: true,
                images: true,
                pricingPolicy: true,
                hourlyRate: true,
              },
            },
          },
        },
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
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
      },
    });

    // Update linked design items (PlacedElement / ProjectService) based on new status
    await updateLinkedDesignItemsForBooking(updatedBooking.id, updatedBooking.status);

    // Update project status: ready_to_book -> booked when first booking is confirmed (pending_deposit_payment or later)
    // Don't update if project is already completed
    if (updatedBooking.projectId && newStatus === 'pending_deposit_payment') {
      const project = await prisma.weddingProject.findUnique({
        where: { id: updatedBooking.projectId },
        select: { status: true },
      });
      
      if (project && project.status === 'ready_to_book') {
        await prisma.weddingProject.update({
          where: { id: updatedBooking.projectId },
          data: { status: 'booked' },
        });
      }
    }

    // If this is a venue booking being accepted (pending_vendor_confirmation -> pending_deposit_payment)
    // Update dependent bookings waiting for venue replacement
    // This is consistent with the venue-first rule: venue is "booked" when accepted (pending_deposit_payment)
    const isVenueBooking = updatedBooking.selectedServices?.some(
      (service) => service.serviceListing?.category === 'Venue'
    ) ?? false;
    
    if (isVenueBooking && currentStatus === 'pending_vendor_confirmation' && newStatus === 'pending_deposit_payment' && updatedBooking.projectId) {
      const notificationService = require('../services/notificationService');
      
      // Find dependent bookings waiting for venue replacement
      const dependentBookings = await prisma.booking.findMany({
        where: {
          projectId: updatedBooking.projectId,
          isPendingVenueReplacement: true,
          status: {
            notIn: ['cancelled_by_couple', 'cancelled_by_vendor', 'rejected', 'completed'],
          },
        },
        include: {
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
          selectedServices: {
            include: {
              serviceListing: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      if (dependentBookings.length > 0 && updatedBooking.project?.weddingDate) {
        const weddingDate = updatedBooking.project.weddingDate instanceof Date 
          ? updatedBooking.project.weddingDate 
          : new Date(updatedBooking.project.weddingDate);
        const today = new Date();

        // Update each dependent booking
        for (const dependentBooking of dependentBookings) {
          const weddingDateObj = weddingDate instanceof Date ? weddingDate : new Date(weddingDate);

          // Check if deposit is already paid (confirmed or later)
          const depositAlreadyPaid = ['confirmed', 'pending_final_payment', 'completed'].includes(dependentBooking.status);
          
          // Recalculate deposit due date (only if deposit not paid yet)
          let newDepositDueDate = dependentBooking.depositDueDate; // Keep existing if deposit paid
          if (!depositAlreadyPaid) {
            if (dependentBooking.originalDepositDueDate && dependentBooking.venueCancellationDate) {
              const originalDepositDue = new Date(dependentBooking.originalDepositDueDate);
              const cancellationDate = new Date(dependentBooking.venueCancellationDate);
              
              // Calculate remaining days from cancellation to original due date
              const remainingDays = Math.ceil((originalDepositDue - cancellationDate) / (1000 * 60 * 60 * 24));
              
              // New due date = today + remaining days
              newDepositDueDate = new Date(today);
              newDepositDueDate.setDate(today.getDate() + remainingDays);
              
              // Cap at wedding date - 1 day
              const maxDepositDue = new Date(weddingDateObj);
              maxDepositDue.setDate(weddingDateObj.getDate() - 1);
              if (newDepositDueDate > maxDepositDue) {
                newDepositDueDate = maxDepositDue;
              }
            } else if (!dependentBooking.depositDueDate) {
              // Fallback: set to standard policy (7 days)
              newDepositDueDate = new Date(today);
              newDepositDueDate.setDate(today.getDate() + 7);
            }
          }

          // Recalculate final due date (always one week before wedding)
          let newFinalDueDate = new Date(weddingDateObj);
          newFinalDueDate.setDate(weddingDateObj.getDate() - 7);
          
          // If final due date already passed, set to wedding date - 1 day
          if (newFinalDueDate < today) {
            newFinalDueDate = new Date(weddingDateObj);
            newFinalDueDate.setDate(weddingDateObj.getDate() - 1);
          }

          // Update booking
          const updateData = {
            isPendingVenueReplacement: false,
            dependsOnVenueBookingId: updatedBooking.id,
            finalDueDate: newFinalDueDate,
            originalDepositDueDate: null,
            originalFinalDueDate: null,
            venueCancellationDate: null,
            gracePeriodEndDate: null,
          };
          
          // Only update deposit due date if deposit not paid yet
          if (!depositAlreadyPaid && newDepositDueDate) {
            updateData.depositDueDate = newDepositDueDate;
          }

          await prisma.booking.update({
            where: { id: dependentBooking.id },
            data: updateData,
          });

          // Send notification to vendor
          notificationService.sendVenueReplacementFoundNotification(
            dependentBooking,
            updatedBooking
          ).catch((err) => {
            console.error(`Error sending venue replacement notification to vendor for booking ${dependentBooking.id}:`, err);
          });
        }
        
        // Send notification to couple about venue replacement
        const couple = await prisma.couple.findUnique({
          where: { userId: updatedBooking.coupleId },
          include: { user: true },
        });
        
        if (couple && couple.user.email) {
          notificationService.sendVenueReplacementFoundCoupleNotification(
            updatedBooking,
            dependentBookings
          ).catch((err) => {
            console.error(`Error sending venue replacement notification to couple:`, err);
          });
        }

        console.log(`✅ Updated ${dependentBookings.length} dependent booking(s) after venue booking acceptance for booking ${updatedBooking.id}`);
      }
    }

    // Convert Decimal to string for JSON response
    const bookingWithStringPrices = {
      ...updatedBooking,
      selectedServices: updatedBooking.selectedServices.map((service) => ({
        ...service,
        totalPrice: service.totalPrice.toString(),
        serviceListing: {
          ...service.serviceListing,
          price: service.serviceListing.price.toString(),
        },
      })),
      payments: updatedBooking.payments.map((payment) => ({
        ...payment,
        amount: payment.amount.toString(),
      })),
    };

    // Send email when vendor accepts booking (moves to pending_deposit_payment)
    if (currentStatus === 'pending_vendor_confirmation' && newStatus === 'pending_deposit_payment') {
      notificationService
        .sendBookingAcceptedCoupleNotification(bookingWithStringPrices)
        .catch((err) => {
          console.error('Error sending booking accepted notification to couple:', err);
        });
    }

    res.json(bookingWithStringPrices);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const issues = err.issues.map((i) => ({ field: i.path?.[0] ?? 'unknown', message: i.message }));
      return res.status(400).json({ error: issues[0]?.message || 'Invalid input', issues });
    }
    next(err);
  }
});

// POST /bookings - Create booking requests (for couples)
const createBookingSchema = z.object({
  projectId: z.string().optional().nullable(),
  vendorId: z.string(),
  reservedDate: z.string().datetime(),
  selectedServices: z.array(
    z.object({
      serviceListingId: z.string(),
      quantity: z.number().int().positive().default(1),
      totalPrice: z.number().positive(),
    })
  ),
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'couple') {
      return res.status(403).json({ error: 'Couple access required' });
    }

    const data = createBookingSchema.parse(req.body);

    // Get couple ID
    const couple = await prisma.couple.findUnique({
      where: { userId: req.user.sub },
    });

    if (!couple) {
      return res.status(404).json({ error: 'Couple profile not found' });
    }

    // Verify vendor exists
    const vendor = await prisma.vendor.findUnique({
      where: { userId: data.vendorId },
    });

    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    // Verify project belongs to couple if provided
    let project = null;
    if (data.projectId) {
      project = await prisma.weddingProject.findFirst({
        where: {
          id: data.projectId,
          coupleId: req.user.sub,
        },
      });

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
    }

    // Verify all service listings exist and belong to the vendor
    const serviceListingIds = data.selectedServices.map((s) => s.serviceListingId);
    const serviceListings = await prisma.serviceListing.findMany({
      where: {
        id: { in: serviceListingIds },
        vendorId: data.vendorId,
        isActive: true,
      },
    });

    if (serviceListings.length !== serviceListingIds.length) {
      return res.status(400).json({ error: 'One or more service listings not found or inactive' });
    }

    // Check for duplicate bookings - only prevent duplicates for exclusive services
    // Reusable services (e.g., bouquets) and quantity_based services can be booked multiple times
    const reservedDate = new Date(data.reservedDate);
    const exclusiveServiceIds = serviceListings
      .filter((s) => s.availabilityType === 'exclusive')
      .map((s) => s.id);

    if (exclusiveServiceIds.length > 0) {
      const existingBookings = await prisma.booking.findMany({
        where: {
          coupleId: req.user.sub,
          projectId: data.projectId || null,
          vendorId: data.vendorId,
          reservedDate: reservedDate,
          // Only check active bookings (exclude cancelled and rejected)
          status: {
            notIn: ['cancelled_by_couple', 'cancelled_by_vendor', 'rejected'],
          },
        },
        include: {
          selectedServices: {
            where: {
              serviceListingId: { in: exclusiveServiceIds },
            },
            select: {
              serviceListingId: true,
            },
          },
        },
      });

      // Check if any existing booking has the same exclusive service listing(s)
      for (const existingBooking of existingBookings) {
        if (existingBooking.selectedServices.length > 0) {
          const existingExclusiveServiceIds = existingBooking.selectedServices.map(
            (s) => s.serviceListingId
          );
          const duplicateServices = exclusiveServiceIds.filter((id) =>
            existingExclusiveServiceIds.includes(id)
          );

          if (duplicateServices.length > 0) {
            // Get service names for better error message
            const duplicateServiceNames = serviceListings
              .filter((s) => duplicateServices.includes(s.id))
              .map((s) => s.name)
              .join(', ');

            return res.status(409).json({
              error: `You have already booked the following exclusive service(s) for this date: ${duplicateServiceNames}. Please check your existing bookings.`,
            });
          }
        }
      }
    }

    // Enforce venue-first rule for non-venue services
    // Couples must have a venue booking for the project/date before booking other services.
    // Check based on service listing category, not vendor category
    // (e.g., a venue vendor can have both venue listings and decoration listings)
    const hasVenueServiceListing = serviceListings.some((listing) => listing.category === 'Venue');

    // For non-venue service listings, ensure there is an existing accepted venue booking for this project/date.
    // Declare venueBooking in the outer scope so we can safely reference it later when creating the booking.
    let venueBooking = null;

    if (!hasVenueServiceListing) {
      if (!data.projectId || !project) {
        return res.status(400).json({
          error: 'Please select a wedding project with a booked venue before requesting this service.',
        });
      }

      // Look for an existing venue booking for this project and date that is accepted by vendor (not just pending)
      // Venue must be at least pending_deposit_payment (vendor has accepted) before other services can be booked
      // Check for bookings that have at least one service listing with category 'Venue'
      venueBooking = await prisma.booking.findFirst({
        where: {
          projectId: data.projectId,
          reservedDate: reservedDate,
          status: {
            in: [
              'pending_deposit_payment',
              'confirmed',
              'pending_final_payment',
              'completed',
            ],
          },
          selectedServices: {
            some: {
              serviceListing: {
            category: 'Venue',
              },
            },
          },
        },
      });

      if (!venueBooking) {
        return res.status(400).json({
          error:
            'You must have a venue booking for this wedding date before booking other services. Please book your venue first.',
        });
      }
    }

    // Create booking
    const booking = await prisma.booking.create({
      data: {
        coupleId: req.user.sub,
        projectId: data.projectId || null,
        vendorId: data.vendorId,
        reservedDate: new Date(data.reservedDate),
        status: 'pending_vendor_confirmation',
        // Store venue dependency for non-venue services
        dependsOnVenueBookingId: !hasVenueServiceListing && venueBooking ? venueBooking.id : null,
        selectedServices: {
          create: data.selectedServices.map((service) => ({
            serviceListingId: service.serviceListingId,
            quantity: service.quantity,
            totalPrice: service.totalPrice,
          })),
        },
      },
      include: {
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
        project: {
          select: {
            id: true,
            projectName: true,
            weddingDate: true,
            eventStartTime: true,
            eventEndTime: true,
            venueServiceListing: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        selectedServices: {
          include: {
            serviceListing: {
              select: {
                id: true,
                name: true,
                category: true,
                price: true,
                pricingPolicy: true,
                hourlyRate: true,
              },
            },
          },
        },
      },
    });

    // Newly created bookings start in an active status (pending_vendor_confirmation)
    // Mark linked design items as booked
    await updateLinkedDesignItemsForBooking(booking.id, booking.status);

    // Update project status: draft -> ready_to_book when first booking is created
    // Don't update if project is already completed
    if (booking.projectId) {
      const project = await prisma.weddingProject.findUnique({
        where: { id: booking.projectId },
        select: { status: true },
      });
      
      if (project && project.status === 'draft') {
        await prisma.weddingProject.update({
          where: { id: booking.projectId },
          data: { status: 'ready_to_book' },
        });
      }
    }

    // Convert Decimal to string for JSON response
    const bookingWithStringPrices = {
      ...booking,
      selectedServices: booking.selectedServices.map((service) => ({
        ...service,
        totalPrice: service.totalPrice.toString(),
        serviceListing: {
          ...service.serviceListing,
          price: service.serviceListing.price.toString(),
          hourlyRate: service.serviceListing.hourlyRate ? service.serviceListing.hourlyRate.toString() : null,
        },
      })),
    };

    // Send email notifications to couple and vendor
    notificationService.sendBookingRequestCreatedCoupleNotification(booking).catch((err) => {
      console.error('Error sending booking request created notification to couple:', err);
    });
    notificationService.sendBookingRequestReceivedVendorNotification(booking).catch((err) => {
      console.error('Error sending booking request received notification to vendor:', err);
    });

    res.status(201).json(bookingWithStringPrices);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const issues = err.issues.map((i) => ({ field: i.path?.[0] ?? 'unknown', message: i.message }));
      return res.status(400).json({ error: issues[0]?.message || 'Invalid input', issues });
    }
    next(err);
  }
});

// POST /bookings/:id/payments - Create a payment for a booking (for couples)
const createPaymentSchema = z.object({
  paymentType: z.enum(['deposit', 'final']),
  amount: z.number().positive(),
  paymentMethod: z.enum(['credit_card', 'bank_transfer', 'touch_n_go']),
  receipt: z.string().url().optional().nullable(),
});

router.post('/:id/payments', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'couple') {
      return res.status(403).json({ error: 'Couple access required' });
    }

    // Check if booking exists and belongs to couple
    const booking = await prisma.booking.findFirst({
      where: {
        id: req.params.id,
        coupleId: req.user.sub,
      },
      include: {
        selectedServices: {
          include: {
            serviceListing: {
              select: {
                id: true,
                category: true,
              },
            },
          },
        },
        project: {
          select: {
            id: true,
            weddingDate: true,
          },
        },
      },
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const data = createPaymentSchema.parse(req.body);

    // Block payment if venue replacement is pending
    if (booking.isPendingVenueReplacement) {
      return res.status(400).json({ 
        error: 'Payment paused due to venue cancellation. Please select a replacement venue first.' 
      });
    }

    // Validate payment type matches booking status
    if (data.paymentType === 'deposit' && booking.status !== 'pending_deposit_payment') {
      return res.status(400).json({ error: 'Deposit payment not allowed for this booking status' });
    }

    if (data.paymentType === 'final' && booking.status !== 'pending_final_payment') {
      return res.status(400).json({ error: 'Final payment not allowed for this booking status' });
    }

    // Check if payment already exists for this type
    const existingPayment = await prisma.payment.findFirst({
      where: {
        bookingId: booking.id,
        paymentType: data.paymentType,
      },
    });

    if (existingPayment) {
      return res.status(400).json({ error: `${data.paymentType} payment already exists for this booking` });
    }

    // Create payment
    const payment = await prisma.payment.create({
      data: {
        bookingId: booking.id,
        paymentType: data.paymentType,
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        receipt: data.receipt || null,
      },
    });

    // Update booking status based on payment type
    let newStatus = booking.status;
    const updateData = { status: newStatus };
    
    if (data.paymentType === 'deposit') {
      newStatus = 'confirmed';
      updateData.status = newStatus;
      
      // Set final payment due date to 1 week before wedding date
      const project = await prisma.weddingProject.findUnique({
        where: { id: booking.projectId },
        select: { weddingDate: true },
      });
      
      if (project && project.weddingDate) {
        const weddingDate = new Date(project.weddingDate);
        const finalDueDate = new Date(weddingDate);
        finalDueDate.setDate(finalDueDate.getDate() - 7); // 1 week before wedding
        
        // Only set if it's in the future
        if (finalDueDate > new Date()) {
          updateData.finalDueDate = finalDueDate;
        }
      }
    } else if (data.paymentType === 'final') {
      newStatus = 'completed';
      updateData.status = newStatus;
    }

    // Update booking status and linked design items
    const updatedBooking = await prisma.booking.update({
      where: { id: booking.id },
      data: updateData,
      include: {
        selectedServices: {
          include: {
            serviceListing: {
              select: {
                id: true,
                category: true,
              },
            },
          },
        },
      },
    });

    await updateLinkedDesignItemsForBooking(updatedBooking.id, updatedBooking.status);

    // Convert Decimal to string for JSON response
    const paymentWithStringAmount = {
      ...payment,
      amount: payment.amount.toString(),
    };

    res.status(201).json(paymentWithStringAmount);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const issues = err.issues.map((i) => ({ field: i.path?.[0] ?? 'unknown', message: i.message }));
      return res.status(400).json({ error: issues[0]?.message || 'Invalid input', issues });
    }
    next(err);
  }
});

// POST /bookings/:id/reviews - Create a review for a booking (for couples)
const createReviewSchema = z.object({
  serviceListingId: z.string().uuid('Invalid service listing ID'),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000, 'Comment must be less than 2000 characters').optional().nullable(),
});

router.post('/:id/reviews', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'couple') {
      return res.status(403).json({ error: 'Couple access required' });
    }

    // Check if booking exists and belongs to couple
    const booking = await prisma.booking.findFirst({
      where: {
        id: req.params.id,
        coupleId: req.user.sub,
        status: 'completed', // Only allow reviews for completed bookings
      },
      include: {
        selectedServices: {
          select: {
            serviceListingId: true,
          },
        },
      },
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found or not completed' });
    }

    const data = createReviewSchema.parse(req.body);

    // Verify the serviceListingId is part of this booking
    const serviceInBooking = booking.selectedServices.some(
      (service) => service.serviceListingId === data.serviceListingId
    );

    if (!serviceInBooking) {
      return res.status(400).json({ error: 'Service listing is not part of this booking' });
    }

    // Check if review already exists for this booking and service
    const existingReview = await prisma.review.findFirst({
      where: {
        bookingId: booking.id,
        serviceListingId: data.serviceListingId,
        reviewerId: req.user.sub,
      },
    });

    if (existingReview) {
      return res.status(400).json({ error: 'Review already exists for this service' });
    }

    // Create review
    const review = await prisma.review.create({
      data: {
        bookingId: booking.id,
        serviceListingId: data.serviceListingId,
        reviewerId: req.user.sub,
        rating: data.rating,
        comment: data.comment || null,
      },
      include: {
        reviewer: {
          select: {
            id: true,
            name: true,
          },
        },
        serviceListing: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.status(201).json(review);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const issues = err.issues.map((i) => ({ field: i.path?.[0] ?? 'unknown', message: i.message }));
      return res.status(400).json({ error: issues[0]?.message || 'Invalid input', issues });
    }
    next(err);
  }
});

// Get vendor payments (for vendor to see their payment status)
router.get('/vendor/payments', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ error: 'Vendor access required' });
    }

    const vendorId = req.user.sub;

    // Get all bookings for this vendor
    const bookings = await prisma.booking.findMany({
      where: { vendorId },
      include: {
        payments: {
          orderBy: { paymentDate: 'desc' },
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
        selectedServices: {
          include: {
            serviceListing: {
              select: {
                id: true,
                name: true,
                category: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Flatten payments with booking info
    const payments = [];
    bookings.forEach((booking) => {
      booking.payments.forEach((payment) => {
        payments.push({
          id: payment.id,
          bookingId: booking.id,
          paymentType: payment.paymentType,
          amount: payment.amount.toString(),
          paymentMethod: payment.paymentMethod,
          paymentDate: payment.paymentDate,
          receipt: payment.receipt,
          releasedToVendor: payment.releasedToVendor,
          releasedAt: payment.releasedAt,
          couple: {
            id: booking.couple.userId,
            name: booking.couple.user.name,
            email: booking.couple.user.email,
          },
          booking: {
            id: booking.id,
            reservedDate: booking.reservedDate,
            status: booking.status,
            selectedServices: booking.selectedServices.map((ss) => ({
              id: ss.id,
              serviceName: ss.serviceListing.name,
              category: ss.serviceListing.category,
              quantity: ss.quantity,
              totalPrice: ss.totalPrice.toString(),
            })),
          },
        });
      });
    });

    res.json(payments);
  } catch (err) {
    next(err);
  }
});

// GET /bookings/:id/cancellation-fee - Calculate cancellation fee (preview)
router.get('/:id/cancellation-fee', requireAuth, async (req, res, next) => {
  try {
    // Check if booking exists and user has access
    const where = {
      id: req.params.id,
    };

    if (req.user.role === 'vendor') {
      where.vendorId = req.user.sub;
    } else if (req.user.role === 'couple') {
      where.coupleId = req.user.sub;
    } else {
      return res.status(403).json({ error: 'Vendor or couple access required' });
    }

    const booking = await prisma.booking.findFirst({
      where,
      include: {
        selectedServices: {
          include: {
            serviceListing: {
              select: {
                id: true,
                name: true,
                cancellationPolicy: true,
                cancellationFeeTiers: true,
              },
            },
          },
        },
        payments: true,
      },
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Check if booking can be cancelled
    const cancellableStatuses = [
      'pending_vendor_confirmation',
      'pending_deposit_payment',
      'confirmed',
      'pending_final_payment',
    ];

    if (!cancellableStatuses.includes(booking.status)) {
      return res.status(400).json({
        error: `Booking cannot be cancelled. Current status: ${booking.status}`,
      });
    }

    // Check if already cancelled
    const existingCancellation = await prisma.cancellation.findUnique({
      where: { bookingId: booking.id },
    });

    if (existingCancellation) {
      return res.status(400).json({ error: 'Booking is already cancelled' });
    }

    // For multi-service bookings, use the first service's cancellation policy
    // In a real scenario, you might want to calculate fees per service and sum them
    const firstService = booking.selectedServices[0];
    if (!firstService) {
      return res.status(400).json({ error: 'Booking has no services' });
    }

    const serviceListing = firstService.serviceListing;

    // Calculate cancellation fee
    const feeCalculation = calculateCancellationFeeAndPayment(booking, serviceListing);

    res.json({
      bookingId: booking.id,
      status: booking.status,
      reservedDate: booking.reservedDate,
      cancellationPolicy: serviceListing.cancellationPolicy,
      ...feeCalculation,
    });
  } catch (err) {
    next(err);
  }
});

// POST /bookings/:id/cancel - Cancel a booking
const cancelBookingSchema = z.object({
  reason: z
    .string()
    .min(3, 'Cancellation reason is required')
    .optional()
    .nullable(),
});

router.post('/:id/cancel', requireAuth, async (req, res, next) => {
  try {
    const data = cancelBookingSchema.parse(req.body);

    // Check if booking exists and user has access
    const where = {
      id: req.params.id,
    };

    if (req.user.role === 'vendor') {
      where.vendorId = req.user.sub;
    } else if (req.user.role === 'couple') {
      where.coupleId = req.user.sub;
    } else {
      return res.status(403).json({ error: 'Vendor or couple access required' });
    }

    const booking = await prisma.booking.findFirst({
      where,
      include: {
        vendor: {
          select: {
            userId: true,
            category: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        selectedServices: {
          include: {
            serviceListing: {
              select: {
                id: true,
                name: true,
                category: true,
                cancellationPolicy: true,
                cancellationFeeTiers: true,
              },
            },
          },
        },
        payments: true,
        dependentBookings: {
          where: {
            status: {
              notIn: ['cancelled_by_couple', 'cancelled_by_vendor', 'rejected', 'completed'],
            },
          },
          include: {
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
            selectedServices: {
              include: {
                serviceListing: {
                  select: {
                    id: true,
                    name: true,
                    category: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Check if booking can be cancelled
    const cancellableStatuses = [
      'pending_vendor_confirmation',
      'pending_deposit_payment',
      'confirmed',
      'pending_final_payment',
    ];

    if (!cancellableStatuses.includes(booking.status)) {
      return res.status(400).json({
        error: `Booking cannot be cancelled. Current status: ${booking.status}`,
      });
    }

    // Check if already cancelled
    const existingCancellation = await prisma.cancellation.findUnique({
      where: { bookingId: booking.id },
    });

    if (existingCancellation) {
      return res.status(400).json({ error: 'Booking is already cancelled' });
    }

    // Determine who is cancelling and calculate fee
    const isVendorCancelling = req.user.role === 'vendor';
    const cancelledBy = isVendorCancelling ? booking.vendorId : booking.coupleId;

    // Validate cancelledBy matches booking
    if (isVendorCancelling && cancelledBy !== booking.vendorId) {
      return res.status(403).json({ error: 'Vendor can only cancel their own bookings' });
    }
    if (!isVendorCancelling && cancelledBy !== booking.coupleId) {
      return res.status(403).json({ error: 'Couple can only cancel their own bookings' });
    }

    let cancellationFee = null;
    let cancellationFeePaymentId = null;

    // Require a cancellation reason for both couple and vendor cancellations
    if (!data.reason || !data.reason.trim()) {
      return res.status(400).json({
        error: 'Cancellation reason is required',
      });
    }

    // Calculate fee only for couple cancellations
    if (!isVendorCancelling) {
      const firstService = booking.selectedServices[0];
      if (firstService) {
        const feeCalculation = calculateCancellationFeeAndPayment(
          booking,
          firstService.serviceListing
        );

        cancellationFee = feeCalculation.feeAmount;

        // If fee is 0 or no payment required, proceed with cancellation
        // If payment is required, return error asking to pay first
        if (feeCalculation.requiresPayment) {
          // Send notification about cancellation fee requirement
          notificationService.sendCancellationFeeRequiredNotification(booking, feeCalculation).catch((err) => {
            console.error('Error sending cancellation fee required notification:', err);
          });

          return res.status(400).json({
            error: 'Cancellation fee payment required before cancellation',
            feeCalculation: {
              feeAmount: feeCalculation.feeAmount,
              amountPaid: feeCalculation.amountPaid,
              feeDifference: feeCalculation.feeDifference,
              requiresPayment: true,
            },
          });
        }
      }
    }

    // Create cancellation record and update booking status
    const newStatus = isVendorCancelling ? 'cancelled_by_vendor' : 'cancelled_by_couple';

    // Calculate refund for vendor cancellations
    // If vendor cancels, couple should get full refund of all payments made
    let refundRequired = false;
    let refundAmount = null;
    let refundStatus = 'not_applicable';
    
    if (isVendorCancelling) {
      // Calculate total amount paid by couple
      const totalPaid = booking.payments.reduce((sum, payment) => {
        return sum + Number(payment.amount);
      }, 0);
      
      if (totalPaid > 0) {
        refundRequired = true;
        refundAmount = totalPaid;
        refundStatus = 'pending';
      }
    }

    await prisma.$transaction(async (tx) => {
      // Create cancellation record
      await tx.cancellation.create({
        data: {
          id: prefixedUlid('cncl'),
          bookingId: booking.id,
          cancelledBy,
          cancellationReason: data.reason ? data.reason.trim() : null,
          cancellationFee,
          cancellationFeePaymentId,
          refundRequired,
          refundAmount: refundAmount ? refundAmount : null,
          refundStatus,
        },
      });

      // Update booking status
      await tx.booking.update({
        where: { id: booking.id },
        data: { status: newStatus },
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

    const cancellation = await prisma.cancellation.findUnique({
      where: { bookingId: booking.id },
    });

    // If this is a venue booking cancellation, handle dependent bookings
    // Check based on service listing category, not vendor category
    const isVenueBooking = booking.selectedServices?.some(
      (service) => service.serviceListing?.category === 'Venue'
    ) ?? false;
    if (isVenueBooking && booking.dependentBookings && booking.dependentBookings.length > 0) {
      const venueCancellationReason = data.reason ? data.reason.trim() : 'Venue booking cancelled';
      const cancellationDate = new Date();
      
      // Get wedding date for grace period calculation
      const project = await prisma.weddingProject.findUnique({
        where: { id: booking.projectId },
        select: { weddingDate: true },
      });
      
      const weddingDate = project?.weddingDate 
        ? new Date(project.weddingDate)
        : new Date(booking.reservedDate);
      
      // Calculate grace period: min(14 days, days until wedding)
      const daysUntilWedding = Math.ceil((weddingDate - cancellationDate) / (1000 * 60 * 60 * 24));
      const fixedGracePeriod = 14; // days
      const gracePeriodDays = Math.min(fixedGracePeriod, Math.max(0, daysUntilWedding));
      const gracePeriodEndDate = new Date(cancellationDate);
      gracePeriodEndDate.setDate(gracePeriodEndDate.getDate() + gracePeriodDays);
      
      // Cap at wedding date
      if (gracePeriodEndDate > weddingDate) {
        gracePeriodEndDate.setTime(weddingDate.getTime());
      }
      
      // Update dependent bookings with grace period fields
      for (const dependentBooking of booking.dependentBookings) {
        // Skip if due dates already passed (booking should be cancelled)
        const today = new Date();
        const depositDuePassed = dependentBooking.depositDueDate && new Date(dependentBooking.depositDueDate) < today;
        const finalDuePassed = dependentBooking.finalDueDate && new Date(dependentBooking.finalDueDate) < today;
        
        if (depositDuePassed || finalDuePassed) {
          console.log(`⚠️ Skipping grace period setup for booking ${dependentBooking.id} - due dates already passed`);
          continue;
        }
        
        // Set grace period fields and extend due dates
        await prisma.booking.update({
          where: { id: dependentBooking.id },
          data: {
            isPendingVenueReplacement: true,
            originalDepositDueDate: dependentBooking.depositDueDate,
            originalFinalDueDate: dependentBooking.finalDueDate,
            venueCancellationDate: cancellationDate,
            gracePeriodEndDate: gracePeriodEndDate,
            depositDueDate: gracePeriodEndDate,
            finalDueDate: gracePeriodEndDate,
          },
        });
      }
      
      // Send notifications to couple and vendors about venue cancellation
      notificationService.sendVenueCancellationNotification(booking, booking.dependentBookings, venueCancellationReason).catch((err) => {
        console.error('Error sending venue cancellation notification:', err);
      });

      // Notify each dependent vendor about venue cancellation
      for (const dependentBooking of booking.dependentBookings) {
        notificationService.sendVenueCancellationVendorNotification(dependentBooking, booking, venueCancellationReason).catch((err) => {
          console.error(`Error sending venue cancellation notification to vendor for booking ${dependentBooking.id}:`, err);
        });
      }

      console.log(`⚠️ Venue booking ${booking.id} cancelled. ${booking.dependentBookings.length} dependent booking(s) will be auto-cancelled on ${gracePeriodEndDate.toISOString()} if no replacement venue is selected.`);
    }

    const updatedBooking = await prisma.booking.findUnique({
      where: { id: booking.id },
      include: {
        selectedServices: true,
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
        payments: true,
      },
    });

    notificationService.sendCancellationCompletedNotification(updatedBooking, cancellation).catch((err) => {
      console.error('Error sending cancellation completed notification:', err);
    });

    if (!isVendorCancelling) {
      notificationService.sendCancellationVendorNotification(updatedBooking, cancellation).catch((err) => {
        console.error('Error sending cancellation vendor notification:', err);
      });
    }

    res.status(201).json({
      message: 'Booking cancelled successfully',
      cancellation: {
        ...cancellation,
        cancellationFee: cancellation.cancellationFee ? cancellation.cancellationFee.toString() : null,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      const issues = err.issues.map((i) => ({ field: i.path?.[0] ?? 'unknown', message: i.message }));
      return res.status(400).json({ error: issues[0]?.message || 'Invalid input', issues });
    }
    next(err);
  }
});

// POST /bookings/:id/cancellation-fee-payment - Pay cancellation fee
const cancellationFeePaymentSchema = z.object({
  amount: z.number().positive(),
  paymentMethod: z.enum(['credit_card', 'bank_transfer', 'touch_n_go']),
  receipt: z.string().url().optional().nullable(),
  // Reason is required for couple-initiated cancellations with a fee
  reason: z.string().min(3, 'Cancellation reason is required'),
});

router.post('/:id/cancellation-fee-payment', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'couple') {
      return res.status(403).json({ error: 'Couple access required' });
    }

    const data = cancellationFeePaymentSchema.parse(req.body);

    // Check if booking exists and belongs to couple
    const booking = await prisma.booking.findFirst({
      where: {
        id: req.params.id,
        coupleId: req.user.sub,
      },
      include: {
        selectedServices: {
          include: {
            serviceListing: {
              select: {
                id: true,
                cancellationPolicy: true,
                cancellationFeeTiers: true,
              },
            },
          },
        },
        payments: true,
      },
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Check if booking can be cancelled
    const cancellableStatuses = [
      'pending_vendor_confirmation',
      'pending_deposit_payment',
      'confirmed',
      'pending_final_payment',
    ];

    if (!cancellableStatuses.includes(booking.status)) {
      return res.status(400).json({
        error: `Booking cannot be cancelled. Current status: ${booking.status}`,
      });
    }

    // Check if already cancelled
    const existingCancellation = await prisma.cancellation.findUnique({
      where: { bookingId: booking.id },
    });

    if (existingCancellation) {
      return res.status(400).json({ error: 'Booking is already cancelled' });
    }

    // Calculate cancellation fee
    const firstService = booking.selectedServices[0];
    if (!firstService) {
      return res.status(400).json({ error: 'Booking has no services' });
    }

    const feeCalculation = calculateCancellationFeeAndPayment(booking, firstService.serviceListing);

    // Validate payment amount matches required fee difference
    if (Math.abs(data.amount - feeCalculation.feeDifference) > 0.01) {
      return res.status(400).json({
        error: `Payment amount must be ${feeCalculation.feeDifference}. Received: ${data.amount}`,
        requiredAmount: feeCalculation.feeDifference,
      });
    }

    // Check if cancellation fee payment already exists
    const existingFeePayment = await prisma.payment.findFirst({
      where: {
        bookingId: booking.id,
        paymentType: 'cancellation_fee',
      },
    });

    if (existingFeePayment) {
      return res.status(400).json({ error: 'Cancellation fee payment already exists for this booking' });
    }

    // Create payment and cancellation in transaction
    let cancellation;
    await prisma.$transaction(async (tx) => {
      // Create cancellation fee payment
      const payment = await tx.payment.create({
        data: {
          bookingId: booking.id,
          paymentType: 'cancellation_fee',
          amount: data.amount,
          paymentMethod: data.paymentMethod,
          receipt: data.receipt || null,
        },
      });

      // Create cancellation record
      cancellation = await tx.cancellation.create({
        data: {
          id: prefixedUlid('cncl'),
          bookingId: booking.id,
          cancelledBy: booking.coupleId,
          cancellationReason: data.reason.trim(),
          cancellationFee: feeCalculation.feeAmount,
          cancellationFeePaymentId: payment.id,
        },
      });

      // Update booking status
      await tx.booking.update({
        where: { id: booking.id },
        data: { status: 'cancelled_by_couple' },
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
    const updatedBooking = await prisma.booking.findUnique({
      where: { id: booking.id },
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
      },
    });

    notificationService.sendCancellationCompletedNotification(updatedBooking, cancellation).catch((err) => {
      console.error('Error sending cancellation completed notification:', err);
    });

    res.status(201).json({
      message: 'Cancellation fee paid and booking cancelled successfully',
      cancellation: {
        ...cancellation,
        cancellationFee: cancellation.cancellationFee ? cancellation.cancellationFee.toString() : null,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      const issues = err.issues.map((i) => ({ field: i.path?.[0] ?? 'unknown', message: i.message }));
      return res.status(400).json({ error: issues[0]?.message || 'Invalid input', issues });
    }
    next(err);
  }
});

module.exports = router;

