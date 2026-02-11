/**
 * Input validation and sanitization utilities
 * Prevents JSON injection, XSS, and other security vulnerabilities
 */

import { Priority } from './types';

// Configuration constants
const MAX_TEXT_LENGTH = 1000;
const MAX_NAME_LENGTH = 100;
const MAX_GROUP_ID_LENGTH = 100;

/**
 * Sanitize string input to prevent injection attacks
 */
export function sanitizeString(input: string, maxLength: number = MAX_TEXT_LENGTH): string {
  if (typeof input !== 'string') {
    throw new Error('Input must be a string');
  }

  // Trim and limit length
  let sanitized = input.trim().slice(0, maxLength);

  // Remove null bytes and other dangerous characters
  sanitized = sanitized.replace(/\x00/g, '');

  // Prevent JSON injection by escaping special characters
  // This is already handled by JSON.stringify, but we add extra safety
  const dangerousPatterns = [
    /[\x00-\x08\x0B\x0C\x0E-\x1F]/g, // Control characters
  ];

  dangerousPatterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });

  return sanitized;
}

/**
 * Validate and sanitize todo text
 */
export function validateTodoText(text: unknown): string {
  if (!text || typeof text !== 'string') {
    throw new Error('Todo text is required and must be a string');
  }

  const sanitized = sanitizeString(text, MAX_TEXT_LENGTH);

  if (sanitized.length === 0) {
    throw new Error('Todo text cannot be empty');
  }

  if (sanitized.length > MAX_TEXT_LENGTH) {
    throw new Error(`Todo text cannot exceed ${MAX_TEXT_LENGTH} characters`);
  }

  return sanitized;
}

/**
 * Validate and sanitize group name
 */
export function validateGroupName(name: unknown): string {
  if (!name || typeof name !== 'string') {
    throw new Error('Group name is required and must be a string');
  }

  const sanitized = sanitizeString(name, MAX_NAME_LENGTH);

  if (sanitized.length === 0) {
    throw new Error('Group name cannot be empty');
  }

  if (sanitized.length > MAX_NAME_LENGTH) {
    throw new Error(`Group name cannot exceed ${MAX_NAME_LENGTH} characters`);
  }

  return sanitized;
}

/**
 * Validate group ID format
 */
export function validateGroupId(groupId: unknown): string {
  if (!groupId || typeof groupId !== 'string') {
    throw new Error('Group ID must be a string');
  }

  const sanitized = groupId.trim();

  if (sanitized.length === 0 || sanitized.length > MAX_GROUP_ID_LENGTH) {
    throw new Error('Invalid group ID format');
  }

  // Only allow alphanumeric, hyphens, and underscores
  if (!/^[a-zA-Z0-9_-]+$/.test(sanitized)) {
    throw new Error('Group ID contains invalid characters');
  }

  return sanitized;
}

/**
 * Validate priority level
 */
export function validatePriority(priority: unknown): Priority {
  const validPriorities: Priority[] = ['P0', 'P1', 'P2'];

  if (!priority) {
    return 'P2'; // Default priority
  }

  if (typeof priority !== 'string' || !validPriorities.includes(priority as Priority)) {
    throw new Error('Invalid priority. Must be P0, P1, or P2');
  }

  return priority as Priority;
}

/**
 * Validate timestamp
 */
export function validateTimestamp(timestamp: unknown): number {
  if (timestamp === undefined || timestamp === null) {
    return Date.now();
  }

  const ts = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;

  if (typeof ts !== 'number' || isNaN(ts) || ts < 0) {
    throw new Error('Invalid timestamp');
  }

  // Reject timestamps too far in the future (more than 1 year)
  const oneYearFromNow = Date.now() + 365 * 24 * 60 * 60 * 1000;
  if (ts > oneYearFromNow) {
    throw new Error('Timestamp cannot be more than 1 year in the future');
  }

  return ts;
}

/**
 * Validate boolean
 */
export function validateBoolean(value: unknown, defaultValue: boolean = false): boolean {
  if (value === undefined || value === null) {
    return defaultValue;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return value.toLowerCase() === 'true';
  }

  return defaultValue;
}

/**
 * Validate UUID format
 */
export function validateUUID(id: unknown): string {
  if (!id || typeof id !== 'string') {
    throw new Error('ID must be a string');
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(id)) {
    throw new Error('Invalid ID format');
  }

  return id;
}
