const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { PrismaClient, VendorCategory, WeddingPackageStatus } = require('@prisma/client');
const { requireAdmin } = require('../middleware/auth');
const { approveVendor, rejectVendor } = require('../services/vendor.service');
const { sendEmail, generateRefundProcessedEmail } = require('../utils/mailer');
const { passwordPolicy } = require('../utils/security');
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
    serviceListingSnapshot: z.any().optional().nullable(),
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
  venueServiceListingId: z.string().uuid('Invalid venue ID').optional().nullable(),
  items: z.array(packageItemSchema), 
});

const packageStatusSchema = z.object({
  status: z.nativeEnum(WeddingPackageStatus, {
    errorMap: () => ({ message: 'Invalid package status' }),
  }),
});

async function buildPackageItemWriteData(item) {
  let snapshotFromDb = false;
  let snapshot = item.serviceListingId ? await getListingSnapshot(prisma, item.serviceListingId) : null;
  if (snapshot) snapshotFromDb = true;
  if (!snapshot) snapshot = item.serviceListingSnapshot || (item.serviceListingId ? { id: item.serviceListingId } : null);

  return {
    label: item.label,
    category: item.category,
    serviceListingId: snapshotFromDb ? item.serviceListingId : null,
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

// Admin change password (authenticated)
router.post('/auth/change-password', requireAdmin, async (req, res, next) => {
  try {
    const schema = z.object({
      currentPassword: z.string().min(1, 'Current password is required'),
      newPassword: passwordPolicy,
    });
    const { currentPassword, newPassword } = schema.parse(req.body || {});

    const same = await bcrypt.compare(currentPassword, req.admin.passwordHash);
    if (!same) return res.status(400).json({ error: 'Current password is incorrect' });

    const isReuse = await bcrypt.compare(newPassword, req.admin.passwordHash);
    if (isReuse) return res.status(400).json({ error: 'New password must be different from current password' });

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.systemAdmin.update({
      where: { id: req.admin.id },
      data: { passwordHash },
    });

    res.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues[0]?.message || 'Invalid input' });
    next(err);
  }
});

