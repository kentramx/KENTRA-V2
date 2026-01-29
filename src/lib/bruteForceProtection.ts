/**
 * Brute Force Protection for Login Attempts
 *
 * Implements exponential backoff to prevent brute force attacks:
 * - Tracks failed attempts per email
 * - Increases delay exponentially after each failure
 * - Temporary lockout after max attempts
 * - Resets on successful login
 */

const STORAGE_KEY = 'login_attempts';
const MAX_ATTEMPTS = 5;
const INITIAL_DELAY_MS = 1000; // 1 second
const MAX_DELAY_MS = 300000; // 5 minutes
const LOCKOUT_DURATION_MS = 900000; // 15 minutes lockout after max attempts
const ATTEMPT_WINDOW_MS = 3600000; // 1 hour window for attempts

interface AttemptRecord {
  count: number;
  lastAttempt: number;
  lockoutUntil?: number;
}

interface AttemptsStorage {
  [email: string]: AttemptRecord;
}

/**
 * Get current attempts from localStorage
 */
function getAttempts(): AttemptsStorage {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return {};
    return JSON.parse(stored) as AttemptsStorage;
  } catch {
    return {};
  }
}

/**
 * Save attempts to localStorage
 */
function saveAttempts(attempts: AttemptsStorage): void {
  try {
    // Clean up old entries first
    const now = Date.now();
    const cleaned: AttemptsStorage = {};

    for (const [email, record] of Object.entries(attempts)) {
      // Keep if within attempt window or still locked out
      if (
        now - record.lastAttempt < ATTEMPT_WINDOW_MS ||
        (record.lockoutUntil && record.lockoutUntil > now)
      ) {
        cleaned[email] = record;
      }
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Calculate exponential backoff delay
 */
function calculateDelay(attemptCount: number): number {
  if (attemptCount <= 1) return 0;

  // Exponential backoff: delay = initial * 2^(attempts-1)
  // Cap at MAX_DELAY_MS
  const delay = Math.min(
    INITIAL_DELAY_MS * Math.pow(2, attemptCount - 1),
    MAX_DELAY_MS
  );

  return delay;
}

export interface BruteForceCheckResult {
  allowed: boolean;
  waitMs?: number;
  waitUntil?: Date;
  attemptsRemaining?: number;
  isLockedOut?: boolean;
}

/**
 * Check if a login attempt is allowed
 * Returns whether attempt is allowed and any required wait time
 */
export function checkLoginAttempt(email: string): BruteForceCheckResult {
  const normalizedEmail = email.toLowerCase().trim();
  const attempts = getAttempts();
  const record = attempts[normalizedEmail];
  const now = Date.now();

  // No previous attempts
  if (!record) {
    return {
      allowed: true,
      attemptsRemaining: MAX_ATTEMPTS,
    };
  }

  // Check if locked out
  if (record.lockoutUntil && record.lockoutUntil > now) {
    const waitMs = record.lockoutUntil - now;
    return {
      allowed: false,
      isLockedOut: true,
      waitMs,
      waitUntil: new Date(record.lockoutUntil),
      attemptsRemaining: 0,
    };
  }

  // Reset if outside attempt window
  if (now - record.lastAttempt > ATTEMPT_WINDOW_MS) {
    return {
      allowed: true,
      attemptsRemaining: MAX_ATTEMPTS,
    };
  }

  // Calculate required delay
  const requiredDelay = calculateDelay(record.count);
  const timeSinceLastAttempt = now - record.lastAttempt;

  if (timeSinceLastAttempt < requiredDelay) {
    const waitMs = requiredDelay - timeSinceLastAttempt;
    return {
      allowed: false,
      waitMs,
      waitUntil: new Date(now + waitMs),
      attemptsRemaining: Math.max(0, MAX_ATTEMPTS - record.count),
    };
  }

  return {
    allowed: true,
    attemptsRemaining: Math.max(0, MAX_ATTEMPTS - record.count),
  };
}

/**
 * Record a failed login attempt
 * Should be called after authentication fails
 */
export function recordFailedAttempt(email: string): BruteForceCheckResult {
  const normalizedEmail = email.toLowerCase().trim();
  const attempts = getAttempts();
  const record = attempts[normalizedEmail];
  const now = Date.now();

  let newCount: number;
  let lockoutUntil: number | undefined;

  if (!record || now - record.lastAttempt > ATTEMPT_WINDOW_MS) {
    // First attempt or reset
    newCount = 1;
  } else {
    newCount = record.count + 1;
  }

  // Check if we should lock out
  if (newCount >= MAX_ATTEMPTS) {
    lockoutUntil = now + LOCKOUT_DURATION_MS;
  }

  // Update record
  attempts[normalizedEmail] = {
    count: newCount,
    lastAttempt: now,
    lockoutUntil,
  };

  saveAttempts(attempts);

  // Return status for feedback
  if (lockoutUntil) {
    return {
      allowed: false,
      isLockedOut: true,
      waitMs: LOCKOUT_DURATION_MS,
      waitUntil: new Date(lockoutUntil),
      attemptsRemaining: 0,
    };
  }

  const nextDelay = calculateDelay(newCount);
  return {
    allowed: false,
    waitMs: nextDelay,
    waitUntil: new Date(now + nextDelay),
    attemptsRemaining: Math.max(0, MAX_ATTEMPTS - newCount),
  };
}

/**
 * Clear failed attempts for an email
 * Should be called after successful login
 */
export function clearFailedAttempts(email: string): void {
  const normalizedEmail = email.toLowerCase().trim();
  const attempts = getAttempts();

  if (attempts[normalizedEmail]) {
    delete attempts[normalizedEmail];
    saveAttempts(attempts);
  }
}

/**
 * Get human-readable wait time message
 */
export function formatWaitTime(waitMs: number): string {
  const seconds = Math.ceil(waitMs / 1000);
  const minutes = Math.ceil(waitMs / 60000);

  if (seconds < 60) {
    return `${seconds} segundo${seconds !== 1 ? 's' : ''}`;
  }

  return `${minutes} minuto${minutes !== 1 ? 's' : ''}`;
}

/**
 * Get user-friendly error message for rate limiting
 */
export function getRateLimitMessage(result: BruteForceCheckResult): string {
  if (result.isLockedOut) {
    return `Tu cuenta ha sido bloqueada temporalmente por seguridad. Por favor intenta de nuevo en ${formatWaitTime(result.waitMs || 0)}.`;
  }

  if (result.waitMs) {
    return `Demasiados intentos fallidos. Por favor espera ${formatWaitTime(result.waitMs)} antes de intentar de nuevo.`;
  }

  return 'Por favor intenta de nuevo.';
}
