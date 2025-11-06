require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { sendEmail } = require('./utils/mailer');
const { passwordPolicy, generateOtpCode } = require('./utils/security');
const { prefixedUlid } = require('./utils/id');
const { PrismaClient } = require('@prisma/client');
let mailerTransport = null;
async function getMailer() {
  if (mailerTransport !== null) return mailerTransport;
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true';
  if (host && port && user && pass) {
    const nodemailer = require('nodemailer');
    mailerTransport = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
  } else {
    mailerTransport = undefined; // dev stub
  }
  return mailerTransport;
}

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret';

app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/auth/register', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Missing fields' });
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email in use' });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { id: prefixedUlid('usr'), email, passwordHash } });
    res.status(201).json({ id: user.id, email: user.email });
  } catch (err) {
    next(err);
  }
});

// moved to utils

// STEP 1: Request registration (send OTP)
app.post('/auth/register/request', async (req, res, next) => {
  try {
    const SAFE_TEXT = /^[A-Za-z0-9 .,'-]+$/;
    const schema = z.object({
      name: z
        .string()
        .min(2, 'Name must be at least 2 characters')
        .max(100, 'Name must be at most 100 characters')
        .regex(SAFE_TEXT, "Name may only include letters, numbers, spaces, period, comma, apostrophe, and hyphen"),
      email: z.string().email('Invalid email address'),
      password: passwordPolicy,
    });
    const { name, email, password } = schema.parse(req.body || {});

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email in use' });

    // Generate OTP and store with payload (hash password now)
    const code = generateOtpCode();
    const passwordHash = await bcrypt.hash(password, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.otpToken.create({
      data: {
        email,
        code,
        purpose: 'register',
        payload: { name, passwordHash },
        expiresAt,
      },
    });

    await sendEmail(email, 'Your Weddding OTP Code', `Your OTP is: ${code} (valid for 10 minutes)`);
    return res.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      const issues = err.issues.map((i) => ({ field: i.path?.[0] ?? 'unknown', message: i.message }));
      return res.status(400).json({ error: issues[0]?.message || 'Invalid input', issues });
    }
    next(err);
  }
});

// STEP 2 (COUPLE): Verify registration OTP and create account (User + Couple)
app.post('/auth/register/verify', async (req, res, next) => {
  try {
    const schema = z.object({ email: z.string().email(), code: z.string().length(6) });
    const { email, code } = schema.parse(req.body || {});

    const token = await prisma.otpToken.findFirst({
      where: { email, code, purpose: 'register', consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!token) return res.status(400).json({ error: 'Invalid or expired OTP' });

    const payload = token.payload || {};
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email in use' });
    // Create couple user as active and create Couple record
    const created = await prisma.$transaction(async (tx) => {
      const newUserId = prefixedUlid('usr');
      const user = await tx.user.create({
        data: {
          id: newUserId,
          email,
          name: payload.name || null,
          passwordHash: payload.passwordHash,
          role: 'couple',
          status: 'active',
        },
      });
      await tx.couple.create({ data: { userId: user.id } });
      await tx.otpToken.update({ where: { id: token.id }, data: { consumedAt: new Date() } });
      return user;
    });

    const tokenJwt = jwt.sign({ sub: created.id, role: created.role }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', tokenJwt, { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 });
    return res.json({ id: created.id, email: created.email, role: created.role, status: created.status });
  } catch (err) {
    if (err instanceof z.ZodError) {
      const issues = err.issues.map((i) => ({ field: i.path?.[0] ?? 'unknown', message: i.message }));
      return res.status(400).json({ error: issues[0]?.message || 'Invalid input', issues });
    }
    next(err);
  }
});

// VENDOR REGISTRATION - STEP 1: Request vendor registration (send OTP with payload)
app.post('/auth/register/vendor/request', async (req, res, next) => {
  try {
    const SAFE_TEXT = /^[A-Za-z0-9 .,'-]+$/;
    const schema = z.object({
      name: z
        .string()
        .min(2, 'Business name must be at least 2 characters')
        .max(120, 'Business name must be at most 120 characters')
        .regex(SAFE_TEXT, "Business name may only include letters, numbers, spaces, period, comma, apostrophe, and hyphen"),
      email: z.string().email('Invalid email address'),
      password: passwordPolicy,
      category: z.enum(['Photographer','Videographer','Venue','Caterer','Florist','DJ_Music','Other']),
      location: z
        .string()
        .min(2, 'Location must be at least 2 characters')
        .max(120, 'Location must be at most 120 characters')
        .regex(SAFE_TEXT, "Location may only include letters, numbers, spaces, period, comma, apostrophe, and hyphen")
        .optional(),
      description: z.string().max(2000, 'Description must be at most 2000 characters').optional(),
      verificationDocuments: z.array(z.string()).optional(),
    });
    const { name, email, password, category, location, description, verificationDocuments } = schema.parse(req.body || {});

    const existing = await prisma.user.findUnique({ where: { email } });
    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    if (existing) {
      // If existing vendor is rejected, treat this as a resubmission request
      if (existing.role === 'vendor' && existing.status === 'rejected') {
        await prisma.otpToken.create({
          data: {
            email,
            code,
            purpose: 'resubmit_vendor',
            payload: {
              name,
              vendor: { category, location: location || null, description: description || null, verificationDocuments: verificationDocuments || [] },
            },
            expiresAt,
          },
        });
        await sendEmail(email, 'Vendor Resubmission OTP', `Your OTP is: ${code} (valid for 10 minutes)`);
        return res.json({ ok: true, purpose: 'resubmit_vendor' });
      }
      // Otherwise, block as email in use
      return res.status(409).json({ error: 'Email in use' });
    }

    // New vendor registration request
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.otpToken.create({
      data: {
        email,
        code,
        purpose: 'register_vendor',
        payload: {
          name,
          passwordHash,
          vendor: { category, location: location || null, description: description || null, verificationDocuments: verificationDocuments || [] },
        },
        expiresAt,
      },
    });

    await sendEmail(email, 'Your Weddding Vendor OTP Code', `Your OTP is: ${code} (valid for 10 minutes)`);
    return res.json({ ok: true, purpose: 'register_vendor' });
  } catch (err) {
    if (err instanceof z.ZodError) {
      const issues = err.issues.map((i) => ({ field: i.path?.[0] ?? 'unknown', message: i.message }));
      return res.status(400).json({ error: issues[0]?.message || 'Invalid input', issues });
    }
    next(err);
  }
});

// VENDOR REGISTRATION - STEP 2: Verify OTP and create User (vendor) + Vendor profile
app.post('/auth/register/vendor/verify', async (req, res, next) => {
  try {
    const schema = z.object({ email: z.string().email(), code: z.string().length(6) });
    const { email, code } = schema.parse(req.body || {});

    const token = await prisma.otpToken.findFirst({
      where: { email, code, purpose: 'register_vendor', consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!token) return res.status(400).json({ error: 'Invalid or expired OTP' });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email in use' });

    const payload = token.payload || {};
    const vendorData = payload.vendor || {};

    await prisma.$transaction(async (tx) => {
      const newUserId = prefixedUlid('usr');
      const user = await tx.user.create({
        data: {
          id: newUserId,
          email,
          name: payload.name || null,
          passwordHash: payload.passwordHash,
          role: 'vendor',
          status: 'pending_verification',
        },
      });
      await tx.vendor.create({
        data: {
          userId: user.id,
          category: vendorData.category,
          location: vendorData.location || null,
          description: vendorData.description || null,
          verificationDocuments: vendorData.verificationDocuments || [],
        },
      });
      await tx.otpToken.update({ where: { id: token.id }, data: { consumedAt: new Date() } });
    });

    // Do not log in vendor automatically; wait for admin approval
    return res.json({ ok: true, message: 'Vendor account submitted for verification.' });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues[0]?.message || 'Invalid input' });
    next(err);
  }
});

// Generic OTP resend using the latest stored payload for the given purpose
app.post('/auth/otp/resend', async (req, res, next) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      purpose: z.enum(['register', 'register_vendor', 'resubmit_vendor', 'reset']),
    });
    const { email, purpose } = schema.parse(req.body || {});

    // Find latest token for this email/purpose to reuse payload when applicable
    const latest = await prisma.otpToken.findFirst({
      where: { email, purpose },
      orderBy: { createdAt: 'desc' },
    });

    // For reset, no payload needed. For register flows, reuse prior payload if present.
    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await prisma.otpToken.create({
      data: {
        email,
        code,
        purpose,
        payload: latest?.payload || undefined,
        expiresAt,
      },
    });

    const subject = purpose === 'reset'
      ? 'Your Weddding Password Reset OTP'
      : 'Your Weddding OTP Code';
    await sendEmail(email, subject, `Your OTP is: ${code} (valid for 10 minutes)`);
    return res.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues[0]?.message || 'Invalid input' });
    next(err);
  }
});

