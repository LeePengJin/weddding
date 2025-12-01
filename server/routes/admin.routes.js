const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { PrismaClient, VendorCategory, WeddingPackageStatus } = require('@prisma/client');
const { requireAdmin } = require('../middleware/auth');
const { approveVendor, rejectVendor } = require('../services/vendor.service');
const { sendEmail } = require('../utils/mailer');
const {
  PACKAGE_INCLUDE,
  buildPackageResponse,
  getListingSnapshot,
  validatePackageHealth,
  flagPackagesForVendor,
  revalidatePackagesForVendor,
} = require('../services/package.service');

const router = express.Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret';
const PACKAGE_STATUS_VALUES = Object.values(WeddingPackageStatus || {});

const numericField = z
  .coerce.number()
  .min(0, 'Value cannot be negative')
  .max(1000000, 'Value cannot exceed RM 1,000,000');

const packageItemSchema = z
  .object({
    id: z.string().uuid().optional(),
    label: z.string().min(3, 'Label must be at least 3 characters').max(120, 'Label cannot exceed 120 characters'),
    category: z.nativeEnum(VendorCategory),
    serviceListingId: z.string().uuid().optional().nullable(),
    isRequired: z.boolean().optional().default(true),
    minPrice: numericField.optional().nullable(),
    maxPrice: numericField.optional().nullable(),
    replacementTags: z.array(z.string().min(1).max(30)).max(6, 'Maximum 6 replacement tags').optional().default([]),
    notes: z.string().max(500).optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.minPrice !== null && data.minPrice !== undefined && data.maxPrice !== null && data.maxPrice !== undefined) {
        return data.minPrice <= data.maxPrice;
      }
      return true;
    },
    { message: 'Min price cannot exceed max price', path: ['maxPrice'] }
  );

const packagePayloadSchema = z.object({
  packageName: z.string().min(3, 'Package name must be at least 3 characters').max(120, 'Package name cannot exceed 120 characters'),
  description: z.string().max(2000).optional().nullable(),
  previewImage: z.string().url('Preview image must be a valid URL').optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  items: z.array(packageItemSchema).min(1, 'At least one service or slot is required'),
});

const packageStatusSchema = z.object({
  status: z.nativeEnum(WeddingPackageStatus, {
    errorMap: () => ({ message: 'Invalid package status' }),
  }),
});

async function buildPackageItemWriteData(item) {
  const snapshot = item.serviceListingId ? await getListingSnapshot(prisma, item.serviceListingId) : null;

  if (item.serviceListingId && !snapshot) {
    const error = new Error('Service listing not found');
    error.status = 404;
    throw error;
  }

  return {
    label: item.label,
    category: item.category,
    serviceListingId: item.serviceListingId || null,
    isRequired: item.isRequired ?? true,
    minPrice: item.minPrice ?? null,
    maxPrice: item.maxPrice ?? null,
    replacementTags: item.replacementTags || [],
    notes: item.notes || null,
    serviceListingSnapshot: snapshot,
  };
}

// Admin login
router.post('/auth/login', async (req, res, next) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(1),
    });
    const { email, password } = schema.parse(req.body || {});

    const admin = await prisma.systemAdmin.findUnique({ where: { email } });
    if (!admin) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ sub: admin.id, role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('adminToken', token, { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.json({ id: admin.id, email: admin.email, name: admin.name });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues[0]?.message || 'Invalid input' });
    next(err);
  }
});

// Get current admin
router.get('/auth/me', requireAdmin, async (req, res) => {
  res.json({ id: req.admin.id, email: req.admin.email, name: req.admin.name });
});

// Admin logout
router.post('/auth/logout', (_req, res) => {
  res.clearCookie('adminToken');
  res.json({ ok: true });
});

