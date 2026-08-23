/**
 * eKemaskini Cybersecurity & Data Protection Engine
 * Comprehensive security utilities:
 * 1. Anti-XSS & Payload Sanitization
 * 2. PDPA Data Masking (NRIC/Kad Pengenalan, Phone, Email)
 * 3. Anti-Brute Force & Request Rate Limiting (Sliding Window)
 * 4. Input Validation & Injection Defense
 * 5. Security Incident Logging
 */

export interface SecurityIncident {
  id: string;
  timestamp: string;
  type: 'rate_limit_exceeded' | 'suspicious_payload' | 'brute_force_attempt' | 'invalid_input_injection';
  severity: 'low' | 'medium' | 'high';
  description: string;
  source: string;
}

// -------------------------------------------------------------
// 1. Anti-XSS & Injection Sanitization
// -------------------------------------------------------------

/**
 * Sanitizes generic user input to prevent XSS, HTML injection, and script execution
 */
export function sanitizeInput(input: string | null | undefined): string {
  if (input === null || input === undefined) return '';
  let str = String(input);

  // Remove control characters & zero-width spaces
  str = str.replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g, '');

  // Strip script tags, javascript: pseudo-protocols, and inline event handlers
  str = str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  str = str.replace(/javascript:/gi, '');
  str = str.replace(/data:\s*text\/html/gi, '');
  str = str.replace(/on\w+\s*=/gi, '');

  // Strip dangerous HTML tags
  str = str.replace(/<[^>]+>/g, '');

  // Trim excess whitespace
  return str.trim();
}

/**
 * Encodes special characters into safe HTML entities
 */
export function escapeHtml(unsafe: string): string {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Sanitizes Account Number (strictly alphanumeric + dashes)
 */
export function sanitizeAccountNo(accountNo: string): string {
  if (!accountNo) return '';
  return sanitizeInput(accountNo).replace(/[^a-zA-Z0-9\-_]/g, '').slice(0, 50);
}

/**
 * Sanitizes Phone Number (digits, plus, dashes, spaces)
 */
export function sanitizePhone(phone: string): string {
  if (!phone) return '';
  return sanitizeInput(phone).replace(/[^0-9+\-\s()]/g, '').slice(0, 30);
}

/**
 * Sanitizes Email Address
 */
export function sanitizeEmail(email: string): string {
  if (!email) return '';
  return sanitizeInput(email).toLowerCase().replace(/[^a-z0-9@._\-+]/g, '').slice(0, 120);
}

// -------------------------------------------------------------
// 2. PDPA & Data Privacy Masking
// -------------------------------------------------------------

/**
 * Masks Malaysian IC (MyKad) to comply with PDPA Data Protection Act
 * Example: "880112-14-5543" -> "880112-••-••43" or "880112145543" -> "880112••••43"
 */
export function maskKadPengenalan(ic: string | null | undefined): string {
  if (!ic) return '-';
  const clean = String(ic).trim();
  if (clean.length < 6) return clean;

  if (clean.includes('-')) {
    const parts = clean.split('-');
    if (parts.length === 3) {
      // e.g. 880112-14-5543 -> 880112-••-••43
      const lastPart = parts[2];
      const last2 = lastPart.slice(-2);
      return `${parts[0]}-••-••${last2}`;
    }
  }

  // 12 digits plain
  if (clean.length === 12) {
    const first6 = clean.slice(0, 6);
    const last2 = clean.slice(10);
    return `${first6}-••-••${last2}`;
  }

  // Fallback for custom format: reveal first 3 and last 2 characters
  const first = clean.slice(0, 3);
  const last = clean.slice(-2);
  const dots = '•'.repeat(Math.max(2, clean.length - 5));
  return `${first}${dots}${last}`;
}

/**
 * Masks Phone Number for privacy
 * Example: "012-3456789" -> "012-•••-6789" or "0198765432" -> "019-•••-5432"
 */
export function maskPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return '-';
  const clean = String(phone).trim();
  const digitsOnly = clean.replace(/[^0-9]/g, '');

  if (digitsOnly.length >= 9) {
    const prefix = digitsOnly.slice(0, 3);
    const suffix = digitsOnly.slice(-4);
    return `${prefix}-•••-${suffix}`;
  }

  if (clean.length > 5) {
    return `${clean.slice(0, 3)}••••${clean.slice(-2)}`;
  }
  return clean;
}

/**
 * Masks Email Address for privacy
 * Example: "ahmad.abdullah@email.com" -> "ahm***h@email.com"
 */
