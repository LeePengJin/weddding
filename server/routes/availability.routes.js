const express = require('express');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Validation schemas
const checkAvailabilitySchema = z.object({
  serviceListingId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
});

const batchCheckSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  serviceListingIds: z.array(z.string().uuid()).min(1),
});

/**
 * GET /availability/check
 * Check availability for a single service listing on a specific date
 * Public endpoint (couples need to check before booking)
 */
router.get('/check', async (req, res, next) => {
  try {
    const { serviceListingId, date } = checkAvailabilitySchema.parse(req.query);
    const result = await checkServiceAvailability(serviceListingId, date);
    res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const issues = err.issues.map((i) => ({ field: i.path?.[0] ?? 'unknown', message: i.message }));
      return res.status(400).json({ error: issues[0]?.message || 'Invalid input', issues });
    }
    next(err);
  }
});

// Helper function to check availability for a single service
async function checkServiceAvailability(serviceListingId, date) {
  const serviceListing = await prisma.serviceListing.findUnique({
    where: { id: serviceListingId },
    include: {
      vendor: {
        include: {
          timeSlots: {
            where: {
              date: new Date(date),
              status: 'personal_time_off',
            },
          },
        },
      },
    },
  });

  if (!serviceListing) {
    return {
      available: false,
      reason: 'Service listing not found',
      serviceListingId,
      date,
    };
  }

  if (!serviceListing.isActive) {
    return {
      available: false,
      reason: 'Service listing is inactive',
      serviceListingId,
      date,
    };
  }

  // Check vendor-level time off
  const vendorTimeOff = serviceListing.vendor.timeSlots.length > 0;
  if (vendorTimeOff) {
    return {
      available: false,
      reason: 'Vendor is unavailable on this date',
      serviceListingId,
      date,
    };
  }

  const targetDate = new Date(date);
  const availabilityType = serviceListing.availabilityType;

  // Check service-level availability based on type
  if (availabilityType === 'exclusive') {
    // Check if there's an existing booking for this service on this date
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const existingBooking = await prisma.booking.findFirst({
      where: {
        reservedDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: {
          notIn: ['cancelled', 'rejected'],
        },
        selectedServices: {
          some: {
            serviceListingId: serviceListingId,
          },
        },
      },
    });

    if (existingBooking) {
      return {
        available: false,
        reason: 'Service is already booked for this date',
        serviceListingId,
        date,
      };
    }

    return {
      available: true,
      serviceListingId,
      date,
      availabilityType,
    };
  } else if (availabilityType === 'reusable') {
    // Reusable services are always available (unless vendor time off)
    return {
      available: true,
      serviceListingId,
      date,
      availabilityType,
    };
  } else if (availabilityType === 'quantity_based') {
    // Check available quantity
    const serviceAvailability = await prisma.serviceAvailability.findUnique({
      where: {
        serviceListingId_date: {
          serviceListingId: serviceListingId,
          date: targetDate,
        },
      },
    });

    // Get max quantity from service listing or availability record
    const maxQuantity = serviceAvailability?.maxQuantity || serviceListing.maxQuantity || 0;

    // Count booked quantity
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const bookedBookings = await prisma.booking.findMany({
      where: {
        reservedDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: {
          notIn: ['cancelled', 'rejected'],
        },
        selectedServices: {
          some: {
            serviceListingId: serviceListingId,
          },
        },
      },
      include: {
        selectedServices: {
          where: {
            serviceListingId: serviceListingId,
          },
        },
      },
    });

    const bookedQuantity = bookedBookings.reduce((sum, booking) => {
      return (
        sum +
        booking.selectedServices.reduce((qtySum, service) => qtySum + service.quantity, 0)
      );
    }, 0);

    const availableQuantity = maxQuantity - bookedQuantity;

    return {
      available: availableQuantity > 0,
      availableQuantity: Math.max(0, availableQuantity),
      maxQuantity,
      bookedQuantity,
      serviceListingId,
      date,
      availabilityType,
    };
  }

  // Default: not available
  return {
    available: false,
    reason: 'Unknown availability type',
    serviceListingId,
    date,
  };
}

/**
 * POST /availability/batch-check
 * Check availability for multiple service listings on a specific date
 * Public endpoint (for project summary page)
 */
router.post('/batch-check', async (req, res, next) => {
  try {
    const { date, serviceListingIds } = batchCheckSchema.parse(req.body);

    const results = {};

    // Check each service listing in parallel
    const checks = serviceListingIds.map((serviceListingId) =>
      checkServiceAvailability(serviceListingId, date)
        .then((result) => ({ serviceListingId, result }))
        .catch((err) => ({
          serviceListingId,
          result: {
            available: false,
            reason: 'Error checking availability',
            error: err.message,
          },
        }))
    );

    const checkResults = await Promise.all(checks);
    checkResults.forEach(({ serviceListingId, result }) => {
      results[serviceListingId] = result;
    });

    res.json({
      date,
      results,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      const issues = err.issues.map((i) => ({ field: i.path?.[0] ?? 'unknown', message: i.message }));
      return res.status(400).json({ error: issues[0]?.message || 'Invalid input', issues });
    }
    next(err);
  }
});

/**
 * GET /availability/service/:serviceListingId
 * Get availability information for a service listing (for vendors to view)
 * Requires vendor authentication
 */
router.get('/service/:serviceListingId', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ error: 'Vendor access required' });
    }

    const { serviceListingId } = req.params;

    const serviceListing = await prisma.serviceListing.findFirst({
      where: {
        id: serviceListingId,
        vendorId: req.user.sub,
      },
      include: {
        serviceAvailability: {
          orderBy: {
            date: 'asc',
          },
        },
      },
    });

    if (!serviceListing) {
      return res.status(404).json({ error: 'Service listing not found' });
    }

    res.json({
      serviceListing: {
        id: serviceListing.id,
        name: serviceListing.name,
        availabilityType: serviceListing.availabilityType,
        maxQuantity: serviceListing.maxQuantity,
      },
      availability: serviceListing.serviceAvailability,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