// Get vendors list (filter by status)
router.get('/vendors', requireAdmin, async (req, res, next) => {
  try {
    const status = req.query.status; // pending_verification, active, rejected
    const where = { role: 'vendor' };
    if (status) where.status = status;

    const vendors = await prisma.user.findMany({
      where,
      include: {
        vendor: {
          select: {
            category: true,
            location: true,
            description: true,
            verificationDocuments: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(vendors);
  } catch (err) {
    next(err);
  }
});

// Approve vendor
router.post('/vendors/:userId/approve', requireAdmin, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const vendor = await approveVendor(userId);
    res.json({ ok: true, vendor });
  } catch (err) {
    if (err.message === 'Vendor not found' || err.message === 'Vendor is not pending verification') {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

// Reject vendor
router.post('/vendors/:userId/reject', requireAdmin, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const schema = z.object({ reason: z.string().max(500).optional() });
    const { reason } = schema.parse(req.body || {});
    const vendor = await rejectVendor(userId, reason);
    res.json({ ok: true, vendor });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.issues[0]?.message || 'Invalid input' });
    }
    if (err.message === 'Vendor not found' || err.message === 'Vendor is not pending verification') {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

// Get accounts (couples or vendors)
router.get('/accounts', requireAdmin, async (req, res, next) => {
  try {
    const { role, status } = req.query;
    const where = {};
    
    if (role === 'couple') {
      where.role = 'couple';
    } else if (role === 'vendor') {
      where.role = 'vendor';
    }
    
    if (status) {
      where.status = status;
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        blockReason: true,
        blockedAt: true,
        contactNumber: true,
        createdAt: true,
        couple: {
          select: {
            createdAt: true,
          },
        },
        vendor: {
          select: {
            category: true,
            location: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(users);
  } catch (err) {
    next(err);
  }
});

// Get account details
router.get('/accounts/:userId', requireAdmin, async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        blockReason: true,
        blockedAt: true,
        contactNumber: true,
        createdAt: true,
        updatedAt: true,
        couple: {
          select: {
            createdAt: true,
          },
        },
        vendor: {
          select: {
            category: true,
            location: true,
            description: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'Account not found' });
    }

    res.json(user);
  } catch (err) {
    next(err);
  }
});

// Block account
router.post('/accounts/:userId/block', requireAdmin, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const schema = z.object({
      reason: z.string().min(1, 'Reason is required').max(1000, 'Reason must be less than 1000 characters'),
    });
    const { reason } = schema.parse(req.body || {});

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'Account not found' });
    }

    if (user.status === 'blocked') {
      return res.status(400).json({ error: 'Account is already blocked' });
    }

    // Update user status to blocked
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        status: 'blocked',
        blockReason: reason,
        blockedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        blockReason: true,
        blockedAt: true,
      },
    });

    // Send email notification
    const emailSubject = 'Account Blocked - Weddding Platform';
    const emailBody = `Dear ${user.name || 'User'},

Your account on the Weddding platform has been blocked by an administrator.

Reason: ${reason}

If you believe this is an error, please contact our support team for assistance.

Best regards,
Weddding Platform Team`;

    await sendEmail(user.email, emailSubject, emailBody);

    if (user.role === 'vendor') {
      await flagPackagesForVendor(prisma, userId);
    }

    res.json({ ok: true, user: updatedUser });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.issues[0]?.message || 'Invalid input', issues: err.issues });
    }
    next(err);
  }
});

// Unblock account
router.post('/accounts/:userId/unblock', requireAdmin, async (req, res, next) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'Account not found' });
    }

    if (user.status !== 'blocked') {
      return res.status(400).json({ error: 'Account is not blocked' });
    }

    // Update user status to active and clear block reason
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        status: 'active',
        blockReason: null,
        blockedAt: null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        blockReason: true,
        blockedAt: true,
      },
    });

    // Send email notification
    const emailSubject = 'Account Unblocked - Weddding Platform';
    const emailBody = `Dear ${user.name || 'User'},

Your account on the Weddding platform has been unblocked. You can now log in to your account again.

If you have any questions, please contact our support team.

Best regards,
Weddding Platform Team`;

    await sendEmail(user.email, emailSubject, emailBody);

    if (user.role === 'vendor') {
      await revalidatePackagesForVendor(prisma, userId);
    }

    res.json({ ok: true, user: updatedUser });
  } catch (err) {
    next(err);
  }
});