export function maskEmailAddress(email: string | null | undefined): string {
  if (!email) return '-';
  const clean = String(email).trim().toLowerCase();
  const atIndex = clean.indexOf('@');
  if (atIndex <= 2) return clean;

  const username = clean.slice(0, atIndex);
  const domain = clean.slice(atIndex);

  if (username.length <= 3) {
    return `${username[0]}***${domain}`;
  }

  const first2 = username.slice(0, 2);
  const last1 = username.slice(-1);
  return `${first2}***${last1}${domain}`;
}

/**
 * Masks Full Name partially
 * Example: "Ahmad Bin Abdullah" -> "Ahmad B** A*******"
 */
export function maskFullName(name: string | null | undefined): string {
  if (!name) return '-';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length <= 1) return name;

  return parts
    .map((part, idx) => {
      if (idx === 0) return part; // Keep first name readable
      if (part.length <= 2) return `${part[0]}*`;
      return `${part[0]}${'*'.repeat(part.length - 1)}`;
    })
    .join(' ');
}

// -------------------------------------------------------------
// 3. Anti-Brute Force & Request Rate Limiter
// -------------------------------------------------------------

interface RateLimitTracker {
  attempts: number[];
  lockoutUntil: number;
}

class SlidingWindowRateLimiter {
  private trackers: Map<string, RateLimitTracker> = new Map();

  /**
   * Checks if an action is allowed under the rate limit
   * @param key Unique identifier for user/action (e.g. 'portal_lookup' or 'admin_login')
   * @param maxAttempts Max allowed attempts within window
   * @param windowMs Time window in milliseconds (e.g. 30000ms = 30s)
   * @param lockoutMs Lockout cooldown penalty if limit exceeded (e.g. 60000ms = 60s)
   */
  public checkRateLimit(
    key: string,
    maxAttempts: number = 8,
    windowMs: number = 30000,
    lockoutMs: number = 60000
  ): { allowed: boolean; remaining: number; lockoutSeconds: number } {
    const now = Date.now();
    let tracker = this.trackers.get(key);

    if (!tracker) {
      tracker = { attempts: [], lockoutUntil: 0 };
      this.trackers.set(key, tracker);
    }

    // Check active lockout
    if (tracker.lockoutUntil > now) {
      const lockoutSeconds = Math.ceil((tracker.lockoutUntil - now) / 1000);
      return { allowed: false, remaining: 0, lockoutSeconds };
    }

    // Filter attempts within sliding window
    tracker.attempts = tracker.attempts.filter((timestamp) => now - timestamp < windowMs);

    if (tracker.attempts.length >= maxAttempts) {
      // Trigger lockout
      tracker.lockoutUntil = now + lockoutMs;
      const lockoutSeconds = Math.ceil(lockoutMs / 1000);
      logSecurityIncident({
        type: 'rate_limit_exceeded',
        severity: 'medium',
        description: `Kadar permintaan melampaui had (${maxAttempts} kali dalam ${windowMs / 1000}s) untuk tindakan "${key}". Penyekatan automatik ${lockoutSeconds}s diaktifkan.`,
        source: key,
      });
      return { allowed: false, remaining: 0, lockoutSeconds };
    }

    // Record this attempt
    tracker.attempts.push(now);
    const remaining = maxAttempts - tracker.attempts.length;

    return { allowed: true, remaining, lockoutSeconds: 0 };
  }

  public resetKey(key: string) {
    this.trackers.delete(key);
  }
}

export const securityRateLimiter = new SlidingWindowRateLimiter();

// -------------------------------------------------------------
// 4. Security Incident Logger & Audit Store
// -------------------------------------------------------------

const STORAGE_SECURITY_LOGS_KEY = 'ekemaskini_security_incident_logs';

