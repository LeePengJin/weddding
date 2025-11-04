const { z } = require('zod');

const passwordPolicy = z
  .string()
  .min(8)
  .refine((v) => /[a-z]/.test(v), 'Password must contain at least one lowercase letter')
  .refine((v) => /[A-Z]/.test(v), 'Password must contain at least one uppercase letter')
  .refine((v) => /[0-9]/.test(v), 'Password must contain at least one number')
  .refine((v) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(v), 'Password must contain at least one special character');

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

module.exports = { passwordPolicy, generateOtpCode };