// --------------------- Wedding Packages ---------------------
router.get('/packages/listings', requireAdmin, async (req, res, next) => {
  try {
    const { q, includeInactive } = req.query;
    const where = {};

    if (!includeInactive || includeInactive === 'false') {
      where.isActive = true;
    }

    if (q && q.trim()) {
      where.OR = [
        { name: { contains: q.trim(), mode: 'insensitive' } },
        {
          vendor: {
            user: {
              name: { contains: q.trim(), mode: 'insensitive' },
            },
          },
        },
      ];
    }

    const listings = await prisma.serviceListing.findMany({
      where,
      include: {
        vendor: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                status: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 150,
    });

    const payload = listings.map((listing) => ({
      id: listing.id,
      name: listing.name,
      category: listing.category,
      customCategory: listing.customCategory,
      price: listing.price.toString(),
      isActive: listing.isActive,
      has3DModel: listing.has3DModel,
      vendor: listing.vendor
        ? {
            id: listing.vendor.userId,
            name: listing.vendor.user?.name || null,
            email: listing.vendor.user?.email || null,
            status: listing.vendor.user?.status || null,
          }
        : null,
    }));

    res.json(payload);
  } catch (err) {
    next(err);
  }
});

router.get('/packages', requireAdmin, async (req, res, next) => {
  try {
    const { status, search } = req.query;
    const where = {};

    if (status && PACKAGE_STATUS_VALUES.includes(status)) {
      where.status = status;
    }

    if (search && search.trim()) {
      where.packageName = { contains: search.trim(), mode: 'insensitive' };
    }

    const packages = await prisma.weddingPackage.findMany({
      where,
      include: PACKAGE_INCLUDE,
      orderBy: { updatedAt: 'desc' },
    });

    res.json(packages.map(buildPackageResponse));
  } catch (err) {
    next(err);
  }
});

router.get('/packages/:packageId', requireAdmin, async (req, res, next) => {
  try {
    const pkg = await prisma.weddingPackage.findUnique({
      where: { id: req.params.packageId },
      include: PACKAGE_INCLUDE,
    });

    if (!pkg) {
      return res.status(404).json({ error: 'Package not found' });
    }

    res.json(buildPackageResponse(pkg));
  } catch (err) {
    next(err);
  }
});

router.post('/packages', requireAdmin, async (req, res, next) => {
  try {
    const payload = packagePayloadSchema.parse(req.body || {});

    const itemsData = [];
    for (const item of payload.items) {
      // eslint-disable-next-line no-await-in-loop
      itemsData.push(await buildPackageItemWriteData(item));
    }

    const pkg = await prisma.weddingPackage.create({
      data: {
        packageName: payload.packageName,
        description: payload.description || null,
        previewImage: payload.previewImage || null,
        notes: payload.notes || null,
        items: {
          create: itemsData.map((item) => ({
            ...item,
          })),
        },
      },
      include: PACKAGE_INCLUDE,
    });

    await validatePackageHealth(prisma, pkg.id);
    const refreshed = await prisma.weddingPackage.findUnique({
      where: { id: pkg.id },
      include: PACKAGE_INCLUDE,
    });

    res.status(201).json(buildPackageResponse(refreshed));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.issues[0]?.message || 'Invalid input', issues: err.issues });
    }
    if (err.status === 404) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
});

