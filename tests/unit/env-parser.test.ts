import { describe, it, expect } from 'vitest';
import { parseEnvVars } from '../../src/index.js';

describe('env-parser', () => {
  describe('parseEnvVars', () => {
    it('should parse single environment variable correctly', () => {
      const envVars = parseEnvVars(['API_KEY=secret123']);
      expect(envVars).toEqual({ API_KEY: 'secret123' });
    });

    it('should parse multiple environment variables correctly', () => {
      const envVars = parseEnvVars([
        'API_KEY=secret123',
        'DEBUG=true',
        'PORT=3000'
      ]);
      expect(envVars).toEqual({
        'API_KEY': 'secret123',
        'DEBUG': 'true',
        'PORT': '3000'
      });
    });

    it('should trim whitespace from key but not value', () => {
      const envVars = parseEnvVars(['  API_KEY  =  secret123  ']);
      expect(envVars).toEqual({ API_KEY: '  secret123  ' });
    });

    it('should allow empty value', () => {
      const envVars = parseEnvVars(['EMPTY_VAR=']);
      expect(envVars).toEqual({ 'EMPTY_VAR': '' });
    });

    it('should allow value with multiple equals signs', () => {
      const envVars = parseEnvVars(['CONNECTION_STRING=postgresql://user:pass@localhost:5432/db']);
      expect(envVars).toEqual({ CONNECTION_STRING: 'postgresql://user:pass@localhost:5432/db' });
    });

    it('should warn and skip entries missing equals sign', () => {
      const consoleSpy = { calls: [] as string[] };
      const originalError = console.error;
      console.error = (...args: string[]) => {
        consoleSpy.calls.push(args.join(' '));
      };

      const envVars = parseEnvVars(['InvalidEntry', 'VALID=value']);

      expect(envVars).toEqual({ VALID: 'value' });
      expect(consoleSpy.calls.some(call => call.includes('Invalid environment variable format'))).toBe(true);
      expect(consoleSpy.calls.some(call => call.includes('InvalidEntry'))).toBe(true);

      console.error = originalError;
    });

    it('should warn and skip entries with empty key', () => {
      const consoleSpy = { calls: [] as string[] };
      const originalError = console.error;
      console.error = (...args: string[]) => {
        consoleSpy.calls.push(args.join(' '));
      };

      const envVars = parseEnvVars(['=value', 'VALID=value']);

      expect(envVars).toEqual({ VALID: 'value' });
      expect(consoleSpy.calls.some(call => call.includes('Key cannot be empty'))).toBe(true);

      console.error = originalError;
    });

    it('should handle empty array', () => {
      const envVars = parseEnvVars([]);
      expect(envVars).toEqual({});
    });

    it('should overwrite duplicate keys with last value', () => {
      const envVars = parseEnvVars([
        'API_KEY=first',
        'API_KEY=second'
      ]);
      expect(envVars).toEqual({ API_KEY: 'second' });
    });

    it('should handle values with spaces', () => {
      const envVars = parseEnvVars(['MESSAGE=Hello World']);
      expect(envVars).toEqual({ MESSAGE: 'Hello World' });
    });

    it('should handle values with special characters', () => {
      const envVars = parseEnvVars([
        'PASSWORD=p@ssw0rd!',
        'PATH=/usr/bin:/usr/local/bin',
        'JSON={"key":"value"}'
      ]);
      expect(envVars).toEqual({
        'PASSWORD': 'p@ssw0rd!',
        'PATH': '/usr/bin:/usr/local/bin',
        'JSON': '{"key":"value"}'
      });
    });

    it('should handle mixed valid and invalid entries', () => {
      const consoleSpy = { calls: [] as string[] };
      const originalError = console.error;
      console.error = (...args: string[]) => {
        consoleSpy.calls.push(args.join(' '));
      };

      const envVars = parseEnvVars([
        'VALID1=value1',
        'InvalidEntry',
        'VALID2=value2',
        '=emptykey',
        'VALID3=value3'
      ]);

      expect(envVars).toEqual({
        'VALID1': 'value1',
        'VALID2': 'value2',
        'VALID3': 'value3'
      });
      expect(consoleSpy.calls.length).toBeGreaterThan(0);

      console.error = originalError;
    });
  });
});
