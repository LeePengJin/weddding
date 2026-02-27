const express = require('express');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Validation schema for time slot
const timeSlotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  status: z.enum(['personal_time_off']).default('personal_time_off'),
});

// GET /time-slots - Get all time slots (unavailable dates) for the authenticated vendor
router.get('/', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ error: 'Vendor access required' });
    }

    const timeSlots = await prisma.timeSlot.findMany({
      where: { vendorId: req.user.sub },
      orderBy: { date: 'asc' },
    });

    res.json(timeSlots);
  } catch (err) {
    next(err);
  }
});

// GET /time-slots/range - Get time slots within a date range
router.get('/range', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ error: 'Vendor access required' });
    }

    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate query parameters are required' });
    }

    const timeSlots = await prisma.timeSlot.findMany({
      where: {
        vendorId: req.user.sub,
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      orderBy: { date: 'asc' },
    });

    res.json(timeSlots);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ error: 'Vendor access required' });
    }

    const { date, status } = timeSlotSchema.parse(req.body);

    const finalStatus = 'personal_time_off';

    const [year, month, day] = date.split('-').map(Number);
    const slotDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

    const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    const endOfDayExclusive = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0));

    const blockingBookings = await prisma.booking.findMany({
      where: {
        vendorId: req.user.sub,
        reservedDate: { gte: startOfDay, lt: endOfDayExclusive },
        status: {
          notIn: ['cancelled_by_couple', 'cancelled_by_vendor', 'rejected', 'completed'],
        },
      },
      select: {
        id: true,
        status: true,
        reservedDate: true,
        project: {
          select: {
            id: true,
            projectName: true,
          },
        },
        couple: {
          select: {
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
      orderBy: { reservedDate: 'asc' },
    });

    if (blockingBookings.length > 0) {
      return res.status(409).json({
        error:
          'You have existing booking(s) on this date. Cancel those bookings (with a reason) before marking the date unavailable.',
        conflicts: {
          date,
          count: blockingBookings.length,
          bookings: blockingBookings.map((b) => ({
            id: b.id,
            status: b.status,
            reservedDate: b.reservedDate,
            projectId: b.project?.id || null,
            projectName: b.project?.projectName || null,
            coupleName: b.couple?.user?.name || null,
            coupleEmail: b.couple?.user?.email || null,
          })),
        },
      });
    }

    // Check if time slot already exists for this date
    const existingTimeSlot = await prisma.timeSlot.findUnique({
      where: {
        vendorId_date: {
          vendorId: req.user.sub,
          date: slotDate,
        },
      },
    });

    if (existingTimeSlot) {
      // Update existing time slot (ensure it's personal_time_off)
      const updated = await prisma.timeSlot.update({
        where: { id: existingTimeSlot.id },
        data: { status: finalStatus },
      });
      return res.json(updated);
    }

    // Create new time slot
    const timeSlot = await prisma.timeSlot.create({
      data: {
        vendorId: req.user.sub,
        date: slotDate,
        status: finalStatus,
      },
    });

    res.status(201).json(timeSlot);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const issues = err.issues.map((i) => ({ field: i.path?.[0] ?? 'unknown', message: i.message }));
      return res.status(400).json({ error: issues[0]?.message || 'Invalid input', issues });
    }
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Time slot already exists for this date' });
    }
    next(err);
  }
});

// DELETE /time-slots/:id - Delete a time slot (mark date as available)
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ error: 'Vendor access required' });
    }

    // Check if time slot exists and belongs to vendor
    const existingTimeSlot = await prisma.timeSlot.findFirst({
      where: {
        id: req.params.id,
        vendorId: req.user.sub,
      },
    });

    if (!existingTimeSlot) {
      return res.status(404).json({ error: 'Time slot not found' });
    }

    await prisma.timeSlot.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Time slot deleted successfully' });
  } catch (err) {
    next(err);
  }
});

// DELETE /time-slots/date/:date - Delete a time slot by date (mark date as available)
router.delete('/date/:date', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ error: 'Vendor access required' });
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(req.params.date)) {
      return res.status(400).json({ error: 'Date must be in YYYY-MM-DD format' });
    }

    // Check if time slot exists and belongs to vendor
    const existingTimeSlot = await prisma.timeSlot.findUnique({
      where: {
        vendorId_date: {
          vendorId: req.user.sub,
          date: new Date(req.params.date),
        },
      },
    });

    if (!existingTimeSlot) {
      return res.status(404).json({ error: 'Time slot not found for this date' });
    }

    await prisma.timeSlot.delete({
      where: { id: existingTimeSlot.id },
    });

    res.json({ message: 'Time slot deleted successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