router.put('/packages/:packageId', requireAdmin, async (req, res, next) => {
  try {
    const payload = packagePayloadSchema.parse(req.body || {});
    const { packageId } = req.params;

    const existingPackage = await prisma.weddingPackage.findUnique({
      where: { id: packageId },
      select: { id: true },
    });

    if (!existingPackage) {
      return res.status(404).json({ error: 'Package not found' });
    }

    const itemsData = [];
    for (const item of payload.items) {
      // eslint-disable-next-line no-await-in-loop
      itemsData.push({ input: item, data: await buildPackageItemWriteData(item) });
    }

    await prisma.weddingPackage.update({
      where: { id: packageId },
      data: {
        packageName: payload.packageName,
        description: payload.description || null,
        previewImage: payload.previewImage || null,
        notes: payload.notes || null,
      },
    });

    const existingItems = await prisma.weddingPackageItem.findMany({
      where: { packageId },
      select: { id: true },
    });

    const incomingIds = new Set(payload.items.filter((item) => item.id).map((item) => item.id));
    const deleteIds = existingItems.filter((item) => !incomingIds.has(item.id)).map((item) => item.id);

    if (deleteIds.length) {
      await prisma.weddingPackageItem.deleteMany({
        where: { id: { in: deleteIds } },
      });
    }

    for (const item of itemsData) {
      if (item.input.id) {
        // eslint-disable-next-line no-await-in-loop
        await prisma.weddingPackageItem.update({
          where: { id: item.input.id },
          data: item.data,
        });
      } else {
        // eslint-disable-next-line no-await-in-loop
        await prisma.weddingPackageItem.create({
          data: {
            ...item.data,
            packageId,
          },
        });
      }
    }

    await validatePackageHealth(prisma, packageId);

    const refreshed = await prisma.weddingPackage.findUnique({
      where: { id: packageId },
      include: PACKAGE_INCLUDE,
    });

    res.json(buildPackageResponse(refreshed));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.issues[0]?.message || 'Invalid input', issues: err.issues });
    }
    if (err.status === 404) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
});

router.post('/packages/:packageId/validate', requireAdmin, async (req, res, next) => {
  try {
    const { packageId } = req.params;
    const existingPackage = await prisma.weddingPackage.findUnique({
      where: { id: packageId },
      select: { id: true },
    });

    if (!existingPackage) {
      return res.status(404).json({ error: 'Package not found' });
    }

    const { package: pkg, issues } = await validatePackageHealth(prisma, packageId);
    res.json({ package: buildPackageResponse(pkg), issues });
  } catch (err) {
    next(err);
  }
});

router.patch('/packages/:packageId/status', requireAdmin, async (req, res, next) => {
  try {
    const { status } = packageStatusSchema.parse(req.body || {});
    const { packageId } = req.params;

    const existingPackage = await prisma.weddingPackage.findUnique({
      where: { id: packageId },
      include: PACKAGE_INCLUDE,
    });

    if (!existingPackage) {
      return res.status(404).json({ error: 'Package not found' });
    }

    if (status === WeddingPackageStatus.published) {
      const { issues } = await validatePackageHealth(prisma, packageId);
      if (issues.length) {
        return res.status(400).json({ error: 'Resolve package issues before publishing', issues });
      }
    }

    const updated = await prisma.weddingPackage.update({
      where: { id: packageId },
      data: { status },
      include: PACKAGE_INCLUDE,
    });

    res.json(buildPackageResponse(updated));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.issues[0]?.message || 'Invalid input', issues: err.issues });
    }
    next(err);
  }
});
// ------------------------------------------------------------

// Get all vendor payments (for admin to manage)
router.get('/vendor-payments', requireAdmin, async (req, res, next) => {
  try {
    const { status } = req.query; // 'pending' (not released) or 'released'
    
    const where = {};
    if (status === 'pending') {
      where.releasedToVendor = false;
    } else if (status === 'released') {
      where.releasedToVendor = true;
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        booking: {
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
        },
      },
      orderBy: { paymentDate: 'desc' },
    });

    // Transform the data for frontend
    const transformedPayments = payments.map((payment) => ({
      id: payment.id,
      bookingId: payment.bookingId,
      paymentType: payment.paymentType,
      amount: payment.amount.toString(),
      paymentMethod: payment.paymentMethod,
      paymentDate: payment.paymentDate,
      receipt: payment.receipt,
      releasedToVendor: payment.releasedToVendor,
      releasedAt: payment.releasedAt,
      releasedBy: payment.releasedBy,
      vendor: {
        id: payment.booking.vendor.userId,
        name: payment.booking.vendor.user.name,
        email: payment.booking.vendor.user.email,
        category: payment.booking.vendor.category,
      },
      couple: {
        id: payment.booking.couple.userId,
        name: payment.booking.couple.user.name,
        email: payment.booking.couple.user.email,
      },
      booking: {
        id: payment.booking.id,
        reservedDate: payment.booking.reservedDate,
        status: payment.booking.status,
        selectedServices: payment.booking.selectedServices.map((ss) => ({
          id: ss.id,
          serviceName: ss.serviceListing.name,
          category: ss.serviceListing.category,
          quantity: ss.quantity,
          totalPrice: ss.totalPrice.toString(),
        })),
      },
    }));

    res.json(transformedPayments);
  } catch (err) {
    next(err);
  }
});

