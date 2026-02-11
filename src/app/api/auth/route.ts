import { NextResponse } from 'next/server';
import { checkAuthRateLimit } from '@/lib/ratelimit';

// 预设密码，可通过环境变量 AUTH_PASSWORD 配置
// 默认密码: stark123
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || 'stark123';

export async function POST(request: Request) {
  try {
    // Apply rate limiting to prevent brute force attacks
    const rateLimit = checkAuthRateLimit(request);
    if (!rateLimit.allowed) {
      const resetTimeSeconds = Math.ceil((rateLimit.resetTime - Date.now()) / 1000);
      console.warn('[Auth] Rate limit exceeded');
      return NextResponse.json(
        {
          success: false,
          message: `Too many login attempts. Please try again in ${resetTimeSeconds} seconds.`
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(resetTimeSeconds),
            'X-RateLimit-Limit': '5',
            'X-RateLimit-Remaining': String(rateLimit.remaining),
            'X-RateLimit-Reset': String(rateLimit.resetTime),
          }
        }
      );
    }

    const { password } = await request.json();

    if (!password) {
      return NextResponse.json(
        { success: false, message: 'Password is required' },
        { status: 400 }
      );
    }

    const isValid = password === AUTH_PASSWORD;

    if (isValid) {
      console.log('[Auth] User authenticated successfully');
      return NextResponse.json({ success: true });
    } else {
      console.log('[Auth] Invalid password attempt');
      return NextResponse.json(
        { success: false, message: 'Invalid password' },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('[Auth] Error:', error);
    return NextResponse.json(
      { success: false, message: 'Server error' },
      { status: 500 }
    );
  }
}
