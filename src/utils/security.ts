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
