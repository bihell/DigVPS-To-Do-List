/**
 * Rate limiting utility to prevent brute force attacks
 * Simple in-memory rate limiter (for production, consider Redis)
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// Store rate limit data in memory (per IP address)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Configuration
const MAX_REQUESTS = 100; // Maximum requests per window (100 requests/minute)
const WINDOW_MS = 60 * 1000; // 1 minute window
const CLEANUP_INTERVAL = 5 * 60 * 1000; // Clean up every 5 minutes

// Periodic cleanup to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(ip);
    }
  }
}, CLEANUP_INTERVAL);

/**
 * Get client IP from request
 * Supports various proxy headers for accurate IP detection
 */
function getClientIp(request: Request): string {
  // Priority order for proxy headers:
  // 1. CF-Connecting-IP (Cloudflare)
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) {
    return cfIp.trim();
  }

  // 2. X-Real-IP (Nginx, other reverse proxies)
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  // 3. X-Forwarded-For (standard proxy header, take first IP)
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  // 4. True-Client-IP (Akamai, Cloudflare)
  const trueClientIp = request.headers.get('true-client-ip');
  if (trueClientIp) {
    return trueClientIp.trim();
  }

  // Fallback: return a default identifier
  // Note: In production behind a proxy, this should rarely be reached
  console.warn('[RateLimit] Could not determine client IP, using fallback');
  return 'unknown';
}

/**
 * Check if request should be rate limited
 * @returns true if request should be allowed, false if rate limited
 */
export function checkRateLimit(request: Request): { allowed: boolean; remaining: number; resetTime: number } {
  const clientIp = getClientIp(request);
  const now = Date.now();

  let entry = rateLimitStore.get(clientIp);

  // Initialize or reset if window expired
  if (!entry || now > entry.resetTime) {
    entry = {
      count: 1,
      resetTime: now + WINDOW_MS,
    };
    rateLimitStore.set(clientIp, entry);

    return {
      allowed: true,
      remaining: MAX_REQUESTS - 1,
      resetTime: entry.resetTime,
    };
  }

  // Increment count
  entry.count++;

  // Check if limit exceeded
  if (entry.count > MAX_REQUESTS) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
    };
  }

  return {
    allowed: true,
    remaining: MAX_REQUESTS - entry.count,
    resetTime: entry.resetTime,
  };
}

/**
 * More strict rate limit for auth endpoints (prevent brute force)
 */
const authRateLimitStore = new Map<string, RateLimitEntry>();
const AUTH_MAX_REQUESTS = 5; // Only 5 attempts per window
const AUTH_WINDOW_MS = 15 * 60 * 1000; // 15 minute window

// Cleanup for auth rate limits
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of authRateLimitStore.entries()) {
    if (now > entry.resetTime) {
      authRateLimitStore.delete(ip);
    }
  }
}, CLEANUP_INTERVAL);

export function checkAuthRateLimit(request: Request): { allowed: boolean; remaining: number; resetTime: number } {
  const clientIp = getClientIp(request);
  const now = Date.now();

  let entry = authRateLimitStore.get(clientIp);

  if (!entry || now > entry.resetTime) {
    entry = {
      count: 1,
      resetTime: now + AUTH_WINDOW_MS,
    };
    authRateLimitStore.set(clientIp, entry);

    return {
      allowed: true,
      remaining: AUTH_MAX_REQUESTS - 1,
      resetTime: entry.resetTime,
    };
  }

  entry.count++;

  if (entry.count > AUTH_MAX_REQUESTS) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
    };
  }

  return {
    allowed: true,
    remaining: AUTH_MAX_REQUESTS - entry.count,
    resetTime: entry.resetTime,
  };
}
