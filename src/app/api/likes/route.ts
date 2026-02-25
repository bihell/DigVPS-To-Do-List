import { NextResponse } from 'next/server';
import { getLikes, saveLikes, getTodos, saveTodos } from '@/lib/storage';
import { validateUUID } from '@/lib/validation';
import { checkRateLimit } from '@/lib/ratelimit';

function getClientIP(request: Request): string {
  const forwarded = request.headers.get('X-Forwarded-For');
  if (forwarded) return forwarded.split(',')[0].trim();
  const realIP = request.headers.get('X-Real-IP');
  if (realIP) return realIP.trim();
  return '127.0.0.1';
}

function rateLimitResponse(resetTime: number, remaining: number) {
  const resetTimeSeconds = Math.ceil((resetTime - Date.now()) / 1000);
  return NextResponse.json(
    { error: 'Rate limit exceeded', message: `Too many requests. Try again in ${resetTimeSeconds} seconds.` },
    {
      status: 429,
      headers: {
        'Retry-After': String(resetTimeSeconds),
        'X-RateLimit-Remaining': String(remaining),
        'X-RateLimit-Reset': String(resetTime),
      }
    }
  );
}

// GET - 返回当前 IP 已点赞的任务 ID 列表
export async function GET(request: Request) {
  try {
    const rateLimit = checkRateLimit(request);
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.resetTime, rateLimit.remaining);
    }

    const ip = getClientIP(request);
    const likes = getLikes();

    const likedTodoIds = Object.entries(likes)
      .filter(([, ips]) => ips.includes(ip))
      .map(([todoId]) => todoId);

    return NextResponse.json({ likedTodoIds });
  } catch (error) {
    console.error('[API GET /likes] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch likes' }, { status: 500 });
  }
}

// POST - 点赞/取消点赞（匿名，记录 IP，同一 IP 只能点一次）
export async function POST(request: Request) {
  try {
    const rateLimit = checkRateLimit(request);
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.resetTime, rateLimit.remaining);
    }

    const body = await request.json();
    const todoId = validateUUID(body.todoId);
    const ip = getClientIP(request);

    // 验证任务存在且未删除
    const todos = getTodos();
    const todoIndex = todos.findIndex(t => t.id === todoId && !t.deleted);
    if (todoIndex === -1) {
      return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
    }

    const likes = getLikes();
    if (!likes[todoId]) {
      likes[todoId] = [];
    }

    const alreadyLiked = likes[todoId].includes(ip);

    if (alreadyLiked) {
      // 取消点赞
      likes[todoId] = likes[todoId].filter(likedIp => likedIp !== ip);
      todos[todoIndex].likes = Math.max(0, (todos[todoIndex].likes || 0) - 1);
    } else {
      // 添加点赞
      likes[todoId].push(ip);
      todos[todoIndex].likes = (todos[todoIndex].likes || 0) + 1;
    }

    saveLikes(likes);
    saveTodos(todos);

    console.log(`[API POST /likes] ${alreadyLiked ? 'Unliked' : 'Liked'} todo ${todoId} by IP ${ip}`);
    return NextResponse.json({
      liked: !alreadyLiked,
      likes: todos[todoIndex].likes,
    });
  } catch (error) {
    console.error('[API POST /likes] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to like todo';
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}