// Get vendors list (filter by status)
router.get('/vendors', requireAdmin, async (req, res, next) => {
  try {
    const status = req.query.status; // pending_verification, active, rejected
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const where = { role: 'vendor' };
    if (status) where.status = status;

    const [vendors, total] = await Promise.all([
      prisma.user.findMany({
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
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      data: vendors,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const where = {};
    
    if (role === 'couple') {
      where.role = 'couple';
    } else if (role === 'vendor') {
      where.role = 'vendor';
    }
    
    if (status) {
      where.status = status;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
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
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
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

    if (user.role === 'vendor') {
      try {
        await flagPackagesForVendor(prisma, userId);
      } catch (pkgErr) {
        console.warn('[admin.routes] Failed to flag packages for vendor (block)', { userId, err: pkgErr?.message });
      }
    }

    const emailSubject = 'Account Blocked - Weddding Platform';
    const emailBody = `Dear ${user.name || 'User'},

Your account on the Weddding platform has been blocked by an administrator.

Reason: ${reason}

If you believe this is an error, please contact our support team for assistance.

Best regards,
Weddding Platform Team`;

    try {
      await sendEmail(user.email, emailSubject, emailBody);
    } catch (mailErr) {
      console.warn('[admin.routes] Failed to send block email', { userId, email: user.email, err: mailErr?.message });
    }

    res.json({ ok: true, user: updatedUser });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.issues[0]?.message || 'Invalid input', issues: err.issues });
    }
    next(err);
  }
});

// Deactivate account (set status to inactive)
router.post('/accounts/:userId/deactivate', requireAdmin, async (req, res, next) => {
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

    if (user.status === 'inactive') {
      return res.status(400).json({ error: 'Account is already inactive' });
    }

    if (user.status === 'blocked') {
      return res.status(400).json({ error: 'Account is blocked. Unblock the account instead.' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        status: 'inactive',
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

    if (user.role === 'vendor') {
      try {
        await flagPackagesForVendor(prisma, userId);
      } catch (pkgErr) {
        console.warn('[admin.routes] Failed to flag packages for vendor (deactivate)', { userId, err: pkgErr?.message });
      }
    }

    const emailSubject = 'Account Deactivated - Weddding Platform';
    const emailBody = `Dear ${user.name || 'User'},

Your account on the Weddding platform has been deactivated by an administrator.

Reason: ${reason}

If you believe this is an error, please contact our support team for assistance.

Best regards,
Weddding Platform Team`;

    try {
      await sendEmail(user.email, emailSubject, emailBody);
    } catch (mailErr) {
      console.warn('[admin.routes] Failed to send deactivate email', { userId, email: user.email, err: mailErr?.message });
    }

    return res.json({ ok: true, user: updatedUser });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.issues[0]?.message || 'Invalid input', issues: err.issues });
    }
    return next(err);
  }
});

// Activate account 
router.post('/accounts/:userId/activate', requireAdmin, async (req, res, next) => {
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

    if (user.status !== 'inactive') {
      return res.status(400).json({ error: 'Account is not inactive' });
    }

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

    if (user.role === 'vendor') {
      try {
        await revalidatePackagesForVendor(prisma, userId);
      } catch (pkgErr) {
        console.warn('[admin.routes] Failed to revalidate packages for vendor (activate)', { userId, err: pkgErr?.message });
      }
    }

    const emailSubject = 'Account Activated - Weddding Platform';
    const emailBody = `Dear ${user.name || 'User'},

Your account on the Weddding platform has been reactivated. You can now log in again.

If you have any questions, please contact our support team.

Best regards,
Weddding Platform Team`;

    try {
      await sendEmail(user.email, emailSubject, emailBody);
    } catch (mailErr) {
      console.warn('[admin.routes] Failed to send activate email', { userId, email: user.email, err: mailErr?.message });
    }

    return res.json({ ok: true, user: updatedUser });
  } catch (err) {
    return next(err);
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

    if (user.role === 'vendor') {
      try {
        await revalidatePackagesForVendor(prisma, userId);
      } catch (pkgErr) {
        console.warn('[admin.routes] Failed to revalidate packages for vendor (unblock)', { userId, err: pkgErr?.message });
      }
    }

    const emailSubject = 'Account Unblocked - Weddding Platform';
    const emailBody = `Dear ${user.name || 'User'},

Your account on the Weddding platform has been unblocked. You can now log in to your account again.

If you have any questions, please contact our support team.

Best regards,
Weddding Platform Team`;

    try {
      await sendEmail(user.email, emailSubject, emailBody);
    } catch (mailErr) {
      console.warn('[admin.routes] Failed to send unblock email', { userId, email: user.email, err: mailErr?.message });
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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
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

    const [listings, total] = await Promise.all([
      prisma.serviceListing.findMany({
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
        skip,
        take: limit,
      }),
      prisma.serviceListing.count({ where }),
    ]);

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

    res.json({
      data: payload,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/packages', requireAdmin, async (req, res, next) => {
  try {
    const { status, search } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const where = {};

    if (status && PACKAGE_STATUS_VALUES.includes(status)) {
      where.status = status;
    }

    if (search && search.trim()) {
      where.packageName = { contains: search.trim(), mode: 'insensitive' };
    }

    const [packages, total] = await Promise.all([
      prisma.weddingPackage.findMany({
      where,
      include: PACKAGE_INCLUDE,
      orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.weddingPackage.count({ where }),
    ]);

    res.json({
      data: packages.map(buildPackageResponse),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
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

    if (payload.venueServiceListingId) {
      // Verify venue exists and has 3D model
      const venue = await prisma.serviceListing.findUnique({
        where: { id: payload.venueServiceListingId },
        include: { designElement: true },
      });

      if (!venue) {
        return res.status(404).json({ error: 'Venue not found' });
      }

      if (venue.category !== 'Venue') {
        return res.status(400).json({ error: 'Selected service is not a venue' });
      }

      if (!venue.designElement || !venue.designElement.modelFile) {
        return res.status(400).json({ error: 'Selected venue does not have a 3D model' });
      }

      // Create camera position
      const { prefixedUlid } = require('../utils/id');
      const cameraPosition = await prisma.coordinates.create({
        data: {
          id: prefixedUlid('cam'),
          x: 0,
          y: 3,
          z: 8,
        },
      });

      // Create or update PackageDesign
      await prisma.packageDesign.upsert({
        where: { packageId: pkg.id },
        create: {
          id: prefixedUlid('pkgd'),
          packageId: pkg.id,
          venueServiceListingId: payload.venueServiceListingId,
          venueName: venue.name,
          cameraPositionId: cameraPosition.id,
          layoutData: {},
          zoomLevel: 1.2,
        },
        update: {
          venueServiceListingId: payload.venueServiceListingId,
          venueName: venue.name,
        },
      });
    }

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

    if (payload.venueServiceListingId !== undefined) {
      if (payload.venueServiceListingId) {
        const venue = await prisma.serviceListing.findUnique({
          where: { id: payload.venueServiceListingId },
          include: { designElement: true },
        });

        if (!venue) {
          return res.status(404).json({ error: 'Venue not found' });
        }

        if (venue.category !== 'Venue') {
          return res.status(400).json({ error: 'Selected service is not a venue' });
        }

        if (!venue.designElement || !venue.designElement.modelFile) {
          return res.status(400).json({ error: 'Selected venue does not have a 3D model' });
        }

        const existingDesign = await prisma.packageDesign.findUnique({
          where: { packageId },
        });

        if (existingDesign) {
          // Update existing design
          await prisma.packageDesign.update({
            where: { packageId },
            data: {
              venueServiceListingId: payload.venueServiceListingId,
              venueName: venue.name,
            },
          });
        } else {
          // Create new design with venue
          const { prefixedUlid } = require('../utils/id');
          const cameraPosition = await prisma.coordinates.create({
            data: {
              id: prefixedUlid('cam'),
              x: 0,
              y: 3,
              z: 8,
            },
          });

          await prisma.packageDesign.create({
            data: {
              id: prefixedUlid('pkgd'),
              packageId,
              venueServiceListingId: payload.venueServiceListingId,
              venueName: venue.name,
              cameraPositionId: cameraPosition.id,
              layoutData: {},
              zoomLevel: 1.2,
            },
          });
        }
      } else {
        await prisma.packageDesign.updateMany({
          where: { packageId },
          data: {
            venueServiceListingId: null,
          },
        });
      }
    }

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
        await prisma.weddingPackageItem.update({
          where: { id: item.input.id },
          data: item.data,
        });
      } else {
        await prisma.weddingPackageItem.create({
          data: {
            ...item.data,
            packageId,
          },
        });
      }
    }

    const currentPackage = await prisma.weddingPackage.findUnique({
      where: { id: packageId },
      select: { status: true },
    });

    if (currentPackage && currentPackage.status !== WeddingPackageStatus.archived) {
      await validatePackageHealth(prisma, packageId);
    }

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

// Find alternative service listings for a package item (used when a listing becomes unavailable)
router.get('/packages/:packageId/items/:itemId/alternatives', requireAdmin, async (req, res, next) => {
  try {
    const { packageId, itemId } = req.params;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 5), 50);

    const item = await prisma.weddingPackageItem.findFirst({
      where: { id: itemId, packageId },
      include: {
        serviceListing: {
          include: {
            vendor: { include: { user: true } },
          },
        },
      },
    });

    if (!item) {
      return res.status(404).json({ error: 'Package item not found' });
    }

    const snapshot = item.serviceListingSnapshot || null;
    const replacementTags = Array.isArray(item.replacementTags) ? item.replacementTags.filter(Boolean) : [];
    const requires3D = Boolean(item.serviceListing?.has3DModel ?? snapshot?.has3DModel);

    const where = {
      isActive: true,
      category: item.category,
      vendor: {
        user: {
          status: 'active',
        },
      },
    };

    if (item.minPrice !== null && item.minPrice !== undefined) {
      where.price = { ...(where.price || {}), gte: item.minPrice };
    }
    if (item.maxPrice !== null && item.maxPrice !== undefined) {
      where.price = { ...(where.price || {}), lte: item.maxPrice };
    }

    if (item.serviceListingId) {
      where.id = { not: item.serviceListingId };
    }

    if (requires3D) {
      where.OR = [
        { designElementId: { not: null } },
        { components: { some: { designElementId: { not: null } } } },
      ];
    }

    const tagOr = [];
    replacementTags.forEach((tag) => {
      tagOr.push({ name: { contains: tag, mode: 'insensitive' } });
      tagOr.push({ description: { contains: tag, mode: 'insensitive' } });
      tagOr.push({ customCategory: { contains: tag, mode: 'insensitive' } });
    });

    // Combine tag query with existing OR (3D filter) if both exist.
    if (tagOr.length) {
      const existingOr = where.OR ? [...where.OR] : [];
      where.AND = [
        ...(where.AND || []),
        { OR: tagOr },
      ];
      // keep existing OR as-is
      if (existingOr.length) where.OR = existingOr;
    }

    const alternatives = await prisma.serviceListing.findMany({
      where,
      take: limit,
      orderBy: { updatedAt: 'desc' },
      include: {
        vendor: { include: { user: true } },
      },
    });

    res.json({
      data: alternatives.map((l) => ({
        id: l.id,
        name: l.name,
        description: l.description,
        category: l.category,
        customCategory: l.customCategory,
        price: l.price ? l.price.toString() : null,
        has3DModel: Boolean(l.has3DModel),
        images: l.images || [],
        vendorName: l.vendor?.user?.name || null,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// Alternatives search for UNSAVED items (no weddingPackageItem id yet)
router.post('/service-listings/alternatives', requireAdmin, async (req, res, next) => {
  try {
    const schema = z.object({
      category: z.nativeEnum(VendorCategory),
      minPrice: numericField.optional().nullable(),
      maxPrice: numericField.optional().nullable(),
      replacementTags: z.array(z.string()).optional().default([]),
      requires3D: z.boolean().optional().default(false),
      excludeListingId: z.string().uuid().optional().nullable(),
      limit: z.number().int().min(5).max(50).optional().default(12),
    });
    const payload = schema.parse(req.body || {});

    const where = {
      isActive: true,
      category: payload.category,
      vendor: { user: { status: 'active' } },
    };

    if (payload.minPrice !== null && payload.minPrice !== undefined) {
      where.price = { ...(where.price || {}), gte: payload.minPrice };
    }
    if (payload.maxPrice !== null && payload.maxPrice !== undefined) {
      where.price = { ...(where.price || {}), lte: payload.maxPrice };
    }
    if (payload.excludeListingId) {
      where.id = { not: payload.excludeListingId };
    }

    if (payload.requires3D) {
      where.OR = [
        { designElementId: { not: null } },
        { components: { some: { designElementId: { not: null } } } },
      ];
    }

    const tags = (payload.replacementTags || []).map((t) => String(t).trim()).filter(Boolean).slice(0, 8);
    if (tags.length) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: tags.flatMap((tag) => [
            { name: { contains: tag, mode: 'insensitive' } },
            { description: { contains: tag, mode: 'insensitive' } },
            { customCategory: { contains: tag, mode: 'insensitive' } },
          ]),
        },
      ];
    }

    const alternatives = await prisma.serviceListing.findMany({
      where,
      take: payload.limit,
      orderBy: { updatedAt: 'desc' },
      include: { vendor: { include: { user: true } } },
    });

    res.json({
      data: alternatives.map((l) => ({
        id: l.id,
        name: l.name,
        description: l.description,
        category: l.category,
        customCategory: l.customCategory,
        price: l.price ? l.price.toString() : null,
        has3DModel: Boolean(l.has3DModel),
        images: l.images || [],
        vendorName: l.vendor?.user?.name || null,
      })),
    });
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
    const { status } = req.query; 
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const where = {};
    if (status === 'pending') {
      where.releasedToVendor = false;
    } else if (status === 'released') {
      where.releasedToVendor = true;
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
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
        skip,
        take: limit,
      }),
      prisma.payment.count({ where }),
    ]);

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

    res.json({
      data: transformedPayments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
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

// Get all cancellations with refund information
router.get('/cancellations', requireAdmin, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [cancellations, total] = await Promise.all([
      prisma.cancellation.findMany({
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
        skip,
        take: limit,
      }),
      prisma.cancellation.count(),
    ]);

    // Convert Decimal to string for JSON response
    const cancellationsWithStringPrices = cancellations.map((cancellation) => ({
      ...cancellation,
      cancellationFee: cancellation.cancellationFee ? cancellation.cancellationFee.toString() : null,
      refundAmount: cancellation.refundAmount ? cancellation.refundAmount.toString() : null,
    }));

    res.json({
      data: cancellationsWithStringPrices,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

// Update refund information for a cancellation
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
      include: {
        booking: {
          include: {
            couple: {
              include: {
                user: { select: { id: true, name: true, email: true } },
              },
            },
            vendor: {
              include: {
                user: { select: { id: true, name: true, email: true } },
              },
            },
          },
        },
      },
    });

    if (!cancellation) {
      return res.status(404).json({ error: 'Cancellation not found' });
    }

    if (cancellation.refundStatus === 'processed') {
      return res.status(409).json({ error: 'Refund has already been processed. No further changes are allowed.' });
    }

    if (!cancellation.refundRequired) {
      return res.status(400).json({ error: 'Refund is not required for this cancellation.' });
    }

    if (data.refundStatus === 'not_applicable') {
      return res.status(400).json({ error: 'Refund status cannot be set to Not Applicable when a refund is required.' });
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

    // Send email to couple when refund is marked as processed.
    if (cancellation.refundStatus !== 'processed' && updated.refundStatus === 'processed') {
      const coupleEmail = updated.booking?.couple?.user?.email;
      const coupleName = updated.booking?.couple?.user?.name || 'there';
      const vendorName = updated.booking?.vendor?.user?.name || 'Vendor';
      if (coupleEmail) {
        const subject = 'Your Weddding refund has been processed';
        const body = generateRefundProcessedEmail({
          name: coupleName,
          bookingId: updated.bookingId,
          vendorName,
          refundAmount: updated.refundAmount ? updated.refundAmount.toString() : 0,
          refundMethod: updated.refundMethod || '',
          refundNotes: updated.refundNotes || '',
        });
        await sendEmail(coupleEmail, subject, body);
      }
    }

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

