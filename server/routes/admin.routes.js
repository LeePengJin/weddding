const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');
const { requireAdmin } = require('../middleware/auth');
const { approveVendor, rejectVendor } = require('../services/vendor.service');

const router = express.Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret';

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

module.exports = router;

