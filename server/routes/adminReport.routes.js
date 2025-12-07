const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Helper function to group dates by granularity
function groupByDate(date, granularity) {
  const d = new Date(date);
  if (granularity === 'daily') {
    return d.toISOString().split('T')[0]; // YYYY-MM-DD
  } else if (granularity === 'weekly') {
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay()); // Start of week (Sunday)
    return weekStart.toISOString().split('T')[0];
  } else if (granularity === 'monthly') {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
  }
  return d.toISOString().split('T')[0];
}

// Helper function to format date labels
function formatDateLabel(dateStr, granularity) {
  if (granularity === 'daily') {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } else if (granularity === 'weekly') {
    const date = new Date(dateStr);
    const weekEnd = new Date(date);
    weekEnd.setDate(date.getDate() + 6);
    return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  } else if (granularity === 'monthly') {
    const [year, month] = dateStr.split('-');
    return new Date(year, parseInt(month) - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  return dateStr;
}

// 1. User Growth & Analytics - User growth over time
router.get('/user-growth', requireAdmin, async (req, res, next) => {
  try {
    const { startDate, endDate, granularity = 'monthly', role } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    const where = {
      createdAt: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
    };

    if (role) {
      where.role = role;
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        createdAt: true,
        role: true,
        status: true,
      },
    });

    const grouped = {};
    users.forEach(user => {
      const key = groupByDate(user.createdAt, granularity);
      if (!grouped[key]) {
        grouped[key] = { date: key, count: 0, couples: 0, vendors: 0 };
      }
      grouped[key].count += 1;
      if (user.role === 'couple') grouped[key].couples += 1;
      if (user.role === 'vendor') grouped[key].vendors += 1;
    });

    const result = Object.values(grouped)
      .map(item => ({
        date: item.date,
        label: formatDateLabel(item.date, granularity),
        count: item.count,
        couples: item.couples,
        vendors: item.vendors,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// 1. User Growth & Analytics - User status breakdown
router.get('/user-status-breakdown', requireAdmin, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const where = {};
    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const users = await prisma.user.groupBy({
      by: ['status'],
      where,
      _count: {
        id: true,
      },
    });

    const result = users.map(item => ({
      status: item.status,
      count: item._count.id,
    }));

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// 2. Booking Analytics - Bookings over time
router.get('/bookings-over-time', requireAdmin, async (req, res, next) => {
  try {
    const { startDate, endDate, granularity = 'monthly' } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    const bookings = await prisma.booking.findMany({
      where: {
        bookingDate: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      select: {
        bookingDate: true,
        status: true,
      },
    });

    const grouped = {};
    bookings.forEach(booking => {
      const key = groupByDate(booking.bookingDate, granularity);
      if (!grouped[key]) {
        grouped[key] = { date: key, count: 0 };
      }
      grouped[key].count += 1;
    });

    const result = Object.values(grouped)
      .map(item => ({
        date: item.date,
        label: formatDateLabel(item.date, granularity),
        count: item.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// 2. Booking Analytics - Booking status breakdown
router.get('/booking-status-breakdown', requireAdmin, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const where = {};
    if (startDate && endDate) {
      where.bookingDate = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const bookings = await prisma.booking.groupBy({
      by: ['status'],
      where,
      _count: {
        id: true,
      },
    });

    const result = bookings.map(item => ({
      status: item.status,
      count: item._count.id,
    }));

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// 2. Booking Analytics - Bookings by vendor category
router.get('/bookings-by-category', requireAdmin, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    const bookings = await prisma.booking.findMany({
      where: {
        bookingDate: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      include: {
        vendor: {
          include: {
            user: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    const categoryCounts = {};
    bookings.forEach(booking => {
      const category = booking.vendor.category;
      if (!categoryCounts[category]) {
        categoryCounts[category] = 0;
      }
      categoryCounts[category] += 1;
    });

    const result = Object.entries(categoryCounts)
      .map(([category, count]) => ({
        category,
        count,
      }))
      .sort((a, b) => b.count - a.count);

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// 3. Revenue Analytics - Total revenue over time
router.get('/revenue-over-time', requireAdmin, async (req, res, next) => {
  try {
    const { startDate, endDate, granularity = 'monthly' } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    const payments = await prisma.payment.findMany({
      where: {
        paymentDate: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      select: {
        paymentDate: true,
        amount: true,
      },
    });

    const grouped = {};
    payments.forEach(payment => {
      const key = groupByDate(payment.paymentDate, granularity);
      if (!grouped[key]) {
        grouped[key] = { date: key, revenue: 0 };
      }
      grouped[key].revenue += parseFloat(payment.amount);
    });

    const result = Object.values(grouped)
      .map(item => ({
        date: item.date,
        label: formatDateLabel(item.date, granularity),
        revenue: Math.round(item.revenue * 100) / 100,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// 3. Revenue Analytics - Revenue by payment type
router.get('/revenue-by-payment-type', requireAdmin, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    const payments = await prisma.payment.findMany({
      where: {
        paymentDate: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      select: {
        paymentType: true,
        amount: true,
      },
    });

    const revenueByType = { deposit: 0, final: 0, cancellation_fee: 0 };
    payments.forEach(payment => {
      const type = payment.paymentType;
      if (revenueByType.hasOwnProperty(type)) {
        revenueByType[type] += parseFloat(payment.amount);
      }
    });

    const result = Object.entries(revenueByType)
      .map(([type, revenue]) => ({
        type: type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        revenue: Math.round(revenue * 100) / 100,
      }))
      .filter(item => item.revenue > 0);

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// 3. Revenue Analytics - Revenue by vendor category
router.get('/revenue-by-category', requireAdmin, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    const payments = await prisma.payment.findMany({
      where: {
        paymentDate: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      include: {
        booking: {
          include: {
            vendor: {
              select: {
                category: true,
              },
            },
          },
        },
      },
    });

    const categoryRevenue = {};
    payments.forEach(payment => {
      const category = payment.booking.vendor.category;
      if (!categoryRevenue[category]) {
        categoryRevenue[category] = 0;
      }
      categoryRevenue[category] += parseFloat(payment.amount);
    });

    const result = Object.entries(categoryRevenue)
      .map(([category, revenue]) => ({
        category,
        revenue: Math.round(revenue * 100) / 100,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// 4. Vendor Performance - Top performing vendors by revenue
router.get('/top-vendors-by-revenue', requireAdmin, async (req, res, next) => {
  try {
    const { startDate, endDate, limit = 10 } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    // First, get all bookings in the date range to identify all vendors
    const bookings = await prisma.booking.findMany({
      where: {
        bookingDate: {
          gte: new Date(startDate),
          lte: new Date(endDate),
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
      },
    });

    // Initialize vendor data with all vendors who have bookings
    const vendorRevenue = {};
    bookings.forEach(booking => {
      const vendorId = booking.vendorId;
      const vendorName = booking.vendor.user.name || 'Unknown';
      if (!vendorRevenue[vendorId]) {
        vendorRevenue[vendorId] = { id: vendorId, name: vendorName, revenue: 0, bookings: 0 };
      }
      vendorRevenue[vendorId].bookings += 1;
    });

    // Then, get all payments and add revenue
    const payments = await prisma.payment.findMany({
      where: {
        paymentDate: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      include: {
        booking: {
          select: {
            vendorId: true,
          },
        },
      },
    });

    payments.forEach(payment => {
      const vendorId = payment.booking.vendorId;
      if (vendorRevenue[vendorId]) {
        vendorRevenue[vendorId].revenue += parseFloat(payment.amount);
      }
    });

    const result = Object.values(vendorRevenue)
      .map(item => ({ ...item, revenue: Math.round(item.revenue * 100) / 100 }))
      .filter(item => item.revenue > 0) // Only include vendors with revenue
      .sort((a, b) => {
        // Sort by revenue first, then by bookings if revenue is the same
        if (b.revenue !== a.revenue) {
          return b.revenue - a.revenue;
        }
        return b.bookings - a.bookings;
      })
      .slice(0, parseInt(limit));

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// 4. Vendor Performance - Top performing vendors by bookings
router.get('/top-vendors-by-bookings', requireAdmin, async (req, res, next) => {
  try {
    const { startDate, endDate, limit = 10 } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    const bookings = await prisma.booking.findMany({
      where: {
        bookingDate: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      include: {
        vendor: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    const vendorBookings = {};
    bookings.forEach(booking => {
      const vendorId = booking.vendorId;
      const vendorName = booking.vendor.user.name || 'Unknown';
      if (!vendorBookings[vendorId]) {
        vendorBookings[vendorId] = { id: vendorId, name: vendorName, count: 0 };
      }
      vendorBookings[vendorId].count += 1;
    });

    const result = Object.values(vendorBookings)
      .sort((a, b) => b.count - a.count)
      .slice(0, parseInt(limit));

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// 4. Vendor Performance - Average rating by vendor
router.get('/vendor-ratings', requireAdmin, async (req, res, next) => {
  try {
    const { startDate, endDate, limit = 10 } = req.query;

    const where = {};
    if (startDate && endDate) {
      where.reviewDate = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const reviews = await prisma.review.findMany({
      where,
      include: {
        serviceListing: {
          include: {
            vendor: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const vendorRatings = {};
    reviews.forEach(review => {
      const vendorId = review.serviceListing.vendorId;
      const vendorName = review.serviceListing.vendor.user.name || 'Unknown';
      if (!vendorRatings[vendorId]) {
        vendorRatings[vendorId] = { id: vendorId, name: vendorName, totalRating: 0, count: 0 };
      }
      vendorRatings[vendorId].totalRating += review.rating;
      vendorRatings[vendorId].count += 1;
    });

    const result = Object.values(vendorRatings)
      .map(item => ({
        ...item,
        averageRating: Math.round((item.totalRating / item.count) * 10) / 10,
      }))
      .sort((a, b) => b.averageRating - a.averageRating)
      .slice(0, parseInt(limit));

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// 5. Cancellation & Refund Analytics - Cancellations over time
router.get('/cancellations-over-time', requireAdmin, async (req, res, next) => {
  try {
    const { startDate, endDate, granularity = 'monthly' } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    const bookings = await prisma.booking.findMany({
      where: {
        bookingDate: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
        status: {
          in: ['cancelled_by_couple', 'cancelled_by_vendor'],
        },
      },
      select: {
        bookingDate: true,
        status: true,
      },
    });

    const grouped = {};
    bookings.forEach(booking => {
      const key = groupByDate(booking.bookingDate, granularity);
      if (!grouped[key]) {
        grouped[key] = { date: key, count: 0, byCouple: 0, byVendor: 0 };
      }
      grouped[key].count += 1;
      if (booking.status === 'cancelled_by_couple') grouped[key].byCouple += 1;
      if (booking.status === 'cancelled_by_vendor') grouped[key].byVendor += 1;
    });

    const result = Object.values(grouped)
      .map(item => ({
        date: item.date,
        label: formatDateLabel(item.date, granularity),
        count: item.count,
        byCouple: item.byCouple,
        byVendor: item.byVendor,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// 5. Cancellation & Refund Analytics - Cancellation reasons (if available in future)
router.get('/cancellation-breakdown', requireAdmin, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const where = {
      status: {
        in: ['cancelled_by_couple', 'cancelled_by_vendor'],
      },
    };

    if (startDate && endDate) {
      where.bookingDate = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const bookings = await prisma.booking.groupBy({
      by: ['status'],
      where,
      _count: {
        id: true,
      },
    });

    const result = bookings.map(item => ({
      status: item.status,
      count: item._count.id,
    }));

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// Summary statistics
router.get('/summary', requireAdmin, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    const [totalUsers, totalBookings, totalRevenue, totalCancellations] = await Promise.all([
      prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        },
      }),
      prisma.booking.count({
        where: {
          bookingDate: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        },
      }),
      prisma.payment.aggregate({
        where: {
          paymentDate: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        },
        _sum: {
          amount: true,
        },
      }),
      prisma.booking.count({
        where: {
          bookingDate: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
          status: {
            in: ['cancelled_by_couple', 'cancelled_by_vendor'],
          },
        },
      }),
    ]);

    res.json({
      data: {
        totalUsers,
        totalBookings,
        totalRevenue: parseFloat(totalRevenue._sum.amount || 0),
        totalCancellations,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