// Release payment to vendor
router.post('/vendor-payments/:paymentId/release', requireAdmin, async (req, res, next) => {
  try {
    const { paymentId } = req.params;
    const adminId = req.admin.id;

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        booking: {
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
        },
      },
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (payment.releasedToVendor) {
      return res.status(400).json({ error: 'Payment has already been released to vendor' });
    }

    // Update payment to released
    const updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        releasedToVendor: true,
        releasedAt: new Date(),
        releasedBy: adminId,
      },
      include: {
        booking: {
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
        },
      },
    });

    // Send email notification to vendor
    const emailSubject = 'Payment Released - Weddding Platform';
    const emailBody = `Dear ${payment.booking.vendor.user.name || 'Vendor'},

A payment of RM ${payment.amount.toString()} has been released to your account.

Payment Details:
- Payment ID: ${payment.id}
- Payment Type: ${payment.paymentType === 'deposit' ? 'Deposit' : 'Final Payment'}
- Amount: RM ${payment.amount.toString()}
- Payment Date: ${new Date(payment.paymentDate).toLocaleDateString()}
- Released Date: ${new Date().toLocaleDateString()}

Thank you for your service.

Best regards,
Weddding Platform Team`;

    await sendEmail(payment.booking.vendor.user.email, emailSubject, emailBody);

    res.json({ ok: true, payment: updatedPayment });
  } catch (err) {
    next(err);
  }
});

// GET /admin/cancellations - Get all cancellations with refund information
router.get('/cancellations', requireAdmin, async (req, res, next) => {
  try {
    const cancellations = await prisma.cancellation.findMany({
      include: {
        booking: {
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
          },
        },
      },
      orderBy: {
        cancelledAt: 'desc',
      },
    });

    // Convert Decimal to string for JSON response
    const cancellationsWithStringPrices = cancellations.map((cancellation) => ({
      ...cancellation,
      cancellationFee: cancellation.cancellationFee ? cancellation.cancellationFee.toString() : null,
      refundAmount: cancellation.refundAmount ? cancellation.refundAmount.toString() : null,
    }));

    res.json(cancellationsWithStringPrices);
  } catch (err) {
    next(err);
  }
});

// PATCH /admin/cancellations/:id - Update refund information for a cancellation
const updateRefundSchema = z.object({
  refundStatus: z.enum(['not_applicable', 'pending', 'processed']).optional(),
  refundMethod: z.string().max(500).optional().nullable(),
  refundNotes: z.string().max(2000).optional().nullable(),
});

router.patch('/cancellations/:id', requireAdmin, async (req, res, next) => {
  try {
    const data = updateRefundSchema.parse(req.body);
    const cancellationId = req.params.id;

    const cancellation = await prisma.cancellation.findUnique({
      where: { id: cancellationId },
    });

    if (!cancellation) {
      return res.status(404).json({ error: 'Cancellation not found' });
    }

    const updateData = {};
    if (data.refundStatus !== undefined) {
      updateData.refundStatus = data.refundStatus;
    }
    if (data.refundMethod !== undefined) {
      updateData.refundMethod = data.refundMethod;
    }
    if (data.refundNotes !== undefined) {
      updateData.refundNotes = data.refundNotes;
    }

    const updated = await prisma.cancellation.update({
      where: { id: cancellationId },
      data: updateData,
      include: {
        booking: {
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
          },
        },
      },
    });

    res.json({
      ...updated,
      cancellationFee: updated.cancellationFee ? updated.cancellationFee.toString() : null,
      refundAmount: updated.refundAmount ? updated.refundAmount.toString() : null,
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

