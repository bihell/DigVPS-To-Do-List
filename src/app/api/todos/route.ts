import { NextResponse } from 'next/server';
import { getTodos, saveTodos, deleteTodoLikes, Todo } from '@/lib/storage';
import {
  validateTodoText,
  validateGroupId,
  validatePriority,
  validateTimestamp,
  validateBoolean,
  validateUUID
} from '@/lib/validation';
import { checkRateLimit } from '@/lib/ratelimit';

// API 密码验证
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || 'stark123';

function verifyApiKey(request: Request): boolean {
  const apiKey = request.headers.get('X-API-Key') || request.headers.get('Authorization')?.replace('Bearer ', '');
  return apiKey === AUTH_PASSWORD;
}

function unauthorizedResponse() {
  return NextResponse.json(
    {
      error: 'Unauthorized',
      message: 'Valid API key required. Use header: X-API-Key: <password> or Authorization: Bearer <password>'
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

// GET - 获取所有任务（公开访问，但有速率限制）
export async function GET(request: Request) {
  try {
    // Rate limiting - 防止滥用
    const rateLimit = checkRateLimit(request);
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.resetTime, rateLimit.remaining);
    }

    const todos = getTodos();
    // 只返回未删除的任务
    const activeTodos = todos.filter(t => !t.deleted);
    console.log(`[API GET] Returning ${activeTodos.length} active todos`);
    return NextResponse.json(activeTodos);
  } catch (error) {
    console.error('[API GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch todos' }, { status: 500 });
  }
}

// POST - 创建新任务（需要认证）
export async function POST(request: Request) {
  try {
    // Rate limiting
    const rateLimit = checkRateLimit(request);
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.resetTime, rateLimit.remaining);
    }

    // 验证 API Key
    if (!verifyApiKey(request)) {
      return unauthorizedResponse();
    }

    const body = await request.json();

    // Validate and sanitize all inputs
    const validatedText = validateTodoText(body.text);
    const validatedGroupId = body.groupId ? validateGroupId(body.groupId) : 'default';
    const validatedPriority = validatePriority(body.priority);
    const validatedCreatedAt = validateTimestamp(body.createdAt);

    const todos = getTodos();
    const newTodo: Todo = {
      id: crypto.randomUUID(),
      text: validatedText,
      completed: false,
      createdAt: validatedCreatedAt,
      groupId: validatedGroupId,
      priority: validatedPriority,
    };

    todos.push(newTodo);
    saveTodos(todos);

    console.log(`[API POST] Created todo: ${newTodo.id}`);
    return NextResponse.json(newTodo, { status: 201 });
  } catch (error) {
    console.error('[API POST] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create todo';
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}

// PUT - 更新任务（需要认证）
export async function PUT(request: Request) {
  try {
    // Rate limiting
    const rateLimit = checkRateLimit(request);
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.resetTime, rateLimit.remaining);
    }

    // 验证 API Key
    if (!verifyApiKey(request)) {
      return unauthorizedResponse();
    }

    const body = await request.json();

    // Validate ID
    const validatedId = validateUUID(body.id);

    const todos = getTodos();
    const index = todos.findIndex((t) => t.id === validatedId);

    if (index === -1) {
      console.warn(`[API PUT] Todo not found: ${validatedId}`);
      return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
    }

    // Validate and update text
    if (body.text !== undefined) {
      todos[index].text = validateTodoText(body.text);
    }

    // Validate and update created time
    if (body.createdAt !== undefined) {
      todos[index].createdAt = validateTimestamp(body.createdAt);
    }

    // Validate and update completed status
    if (body.completed !== undefined) {
      const validatedCompleted = validateBoolean(body.completed);
      todos[index].completed = validatedCompleted;

      if (validatedCompleted) {
        todos[index].completedAt = validateTimestamp(body.completedAt);
      } else {
        delete todos[index].completedAt;
      }
    } else if (body.completedAt !== undefined && todos[index].completed) {
      todos[index].completedAt = validateTimestamp(body.completedAt);
    }

    // Validate and update group and priority
    if (body.groupId !== undefined) {
      todos[index].groupId = validateGroupId(body.groupId);
    }
    if (body.priority !== undefined) {
      todos[index].priority = validatePriority(body.priority);
    }

    saveTodos(todos);

    console.log(`[API PUT] Updated todo: ${validatedId}`);
    return NextResponse.json(todos[index]);
  } catch (error) {
    console.error('[API PUT] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update todo';
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}

// DELETE - 删除任务（需要认证）
export async function DELETE(request: Request) {
  try {
    // Rate limiting
    const rateLimit = checkRateLimit(request);
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.resetTime, rateLimit.remaining);
    }

    // 验证 API Key
    if (!verifyApiKey(request)) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    // Validate ID
    const validatedId = validateUUID(id);

    const todos = getTodos();
    const index = todos.findIndex((t) => t.id === validatedId);

    if (index === -1) {
      console.warn(`[API DELETE] Todo not found: ${validatedId}`);
      return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
    }

    // 执行逻辑删除
    todos[index].deleted = true;
    todos[index].deletedAt = Date.now();

    saveTodos(todos);

    // 清理该任务的点赞 IP 记录
    deleteTodoLikes(validatedId);

    console.log(`[API DELETE] Deleted todo: ${validatedId}`);
    return NextResponse.json({ success: true, id: validatedId });
  } catch (error) {
    console.error('[API DELETE] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete todo';
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}
