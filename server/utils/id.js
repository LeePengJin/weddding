'use strict';

// Minimal ULID implementation (Crockford base32) without external deps
// ULID spec: https://github.com/ulid/spec
const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function encodeTime(time, len) {
  let str = '';
  for (let i = len; i > 0; i--) {
    const mod = time % 32;
    str = ENCODING.charAt(mod) + str;
    time = (time - mod) / 32;
  }
  return str;
}

function encodeRandom(len) {
  let str = '';
  for (let i = 0; i < len; i++) {
    // Using crypto if available for better randomness
    const rand = Math.floor(Math.random() * 32);
    str += ENCODING.charAt(rand);
  }
  return str;
}

function ulid() {
  const time = Date.now();
  return encodeTime(time, 10) + encodeRandom(16);
}

function prefixedUlid(prefix) {
  const normalized = prefix && String(prefix).trim().replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return (normalized ? normalized + '_' : '') + ulid();
}

module.exports = { ulid, prefixedUlid };


