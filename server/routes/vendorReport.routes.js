const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Middleware to ensure user is a vendor
function requireVendor(req, res, next) {
  if (req.user?.role !== 'vendor') {
    return res.status(403).json({ error: 'Forbidden: Vendor access required' });
  }
  next();
}

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

// 1. Booking Performance - Bookings over time
router.get('/bookings-over-time', requireAuth, requireVendor, async (req, res, next) => {
  try {
    const { startDate, endDate, granularity = 'monthly' } = req.query;
    const vendorId = req.user.sub;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    const bookings = await prisma.booking.findMany({
      where: {
        vendorId,
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

    // Group by date and count
    const grouped = {};
    bookings.forEach(booking => {
      const key = groupByDate(booking.bookingDate, granularity);
      if (!grouped[key]) {
        grouped[key] = { date: key, count: 0 };
      }
      grouped[key].count++;
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

// 2. Booking Performance - Bookings by service listing
router.get('/bookings-by-service', requireAuth, requireVendor, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const vendorId = req.user.sub;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    const bookings = await prisma.booking.findMany({
      where: {
        vendorId,
        bookingDate: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      include: {
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

    const serviceCounts = {};
    bookings.forEach(booking => {
      booking.selectedServices.forEach(service => {
        const listingId = service.serviceListingId;
        const listingName = service.serviceListing.name;
        if (!serviceCounts[listingId]) {
          serviceCounts[listingId] = { id: listingId, name: listingName, count: 0 };
        }
        serviceCounts[listingId].count++;
      });
    });

    const result = Object.values(serviceCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// 3. Booking Performance - Booking conversion rate
router.get('/booking-conversion', requireAuth, requireVendor, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const vendorId = req.user.sub;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    const bookings = await prisma.booking.findMany({
      where: {
        vendorId,
        bookingDate: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      select: {
        status: true,
      },
    });

    const total = bookings.length;
    const confirmed = bookings.filter(b => 
      ['confirmed', 'pending_final_payment', 'completed'].includes(b.status)
    ).length;
    const rejected = bookings.filter(b => b.status === 'rejected').length;
    const cancelled = bookings.filter(b => 
      ['cancelled_by_couple', 'cancelled_by_vendor'].includes(b.status)
    ).length;
    const pending = bookings.filter(b => 
      ['pending_vendor_confirmation', 'pending_deposit_payment'].includes(b.status)
    ).length;

    const conversionRate = total > 0 ? (confirmed / total) * 100 : 0;

    res.json({
      data: {
        total,
        confirmed,
        rejected,
        cancelled,
        pending,
        conversionRate: Math.round(conversionRate * 100) / 100,
      },
    });
  } catch (err) {
    next(err);
  }
});

// 4. Revenue Analytics - Total revenue over time
router.get('/revenue-over-time', requireAuth, requireVendor, async (req, res, next) => {
  try {
    const { startDate, endDate, granularity = 'monthly' } = req.query;
    const vendorId = req.user.sub;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    const payments = await prisma.payment.findMany({
      where: {
        booking: {
          vendorId,
          bookingDate: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        },
      },
      select: {
        paymentDate: true,
        amount: true,
        paymentType: true,
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

// 5. Revenue Analytics - Revenue by service listing
router.get('/revenue-by-service', requireAuth, requireVendor, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const vendorId = req.user.sub;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    const bookings = await prisma.booking.findMany({
      where: {
        vendorId,
        bookingDate: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      include: {
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
        payments: {
          select: {
            amount: true,
          },
        },
      },
    });

    const serviceRevenue = {};
    bookings.forEach(booking => {
      // Calculate total booked value for this booking
      const totalBookedValue = booking.selectedServices.reduce(
        (sum, service) => sum + parseFloat(service.totalPrice || 0),
        0
      );

      // Allocate payments proportionally to each service
      const totalPayments = booking.payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);

      booking.selectedServices.forEach(service => {
        const listingId = service.serviceListingId;
        const listingName = service.serviceListing.name;
        if (!serviceRevenue[listingId]) {
          serviceRevenue[listingId] = { id: listingId, name: listingName, revenue: 0 };
        }
        
        // Allocate payment proportionally based on service's share of total booked value
        if (totalBookedValue > 0) {
          const serviceShare = parseFloat(service.totalPrice || 0) / totalBookedValue;
          serviceRevenue[listingId].revenue += totalPayments * serviceShare;
        } else {
          // Fallback: use booked price if no payments yet
          serviceRevenue[listingId].revenue += parseFloat(service.totalPrice || 0);
        }
      });
    });

    const result = Object.values(serviceRevenue)
      .map(item => ({
        ...item,
        revenue: Math.round(item.revenue * 100) / 100,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10); // Top 10

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// 6. Revenue Analytics - Revenue by payment type
router.get('/revenue-by-payment-type', requireAuth, requireVendor, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const vendorId = req.user.sub;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    const payments = await prisma.payment.findMany({
      where: {
        booking: {
          vendorId,
          bookingDate: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        },
      },
      select: {
        paymentType: true,
        amount: true,
      },
    });

    const revenueByType = {
      deposit: 0,
      final: 0,
      cancellation_fee: 0,
    };

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
      .filter(item => item.revenue > 0); // Only show payment types with revenue

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// 7. Service Listing Performance - Most booked listings
router.get('/most-booked-listings', requireAuth, requireVendor, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const vendorId = req.user.sub;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    const bookings = await prisma.booking.findMany({
      where: {
        vendorId,
        bookingDate: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      include: {
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

    const listingCounts = {};
    bookings.forEach(booking => {
      booking.selectedServices.forEach(service => {
        const listingId = service.serviceListingId;
        const listingName = service.serviceListing.name;
        if (!listingCounts[listingId]) {
          listingCounts[listingId] = { id: listingId, name: listingName, bookings: 0 };
        }
        listingCounts[listingId].bookings++;
      });
    });

    const result = Object.values(listingCounts)
      .sort((a, b) => b.bookings - a.bookings)
      .slice(0, 10); // Top 10

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// 8. Service Listing Performance - Average rating per listing
router.get('/average-rating-by-listing', requireAuth, requireVendor, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const vendorId = req.user.sub;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    const reviews = await prisma.review.findMany({
      where: {
        serviceListing: {
          vendorId,
        },
        reviewDate: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      select: {
        serviceListingId: true,
        rating: true,
        serviceListing: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const listingRatings = {};
    reviews.forEach(review => {
      const listingId = review.serviceListingId;
      const listingName = review.serviceListing.name;
      if (!listingRatings[listingId]) {
        listingRatings[listingId] = {
          id: listingId,
          name: listingName,
          ratings: [],
          averageRating: 0,
        };
      }
      listingRatings[listingId].ratings.push(review.rating);
    });

    const result = Object.values(listingRatings)
      .map(item => {
        const sum = item.ratings.reduce((a, b) => a + b, 0);
        const avg = item.ratings.length > 0 ? sum / item.ratings.length : 0;
        return {
          id: item.id,
          name: item.name,
          averageRating: Math.round(avg * 100) / 100,
          reviewCount: item.ratings.length,
        };
      })
      .sort((a, b) => b.averageRating - a.averageRating)
      .slice(0, 10); // Top 10

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// 9. Financial Summary - Total earnings, pending earnings, earnings by month/quarter
router.get('/financial-summary', requireAuth, requireVendor, async (req, res, next) => {
  try {
    const { startDate, endDate, period = 'monthly' } = req.query;
    const vendorId = req.user.sub;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    const payments = await prisma.payment.findMany({
      where: {
        booking: {
          vendorId,
          bookingDate: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        },
      },
      select: {
        amount: true,
        releasedToVendor: true,
        paymentDate: true,
      },
    });

    const totalEarnings = payments
      .filter(p => p.releasedToVendor)
      .reduce((sum, p) => sum + parseFloat(p.amount), 0);

    const pendingEarnings = payments
      .filter(p => !p.releasedToVendor)
      .reduce((sum, p) => sum + parseFloat(p.amount), 0);

    // Group earnings by period
    const earningsByPeriod = {};
    payments
      .filter(p => p.releasedToVendor)
      .forEach(payment => {
        let key;
        if (period === 'monthly') {
          const d = new Date(payment.paymentDate);
          key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        } else if (period === 'quarterly') {
          const d = new Date(payment.paymentDate);
          const quarter = Math.floor(d.getMonth() / 3) + 1;
          key = `${d.getFullYear()}-Q${quarter}`;
        } else {
          key = groupByDate(payment.paymentDate, 'monthly');
        }

        if (!earningsByPeriod[key]) {
          earningsByPeriod[key] = { period: key, earnings: 0 };
        }
        earningsByPeriod[key].earnings += parseFloat(payment.amount);
      });

    const earningsData = Object.values(earningsByPeriod)
      .map(item => ({
        period: item.period,
        earnings: Math.round(item.earnings * 100) / 100,
      }))
      .sort((a, b) => a.period.localeCompare(b.period));

    res.json({
      data: {
        totalEarnings: Math.round(totalEarnings * 100) / 100,
        pendingEarnings: Math.round(pendingEarnings * 100) / 100,
        earningsByPeriod: earningsData,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