// VENDOR RESUBMIT - STEP 1: Request resubmission OTP (existing rejected vendor)
app.post('/auth/vendor/resubmit/request', async (req, res, next) => {
  try {
    const SAFE_TEXT = /^[A-Za-z0-9 .,'-]+$/;
    const schema = z.object({
      email: z.string().email('Invalid email address'),
      name: z
        .string()
        .min(2, 'Business name must be at least 2 characters')
        .max(120, 'Business name must be at most 120 characters')
        .regex(SAFE_TEXT, "Business name may only include letters, numbers, spaces, period, comma, apostrophe, and hyphen")
        .optional(),
      category: z.enum(['Photographer','Videographer','Venue','Caterer','Florist','DJ_Music','Other']).optional(),
      location: z
        .string()
        .min(2, 'Location must be at least 2 characters')
        .max(120, 'Location must be at most 120 characters')
        .regex(SAFE_TEXT, "Location may only include letters, numbers, spaces, period, comma, apostrophe, and hyphen")
        .optional(),
      description: z.string().max(2000, 'Description must be at most 2000 characters').optional(),
      verificationDocuments: z.array(z.string()).optional(),
    });
    const { email, name, category, location, description, verificationDocuments } = schema.parse(req.body || {});

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: 'Email not found' });
    if (user.role !== 'vendor') return res.status(400).json({ error: 'Not a vendor account' });
    if (user.status !== 'rejected') return res.status(400).json({ error: 'Only rejected vendors can resubmit' });

    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.otpToken.create({
      data: {
        email,
        code,
        purpose: 'resubmit_vendor',
        payload: {
          name: name ?? null,
          vendor: {
            category: category ?? undefined,
            location: location ?? null,
            description: description ?? null,
            verificationDocuments: verificationDocuments ?? [],
          },
        },
        expiresAt,
      },
    });

    await sendEmail(email, 'Vendor Resubmission OTP', `Your OTP is: ${code} (valid for 10 minutes)`);
    return res.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues[0]?.message || 'Invalid input' });
    next(err);
  }
});

