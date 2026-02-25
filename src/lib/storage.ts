import fs from 'fs';
import path from 'path';
import { Todo, Group, DEFAULT_GROUP_ID } from './types';

/**
 * Validate and sanitize DATA_DIR to prevent path traversal attacks
 */
function validateDataDir(dir: string): string {
  // Resolve to absolute path
  const resolvedPath = path.resolve(dir);

  // Ensure the path doesn't contain dangerous patterns
  const normalizedPath = path.normalize(resolvedPath);

  // Check for path traversal attempts
  if (normalizedPath.includes('..')) {
    console.error('[Storage] Path traversal attempt detected:', dir);
    throw new Error('Invalid data directory path');
  }

  // On Unix systems, ensure path is within allowed directories
  if (process.platform !== 'win32') {
    // Allow /app (Docker), /var, /tmp, or current working directory tree
    const allowedPrefixes = [
      '/app',
      '/var',
      '/tmp',
      process.cwd(),
    ];

    const isAllowed = allowedPrefixes.some(prefix =>
      normalizedPath.startsWith(path.resolve(prefix))
    );

    if (!isAllowed) {
      console.error('[Storage] Data directory outside allowed paths:', normalizedPath);
      throw new Error('Data directory must be within allowed paths');
    }
  }

  return normalizedPath;
}

// 支持 Docker 数据目录 and 本地开发
const DATA_DIR = validateDataDir(process.env.DATA_DIR || process.cwd());
const DATA_FILE = path.join(DATA_DIR, 'todos.json');
const GROUPS_FILE = path.join(DATA_DIR, 'groups.json');
const LIKES_FILE = path.join(DATA_DIR, 'likes.json');

export { DEFAULT_GROUP_ID };
export type { Todo, Group };

export const getTodos = (): Todo[] => {
  try {
    // 确保目录存在
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // 如果文件不存在，创建空数组
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, '[]', 'utf-8');
      console.log(`[Storage] Created new todos file: ${DATA_FILE}`);
      return [];
    }
    
    const data = fs.readFileSync(DATA_FILE, 'utf-8');
    let todos: Todo[] = JSON.parse(data);
    
    // 迁移逻辑：确保所有任务都有 groupId，如果没有则归入默认分组
    let needsSave = false;
    todos = todos.map(todo => {
      if (!todo.groupId) {
        todo.groupId = DEFAULT_GROUP_ID;
        needsSave = true;
      }
      return todo;
    });

    if (needsSave) {
      saveTodos(todos);
    }

    console.log(`[Storage] Loaded ${todos.length} todos from ${DATA_FILE}`);
    return todos;
  } catch (error) {
    console.error('[Storage] Error reading todos:', error);
    return [];
  }
};

export const saveTodos = (todos: Todo[]) => {
  try {
    // 确保目录存在
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(DATA_FILE, JSON.stringify(todos, null, 2), 'utf-8');
    console.log(`[Storage] Saved ${todos.length} todos to ${DATA_FILE}`);
  } catch (error) {
    console.error('[Storage] Error saving todos:', error);
    throw error; // 抛出错误以便 API 能捕获
  }
};

export const getGroups = (): Group[] => {
  try {
    const dir = path.dirname(GROUPS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    if (!fs.existsSync(GROUPS_FILE)) {
      const defaultGroups: Group[] = [{ id: DEFAULT_GROUP_ID, name: 'Default', createdAt: Date.now() }];
      fs.writeFileSync(GROUPS_FILE, JSON.stringify(defaultGroups, null, 2), 'utf-8');
      return defaultGroups;
    }
    
    const data = fs.readFileSync(GROUPS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('[Storage] Error reading groups:', error);
    return [{ id: DEFAULT_GROUP_ID, name: 'Default', createdAt: Date.now() }];
  }
};

export const saveGroups = (groups: Group[]) => {
  try {
    const dir = path.dirname(GROUPS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(GROUPS_FILE, JSON.stringify(groups, null, 2), 'utf-8');
  } catch (error) {
    console.error('[Storage] Error saving groups:', error);
    throw error;
  }
};

// likes.json 结构: { [todoId]: string[] } 存储每个任务的点赞 IP 列表
export const getLikes = (): Record<string, string[]> => {
  try {
    const dir = path.dirname(LIKES_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(LIKES_FILE)) {
      fs.writeFileSync(LIKES_FILE, '{}', 'utf-8');
      return {};
    }
    const data = fs.readFileSync(LIKES_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('[Storage] Error reading likes:', error);
    return {};
  }
};

export const saveLikes = (likes: Record<string, string[]>) => {
  try {
    const dir = path.dirname(LIKES_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(LIKES_FILE, JSON.stringify(likes, null, 2), 'utf-8');
  } catch (error) {
    console.error('[Storage] Error saving likes:', error);
    throw error;
  }
};

export const deleteTodoLikes = (todoId: string) => {
  try {
    const likes = getLikes();
    delete likes[todoId];
    saveLikes(likes);
  } catch (error) {
    console.error('[Storage] Error deleting todo likes:', error);
  }
};

