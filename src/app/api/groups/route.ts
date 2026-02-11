import { NextResponse } from 'next/server';
import { getGroups, saveGroups, Group, getTodos, saveTodos } from '@/lib/storage';
import { validateGroupName, validateUUID } from '@/lib/validation';
import { checkRateLimit } from '@/lib/ratelimit';

const AUTH_PASSWORD = process.env.AUTH_PASSWORD || 'stark123';

function verifyApiKey(request: Request): boolean {
  const apiKey = request.headers.get('X-API-Key') || request.headers.get('Authorization')?.replace('Bearer ', '');
  return apiKey === AUTH_PASSWORD;
}

function unauthorizedResponse() {
  return NextResponse.json(
    {
      error: 'Unauthorized',
      message: 'Valid API key required.'
    },
    { status: 401 }
  );
}

function rateLimitResponse(resetTime: number, remaining: number) {
  const resetTimeSeconds = Math.ceil((resetTime - Date.now()) / 1000);
  return NextResponse.json(
    {
      error: 'Rate limit exceeded',
      message: `Too many requests. Please try again in ${resetTimeSeconds} seconds.`
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(resetTimeSeconds),
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': String(remaining),
        'X-RateLimit-Reset': String(resetTime),
      }
    }
  );
}

export async function GET(request: Request) {
  try {
    // Rate limiting - 防止滥用
    const rateLimit = checkRateLimit(request);
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.resetTime, rateLimit.remaining);
    }

    const groups = getGroups();
    return NextResponse.json(groups);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch groups' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // Rate limiting
    const rateLimit = checkRateLimit(request);
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.resetTime, rateLimit.remaining);
    }

    if (!verifyApiKey(request)) return unauthorizedResponse();

    const body = await request.json();

    // Validate and sanitize group name
    const validatedName = validateGroupName(body.name);

    const groups = getGroups();
    const newGroup: Group = {
      id: crypto.randomUUID(),
      name: validatedName,
      createdAt: Date.now(),
    };

    groups.push(newGroup);
    saveGroups(groups);

    return NextResponse.json(newGroup, { status: 201 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to create group';
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    // Rate limiting
    const rateLimit = checkRateLimit(request);
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.resetTime, rateLimit.remaining);
    }

    if (!verifyApiKey(request)) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    // Validate ID and prevent deletion of default group
    if (!id || id === 'default') {
      return NextResponse.json({ error: 'Valid ID is required' }, { status: 400 });
    }

    const validatedId = validateUUID(id);

    const groups = getGroups();
    const filteredGroups = groups.filter((g) => g.id !== validatedId);
    saveGroups(filteredGroups);

    // 迁移该分组下的任务到默认分组
    const todos = getTodos();
    const updatedTodos = todos.map(todo => {
      if (todo.groupId === validatedId) {
        return { ...todo, groupId: 'default' };
      }
      return todo;
    });
    saveTodos(updatedTodos);

    return NextResponse.json({ success: true, id: validatedId });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete group';
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}
