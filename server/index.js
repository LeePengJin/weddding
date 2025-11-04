require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { sendEmail } = require('./utils/mailer');
const { passwordPolicy, generateOtpCode } = require('./utils/security');
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
    const user = await prisma.user.create({ data: { email, passwordHash } });
    res.status(201).json({ id: user.id, email: user.email });
  } catch (err) {
    next(err);
  }
});

// moved to utils

// STEP 1: Request registration (send OTP)
app.post('/auth/register/request', async (req, res, next) => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      email: z.string().email(),
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
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues[0]?.message || 'Invalid input' });
    next(err);
  }
});

// STEP 2: Verify registration OTP and create account
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

    const user = await prisma.user.create({ data: { email, name: payload.name || null, passwordHash: payload.passwordHash } });
    await prisma.otpToken.update({ where: { id: token.id }, data: { consumedAt: new Date() } });

    const tokenJwt = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', tokenJwt, { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 });
    return res.json({ id: user.id, email: user.email });
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
    const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 7*24*60*60*1000 });
    res.json({ id: user.id, email: user.email });
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