export function logSecurityIncident(incident: Omit<SecurityIncident, 'id' | 'timestamp'>) {
  const newEntry: SecurityIncident = {
    id: `sec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
    ...incident,
  };

  try {
    const existing = getStoredSecurityIncidents();
    const updated = [newEntry, ...existing].slice(0, 100); // keep last 100
    localStorage.setItem(STORAGE_SECURITY_LOGS_KEY, JSON.stringify(updated));
  } catch {}

  console.warn(`🛡️ [Cybersecurity Guard]:`, newEntry);
}

export function getStoredSecurityIncidents(): SecurityIncident[] {
  try {
    const saved = localStorage.getItem(STORAGE_SECURITY_LOGS_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return [];
}

export function clearSecurityIncidents() {
  try {
    localStorage.removeItem(STORAGE_SECURITY_LOGS_KEY);
  } catch {}
}

// -------------------------------------------------------------
// 5. Input Validation Rules
// -------------------------------------------------------------

export function isValidMalaysianPhone(phone: string): boolean {
  if (!phone) return false;
  const digits = phone.replace(/[^0-9]/g, '');
  // Malaysian mobile phones start with 01 (9 to 11 digits) or +601
  return digits.length >= 9 && digits.length <= 13 && (digits.startsWith('01') || digits.startsWith('601'));
}

export function isValidEmailFormat(email: string): boolean {
  if (!email) return false;
  const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return regex.test(email);
}

// -------------------------------------------------------------
// 6. Cryptographic Password Protection & Verification (SHA-256)
// -------------------------------------------------------------

const CRYPTO_SALT = 'jnol_ekemaskini_sec_v2026_salt_91823';

/**
 * Pure TypeScript standard SHA-256 cryptographic hash function
 * Produces deterministic 256-bit hex string without external libraries
 */
export function sha256Hex(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }
  
  const utf8: number[] = [];
  for (let c = 0; c < ascii.length; c++) {
    let charcode = ascii.charCodeAt(c);
    if (charcode < 0x80) utf8.push(charcode);
    else if (charcode < 0x800) {
      utf8.push(0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f));
    } else if (charcode < 0xd800 || charcode >= 0xe000) {
      utf8.push(0xe0 | (charcode >> 12), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f));
    } else {
      c++;
      charcode = 0x10000 + (((charcode & 0x3ff) << 10) | (ascii.charCodeAt(c) & 0x3ff));
      utf8.push(0xf0 | (charcode >> 18), 0x80 | ((charcode >> 12) & 0x3f), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f));
    }
  }

  const bitLength = utf8.length * 8;
  utf8.push(0x80);
  while ((utf8.length % 64) !== 56) utf8.push(0);
  for (let n = 0; n < 8; n++) {
    utf8.push((bitLength >>> (56 - n * 8)) & 0xff);
  }

  const words: number[] = [];
  for (let w = 0; w < utf8.length; w += 4) {
    words.push((utf8[w] << 24) | (utf8[w + 1] << 16) | (utf8[w + 2] << 8) | utf8[w + 3]);
  }

  let hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  for (let j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = [...hash];

    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15], w2 = w[i - 2];
      const a = hash[0], e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);

      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

      hash = [(temp1 + temp2) | 0, hash[0], hash[1], hash[2], (hash[3] + temp1) | 0, hash[4], hash[5], hash[6]];
    }

    for (let i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  let result = '';
  for (let i = 0; i < 8; i++) {
    for (let j = 3; j >= 0; j--) {
      const b = (hash[i] >> (8 * j)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

/**
 * Hashes a plaintext password with internal cryptographic salt
 */
export function hashPassword(plain: string): string {
  return sha256Hex(`${CRYPTO_SALT}:${plain.trim()}`);
}

// Compute official system password cryptographic hashes
// Admin: admin@13813
// Super Admin: jnolai@13813
const SECURE_ADMIN_HASH = hashPassword('admin@13813');
const SECURE_SUPER_ADMIN_HASH = hashPassword('jnolai@13813');

/**
 * Verifies if user input matches Admin or Super Admin credentials securely
 */
export function verifyAdminCredentials(inputPassword: string): { valid: boolean; role: 'super_admin' | 'admin' | null } {
  if (!inputPassword) return { valid: false, role: null };
  const sanitized = sanitizeInput(inputPassword).trim();
  const inputHash = hashPassword(sanitized);

  if (inputHash === SECURE_SUPER_ADMIN_HASH) {
    return { valid: true, role: 'super_admin' };
  }

  if (inputHash === SECURE_ADMIN_HASH) {
    return { valid: true, role: 'admin' };
  }

  // Also support dynamic custom overrides if set by user
  try {
    const customAdminHash = localStorage.getItem('customer_portal_admin_hash_v2');
    if (customAdminHash && inputHash === customAdminHash) {
      return { valid: true, role: 'admin' };
    }
    const customSuperAdminHash = localStorage.getItem('customer_portal_super_admin_hash_v2');
    if (customSuperAdminHash && inputHash === customSuperAdminHash) {
      return { valid: true, role: 'super_admin' };
    }
  } catch {}

  return { valid: false, role: null };
}

/**
 * Purge legacy plaintext test passwords from localStorage to prevent hijacking
 */
export function purgeLegacyCredentials(): void {
  try {
    const legacyAdminPass = localStorage.getItem('customer_portal_admin_password');
    const legacySuperPass = localStorage.getItem('customer_portal_super_admin_password');
    if (legacyAdminPass === 'admin123' || legacyAdminPass) {
      localStorage.removeItem('customer_portal_admin_password');
    }
    if (legacySuperPass === 'superadmin123' || legacySuperPass) {
      localStorage.removeItem('customer_portal_super_admin_password');
    }
  } catch {}
}

