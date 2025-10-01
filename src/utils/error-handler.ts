import { ConnectionError } from '../types.js';

export function createConnectionError(
  code: ConnectionError['code'],
  message: string,
  internalDetails: string
): ConnectionError {
  return {
    code,
    message: sanitizeErrorMessage(message),
    internalDetails,
  };
}

export function sanitizeErrorMessage(message: string): string {
  const stackTracePattern = /\n\s+at\s+.*/g;
  const filePathPattern = /[\/\\][\w\/\\.-]+\.(ts|js|json)(:\d+:\d+)?/g;

  let sanitized = message.replace(filePathPattern, '[file]');
  sanitized = sanitized.replace(stackTracePattern, '');

  return sanitized.trim();
}

export function formatStartupError(error: unknown): string {
  if (error instanceof Error) {
    return sanitizeErrorMessage(error.message);
  }

  if (typeof error === 'string') {
    return sanitizeErrorMessage(error);
  }

  return 'An unknown error occurred';
}
