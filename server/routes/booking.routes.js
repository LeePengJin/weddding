const express = require('express');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Validation schema for booking status update
const bookingStatusSchema = z.object({
  status: z.enum([
    'pending_vendor_confirmation',
    'pending_deposit_payment',
    'confirmed',
    'pending_final_payment',
    'cancelled',
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
    } else if (req.user.role === 'couple') {
      where.coupleId = req.user.sub;
    } else {
      return res.status(403).json({ error: 'Vendor or couple access required' });
    }

    if (status) {
      where.status = status;
    }

    if (projectId) {
      where.projectId = projectId;
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
              },
            },
          },
        },
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
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
        },
      })),
      payments: booking.payments.map((payment) => ({
        ...payment,
        amount: payment.amount.toString(),
      })),
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
      pending_vendor_confirmation: ['pending_deposit_payment', 'rejected'],
      pending_deposit_payment: ['confirmed', 'cancelled'],
      confirmed: ['pending_final_payment', 'cancelled'],
      pending_final_payment: ['completed', 'cancelled'],
      rejected: [], // Cannot transition from rejected
      cancelled: [], // Cannot transition from cancelled
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
      // Create a time slot for the reserved date
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
              },
            },
          },
        },
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
      },
    });

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
    if (data.projectId) {
      const project = await prisma.weddingProject.findFirst({
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

    // Create booking
    const booking = await prisma.booking.create({
      data: {
        coupleId: req.user.sub,
        projectId: data.projectId || null,
        vendorId: data.vendorId,
        reservedDate: new Date(data.reservedDate),
        status: 'pending_vendor_confirmation',
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
              },
            },
          },
        },
      },
    });

    // Convert Decimal to string for JSON response
    const bookingWithStringPrices = {
      ...booking,
      selectedServices: booking.selectedServices.map((service) => ({
        ...service,
        totalPrice: service.totalPrice.toString(),
        serviceListing: {
          ...service.serviceListing,
          price: service.serviceListing.price.toString(),
        },
      })),
    };

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
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const data = createPaymentSchema.parse(req.body);

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
    if (data.paymentType === 'deposit') {
      newStatus = 'confirmed';
    } else if (data.paymentType === 'final') {
      newStatus = 'completed';
    }

    // Update booking status
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: newStatus },
    });

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

module.exports = router;

