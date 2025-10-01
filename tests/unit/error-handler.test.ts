import { describe, it, expect } from 'vitest';
import {
  createConnectionError,
  sanitizeErrorMessage,
  formatStartupError,
} from '../../src/utils/error-handler.js';

describe('error-handler', () => {
  describe('sanitizeErrorMessage', () => {
    it('should remove stack traces', () => {
      const message = 'Error occurred\n    at Object.<anonymous> (/path/to/file.ts:10:15)';
      const result = sanitizeErrorMessage(message);
      expect(result).toBe('Error occurred');
      expect(result).not.toContain('at Object');
    });

    it('should remove file paths', () => {
      const message = 'Cannot read /Users/test/project/file.ts';
      const result = sanitizeErrorMessage(message);
      expect(result).toBe('Cannot read [file]');
      expect(result).not.toContain('/Users/');
    });

    it('should handle messages without sensitive info', () => {
      const message = 'Connection timeout after 30000ms';
      const result = sanitizeErrorMessage(message);
      expect(result).toBe('Connection timeout after 30000ms');
    });

    it('should remove multiple file paths', () => {
      const message = 'Error in /path/one.ts and /path/two.js';
      const result = sanitizeErrorMessage(message);
      expect(result).toBe('Error in [file] and [file]');
    });

    it('should trim whitespace', () => {
      const message = '  Error message  \n  ';
      const result = sanitizeErrorMessage(message);
      expect(result).toBe('Error message');
    });
  });

  describe('createConnectionError', () => {
    it('should create connection error with sanitized message', () => {
      const error = createConnectionError(
        'TIMEOUT',
        'Connection failed at /path/file.ts',
        'Full internal details with stack trace'
      );

      expect(error.code).toBe('TIMEOUT');
      expect(error.message).toBe('Connection failed at [file]');
      expect(error.internalDetails).toBe('Full internal details with stack trace');
    });

    it('should preserve internal details unchanged', () => {
      const internalDetails = 'Full error:\n    at func (/path/to/file.ts:100:20)';
      const error = createConnectionError('REFUSED', 'Connection refused', internalDetails);

      expect(error.internalDetails).toBe(internalDetails);
    });

    it('should handle different error codes', () => {
      const timeout = createConnectionError('TIMEOUT', 'msg', 'details');
      const refused = createConnectionError('REFUSED', 'msg', 'details');
      const invalid = createConnectionError('INVALID_RESPONSE', 'msg', 'details');

      expect(timeout.code).toBe('TIMEOUT');
      expect(refused.code).toBe('REFUSED');
      expect(invalid.code).toBe('INVALID_RESPONSE');
    });
  });

  describe('formatStartupError', () => {
    it('should format Error objects', () => {
      const error = new Error('Something went wrong at /path/file.ts');
      const result = formatStartupError(error);
      expect(result).toBe('Something went wrong at [file]');
    });

    it('should format string errors', () => {
      const result = formatStartupError('Error string');
      expect(result).toBe('Error string');
    });

    it('should handle unknown error types', () => {
      const result = formatStartupError({ unknown: 'object' });
      expect(result).toBe('An unknown error occurred');
    });

    it('should handle null/undefined', () => {
      expect(formatStartupError(null)).toBe('An unknown error occurred');
      expect(formatStartupError(undefined)).toBe('An unknown error occurred');
    });

    it('should sanitize Error object messages', () => {
      const error = new Error('Failed\n    at test (/file.ts:10:5)');
      const result = formatStartupError(error);
      expect(result).not.toContain('at test');
      expect(result).toBe('Failed');
    });
  });
});