// VENDOR RESUBMIT - STEP 2: Verify OTP and update vendor profile, set status back to pending
app.post('/auth/vendor/resubmit/verify', async (req, res, next) => {
  try {
    const schema = z.object({ email: z.string().email(), code: z.string().length(6) });
    const { email, code } = schema.parse(req.body || {});

    const token = await prisma.otpToken.findFirst({
      where: { email, code, purpose: 'resubmit_vendor', consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!token) return res.status(400).json({ error: 'Invalid or expired OTP' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: 'Email not found' });
    if (user.role !== 'vendor') return res.status(400).json({ error: 'Not a vendor account' });
    if (user.status !== 'rejected') return res.status(400).json({ error: 'Only rejected vendors can resubmit' });

    const payload = token.payload || {};
    const vendorPatch = payload.vendor || {};

    await prisma.$transaction(async (tx) => {
      if (payload.name) {
        await tx.user.update({ where: { id: user.id }, data: { name: payload.name } });
      }
      await tx.vendor.update({
        where: { userId: user.id },
        data: {
          category: vendorPatch.category ?? undefined,
          location: vendorPatch.location ?? null,
          description: vendorPatch.description ?? null,
          verificationDocuments: vendorPatch.verificationDocuments ?? [],
        },
      });
      await tx.user.update({ where: { id: user.id }, data: { status: 'pending_verification' } });
      await tx.otpToken.update({ where: { id: token.id }, data: { consumedAt: new Date() } });
    });

    return res.json({ ok: true, message: 'Resubmission received. Pending verification.' });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues[0]?.message || 'Invalid input' });
    next(err);
  }
});

// Forgot password: request OTP
app.post('/auth/forgot/request', async (req, res, next) => {
  try {
    const schema = z.object({ email: z.string().email() });
    const { email } = schema.parse(req.body || {});
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: 'Email not found' });

    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await prisma.otpToken.create({ data: { email, code, purpose: 'reset', expiresAt } });
    await sendEmail(email, 'Your Weddding Password Reset OTP', `Your OTP is: ${code} (valid for 10 minutes)`);
    return res.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues[0]?.message || 'Invalid input' });
    next(err);
  }
});

// Forgot password: verify OTP (does not consume)
app.post('/auth/forgot/verify', async (req, res, next) => {
  try {
    const schema = z.object({ email: z.string().email(), code: z.string().length(6) });
    const { email, code } = schema.parse(req.body || {});
    const token = await prisma.otpToken.findFirst({
      where: { email, code, purpose: 'reset', consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!token) return res.status(400).json({ error: 'Invalid or expired OTP' });
    return res.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues[0]?.message || 'Invalid input' });
    next(err);
  }
});

// Forgot password: reset with OTP (consumes)
app.post('/auth/forgot/reset', async (req, res, next) => {
  try {
    const schema = z.object({ email: z.string().email(), code: z.string().length(6), newPassword: passwordPolicy });
    const { email, code, newPassword } = schema.parse(req.body || {});

    const token = await prisma.otpToken.findFirst({
      where: { email, code, purpose: 'reset', consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!token) return res.status(400).json({ error: 'Invalid or expired OTP' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: 'Email not found' });

    const same = await bcrypt.compare(newPassword, user.passwordHash);
    if (same) return res.status(400).json({ error: 'New password must be different from previous password' });

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { email }, data: { passwordHash } });
    await prisma.otpToken.update({ where: { id: token.id }, data: { consumedAt: new Date() } });
    return res.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues[0]?.message || 'Invalid input' });
    next(err);
  }
});
app.post('/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    if (user.status !== 'active') return res.status(403).json({ error: 'Account not active' });
    const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 7*24*60*60*1000 });
    res.json({ id: user.id, email: user.email, role: user.role, status: user.status });
  } catch (err) {
    next(err);
  }
});

function requireAuth(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

app.get('/auth/me', requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.sub }, select: { id: true, email: true, role: true } });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

app.post('/auth/logout', (_req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

app.use((err, _req, res, _next) => {
  // Minimal error handler for dev
  console.error(err);
  res.status(500).json({ error: 'Internal error' });
});

app.listen(PORT, () => console.log(`API on :${PORT}`));


