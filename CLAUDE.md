# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev          # Start dev server on port 3001
npm run build        # Build for production
npm start            # Start production server on port 3001
npm run lint         # Run Next.js linter
```

Docker deployment:
```bash
./docker-start.sh    # Start with Docker
./docker-update.sh   # Update & rebuild
./run.sh start       # Local management script
```

## Architecture Overview

**Stack**: Next.js 15 (App Router) + TypeScript + Tailwind CSS + Framer Motion

**Data Storage**: File-based JSON (no database) - `todos.json`, `groups.json`, `stats.json` stored in project root or `$DATA_DIR`

**Authentication**: Password-based via `AUTH_PASSWORD` env variable (default: `stark123`). API endpoints require `X-API-Key` or `Authorization: Bearer` headers.

### Key Directories

- `src/app/` - Next.js App Router pages and API routes
- `src/app/api/` - REST API endpoints (todos, groups, stats, auth)
- `src/components/` - Reusable React components
- `src/contexts/` - React Context (SettingsContext, AuthContext)
- `src/lib/` - Utilities (storage.ts, translations.ts, types.ts)

### Core Patterns

**State Management**: React Context API
- `SettingsContext`: language, theme, timezone, logoText (persisted to localStorage)
- `AuthContext`: authentication state (client-side)

**API Authentication**: Use `verifyApiKey()` from storage.ts for protected endpoints

**Internationalization**: English and Chinese via `src/lib/translations.ts`
```typescript
const t = translations[settings.language];
```

**Dark Mode**: CSS class-based (`dark:` prefix in Tailwind)

**Data Types**:
```typescript
type Priority = 'P0' | 'P1' | 'P2';
interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
  completedAt?: number;
  deleted?: boolean;
  deletedAt?: number;
  groupId?: string;
  priority?: Priority;
}
```

### API Endpoints

| Endpoint | Methods | Auth Required |
|----------|---------|---------------|
| `/api/todos` | GET, POST, PUT, DELETE | POST/PUT/DELETE |
| `/api/groups` | GET, POST, DELETE | POST/DELETE |
| `/api/stats` | GET, POST | No |
| `/api/auth` | POST | No |

## UI/UX Guidelines

Reference `.cursor/commands/ui-ux-pro-max.md` for detailed UI/UX workflow including:
- Glassmorphism design patterns
- Mobile-first responsive design
- Framer Motion animation standards
- Color scheme: blue-600, emerald-500, amber-500, red-500
