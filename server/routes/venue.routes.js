const express = require('express');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// Validation schema for venue search
const searchVenuesSchema = z.object({
  search: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  location: z.string().optional(),
  minPrice: z.string().optional().transform((val) => (val ? parseFloat(val) : undefined)),
  maxPrice: z.string().optional().transform((val) => (val ? parseFloat(val) : undefined)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 20)),
  offset: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 0)),
});

/**
 * GET /venues/search
 * Search for venue service listings
 * Public endpoint (couples need to search before selecting)
 */
router.get('/search', async (req, res, next) => {
  try {
    const query = searchVenuesSchema.parse(req.query);

    const where = {
      category: 'Venue',
      isActive: true,
    };

    // Search by name or description
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    // Filter by location (vendor location)
    if (query.location) {
      where.vendor = {
        location: { contains: query.location, mode: 'insensitive' },
      };
    }

    // Filter by price range
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.price = {};
      if (query.minPrice !== undefined) {
        where.price.gte = query.minPrice;
      }
      if (query.maxPrice !== undefined) {
        where.price.lte = query.maxPrice;
      }
    }

    const [venues, total] = await Promise.all([
      prisma.serviceListing.findMany({
        where,
        include: {
          vendor: {
            include: {
              user: {
                select: {
                  name: true,
                  email: true,
                },
              },
            },
          },
          reviews: {
            select: {
              rating: true,
            },
          },
        },
        orderBy: [
          { averageRating: 'desc' },
          { createdAt: 'desc' },
        ],
        take: query.limit,
        skip: query.offset,
      }),
      prisma.serviceListing.count({ where }),
    ]);

    // Calculate average rating if not set
    const venuesWithRating = venues.map((venue) => {
      if (!venue.averageRating && venue.reviews.length > 0) {
        const avgRating =
          venue.reviews.reduce((sum, review) => sum + review.rating, 0) / venue.reviews.length;
        return {
          ...venue,
          averageRating: Math.round(avgRating * 100) / 100,
        };
      }
      return venue;
    });

    res.json({
      venues: venuesWithRating,
      total,
      limit: query.limit,
      offset: query.offset,
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
 * GET /venues/:id
 * Get a specific venue service listing with availability info
 * Public endpoint
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { date } = req.query;

    const venue = await prisma.serviceListing.findFirst({
      where: {
        id: req.params.id,
        category: 'Venue',
        isActive: true,
      },
      include: {
        vendor: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
                contactNumber: true,
              },
            },
          },
        },
        reviews: {
          include: {
            reviewer: {
              select: {
                name: true,
              },
            },
          },
          orderBy: { reviewDate: 'desc' },
          take: 10,
        },
        components: {
          include: {
            designElement: true,
          },
        },
      },
    });

    if (!venue) {
      return res.status(404).json({ error: 'Venue not found' });
    }

    // Note: Availability check should be done via separate API call from frontend
    // using GET /availability/check?serviceListingId=:id&date=:date
    // This keeps the endpoints clean and avoids circular dependencies

    res.json(venue);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

