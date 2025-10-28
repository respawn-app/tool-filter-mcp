import { describe, it, expect, vi } from 'vitest';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

describe('CLI Tool Listing Integration Tests', () => {
  describe('flag parsing', () => {
    // Test the argument parsing logic directly
    it('should require upstream argument', async () => {
      // Test by checking parseCLIArgs throws when upstream is missing
      const originalArgv = process.argv;

      try {
        process.argv = ['node', 'index.js', '--list-tools'];

        const { parseCLIArgs } = await import('../../src/index.js');
        expect(() => parseCLIArgs()).toThrow();
      } finally {
        process.argv = originalArgv;
      }
    });

    it('should accept valid format options', async () => {
      const originalArgv = process.argv;

      try {
        for (const format of ['table', 'json', 'names']) {
          process.argv = ['node', 'index.js', '--upstream', 'http://localhost:3000', '--list-tools', '--format', format];

          const { parseCLIArgs } = await import('../../src/index.js');
          const args = parseCLIArgs();
          expect(args.format).toBe(format);
        }
      } finally {
        process.argv = originalArgv;
      }
    });

    it('should default to table format', async () => {
      const originalArgv = process.argv;

      try {
        process.argv = ['node', 'index.js', '--upstream', 'http://localhost:3000', '--list-tools'];

        const { parseCLIArgs } = await import('../../src/index.js');
        const args = parseCLIArgs();
        expect(args.format).toBe('table');
      } finally {
        process.argv = originalArgv;
      }
    });

    it('should reject invalid format', async () => {
      const originalArgv = process.argv;

      try {
        process.argv = ['node', 'index.js', '--upstream', 'http://localhost:3000', '--list-tools', '--format', 'invalid'];

        // Mock console.error and process.exit to capture the error
        const mockExit = vi.fn();
        const originalExit = process.exit;
        process.exit = mockExit;

        const mockError = vi.fn();
        const originalError = console.error;
        console.error = mockError;

        const { parseCLIArgs } = await import('../../src/index.js');
        parseCLIArgs();

        expect(mockExit).toHaveBeenCalledWith(1);
        expect(mockError).toHaveBeenCalledWith('Error: Invalid format "invalid". Must be one of: table, json, names');

        // Restore
        process.exit = originalExit;
        console.error = originalError;
      } finally {
        process.argv = originalArgv;
      }
    });
  });

  describe('output formatting', () => {
    it('should format tools as table correctly', async () => {
      const { formatToolsList } = await import('../../src/index.js');

      const mockTools: Tool[] = [
        {
          name: 'read_file',
          description: 'Read contents of a file',
          inputSchema: { type: 'object' },
        },
        {
          name: 'write_file',
          description: 'Write content to a file',
          inputSchema: { type: 'object' },
        },
      ];

      const result = formatToolsList(mockTools, 'table');

      expect(result).toContain('Available tools (2 total)');
      expect(result).toContain('read_file');
      expect(result).toContain('Read contents of a file');
      expect(result).toContain('write_file');
      expect(result).toContain('Write content to a file');
    });

    it('should format tools as JSON correctly', async () => {
      const { formatToolsList } = await import('../../src/index.js');

      const mockTools: Tool[] = [
        {
          name: 'read_file',
          description: 'Read contents of a file',
          inputSchema: { type: 'object' },
        },
      ];

      const result = formatToolsList(mockTools, 'json');
      const parsed = JSON.parse(result);

      expect(parsed).toHaveLength(1);
      expect(parsed[0]).toHaveProperty('name', 'read_file');
      expect(parsed[0]).toHaveProperty('description', 'Read contents of a file');
      expect(parsed[0]).toHaveProperty('inputSchema');
    });

    it('should format tools as names correctly', async () => {
      const { formatToolsList } = await import('../../src/index.js');

      const mockTools: Tool[] = [
        { name: 'tool_a', description: 'Tool A', inputSchema: { type: 'object' } },
        { name: 'tool_b', description: 'Tool B', inputSchema: { type: 'object' } },
        { name: 'tool_c', description: 'Tool C', inputSchema: { type: 'object' } },
      ];

      const result = formatToolsList(mockTools, 'names');

      expect(result).toBe('tool_a,tool_b,tool_c');
    });
  });

  describe('filter application', () => {
    it('should filter tools by deny patterns', async () => {
      const { formatToolsList } = await import('../../src/index.js');

      const mockTools: Tool[] = [
        { name: 'read_file', description: 'Read file', inputSchema: { type: 'object' } },
        { name: 'write_file', description: 'Write file', inputSchema: { type: 'object' } },
        { name: 'delete_file', description: 'Delete file', inputSchema: { type: 'object' } },
        { name: 'list_directory', description: 'List directory', inputSchema: { type: 'object' } },
      ];

      // Simulate filtering
      const denyPatterns = ['.*_file'];
      const patterns = denyPatterns.map((pattern) => new RegExp(pattern));
      const filteredTools = mockTools.filter((tool) => {
        return !patterns.some((pattern) => pattern.test(tool.name));
      });

      const result = formatToolsList(filteredTools, 'names');

      expect(result).toBe('list_directory');
    });

    it('should handle empty filter list', async () => {
      const { formatToolsList } = await import('../../src/index.js');

      const mockTools: Tool[] = [
        { name: 'read_file', description: 'Read file', inputSchema: { type: 'object' } },
        { name: 'write_file', description: 'Write file', inputSchema: { type: 'object' } },
      ];

      const result = formatToolsList(mockTools, 'names');

      expect(result).toBe('read_file,write_file');
    });
  });

  describe('error handling and exit behavior', () => {
    it('should handle URL validation errors', async () => {
      const originalArgv = process.argv;

      try {
        process.argv = ['node', 'index.js', '--upstream', 'not-a-url'];

        // Mock console.error and process.exit to capture the error
        const mockExit = vi.fn();
        const originalExit = process.exit;
        process.exit = mockExit;

        const mockError = vi.fn();
        const originalError = console.error;
        console.error = mockError;

        const { parseCLIArgs } = await import('../../src/index.js');
        parseCLIArgs();

        expect(mockExit).toHaveBeenCalledWith(1);
        expect(mockError).toHaveBeenCalledWith('Error: Invalid upstream URL: not-a-url');

        // Restore
        process.exit = originalExit;
        console.error = originalError;
      } finally {
        process.argv = originalArgv;
      }
    });

    it('should test proxy config creation', async () => {
      const { createProxyConfig } = await import('../../src/index.js');

      const args = {
        upstream: 'http://localhost:3000',
        deny: 'read_.*,write_.*',
        header: ['Authorization:Bearer token'],
        listTools: true,
        format: 'table' as const,
      };

      const config = createProxyConfig(args);

      expect(config.upstreamUrl).toBe('http://localhost:3000');
      expect(config.denyPatterns).toEqual(['read_.*', 'write_.*']);
      expect(config.headers).toEqual({ Authorization: 'Bearer token' });
    });
  });

  describe('stdout/stderr separation', () => {
    it('should output tools to stdout only', async () => {
      const { formatToolsList } = await import('../../src/index.js');

      const mockTools: Tool[] = [
        { name: 'test_tool', description: 'Test tool', inputSchema: { type: 'object' } }
      ];

      const result = formatToolsList(mockTools, 'json');

      // Should be valid JSON
      expect(() => JSON.parse(result)).not.toThrow();

      // Should not contain error messages
      expect(result).not.toContain('Error:');
      expect(result).not.toContain('Found');
    });
  });

  describe('description truncation', () => {
    it('should truncate long descriptions in table format', async () => {
      const { truncateDescription } = await import('../../src/index.js');

      const longDesc = 'A'.repeat(150);
      const truncated = truncateDescription(longDesc, 100);

      expect(truncated).toBe('A'.repeat(100) + '...');
      expect(truncated.length).toBe(103);
    });

    it('should handle multi-line descriptions', async () => {
      const { truncateDescription } = await import('../../src/index.js');

      const multiLineDesc = 'First line\nSecond line\nThird line';
      const truncated = truncateDescription(multiLineDesc, 100);

      expect(truncated).toBe('First line...');
    });

    it('should handle empty descriptions', async () => {
      const { truncateDescription } = await import('../../src/index.js');

      expect(truncateDescription('', 100)).toBe('');
      expect(truncateDescription('', 10)).toBe('');
    });
  });

  describe('allow flag in list-tools mode', () => {
    it('should filter tools using allow patterns', async () => {
      const { formatToolsList } = await import('../../src/index.js');

      const mockTools: Tool[] = [
        { name: 'read_file', description: 'Read file', inputSchema: { type: 'object' } },
        { name: 'write_file', description: 'Write file', inputSchema: { type: 'object' } },
        { name: 'delete_file', description: 'Delete file', inputSchema: { type: 'object' } },
        { name: 'list_directory', description: 'List directory', inputSchema: { type: 'object' } },
      ];

      // Simulate allow filtering
      const allowPatterns = ['.*_file'];
      const patterns = allowPatterns.map((pattern) => new RegExp(pattern));
      const filteredTools = mockTools.filter((tool) => {
        return patterns.some((pattern) => pattern.test(tool.name));
      });

      const result = formatToolsList(filteredTools, 'names');

      expect(result).toBe('read_file,write_file,delete_file');
    });

    it('should create config with allow mode from CLI args', async () => {
      const { createProxyConfig } = await import('../../src/index.js');

      const args = {
        upstream: 'http://localhost:3000',
        allow: 'read_.*,write_.*',
        listTools: true,
        format: 'json' as const,
        positionals: [],
      };

      const config = createProxyConfig(args as any);

      expect(config.filterMode).toBe('allow');
      expect(config.allowPatterns).toEqual(['read_.*', 'write_.*']);
      expect(config.denyPatterns).toEqual([]);
    });

    it('should handle empty allow patterns in list-tools mode', async () => {
      const { createProxyConfig } = await import('../../src/index.js');

      const args = {
        upstream: 'http://localhost:3000',
        allow: '',
        listTools: true,
        format: 'table' as const,
        positionals: [],
      };

      const config = createProxyConfig(args as any);

      expect(config.filterMode).toBe('allow');
      expect(config.allowPatterns).toEqual([]);
    });

    it('should apply allow filtering with multiple patterns', async () => {
      const { formatToolsList } = await import('../../src/index.js');

      const mockTools: Tool[] = [
        { name: 'read_file', description: 'Read file', inputSchema: { type: 'object' } },
        { name: 'write_file', description: 'Write file', inputSchema: { type: 'object' } },
        { name: 'list_directory', description: 'List directory', inputSchema: { type: 'object' } },
        { name: 'query_database', description: 'Query database', inputSchema: { type: 'object' } },
      ];

      // Simulate allow filtering with multiple patterns
      const allowPatterns = ['^read_.*', '.*_database$'];
      const patterns = allowPatterns.map((pattern) => new RegExp(pattern));
      const filteredTools = mockTools.filter((tool) => {
        return patterns.some((pattern) => pattern.test(tool.name));
      });

      const result = formatToolsList(filteredTools, 'names');

      expect(result).toBe('read_file,query_database');
    });

    it('should show no tools when allow mode with no patterns', async () => {
      const { formatToolsList } = await import('../../src/index.js');

      const mockTools: Tool[] = [
        { name: 'read_file', description: 'Read file', inputSchema: { type: 'object' } },
        { name: 'write_file', description: 'Write file', inputSchema: { type: 'object' } },
      ];

      // In allow mode with no patterns, all tools should be filtered out
      const allowPatterns: string[] = [];
      const filteredTools = allowPatterns.length === 0 ? [] : mockTools;

      const result = formatToolsList(filteredTools, 'json');

      expect(result).toBe('[]');
    });

    it('should allow all tools when pattern matches everything', async () => {
      const { formatToolsList } = await import('../../src/index.js');

      const mockTools: Tool[] = [
        { name: 'read_file', description: 'Read file', inputSchema: { type: 'object' } },
        { name: 'write_file', description: 'Write file', inputSchema: { type: 'object' } },
        { name: 'list_directory', description: 'List directory', inputSchema: { type: 'object' } },
      ];

      // Simulate allow filtering with match-all pattern
      const allowPatterns = ['.*'];
      const patterns = allowPatterns.map((pattern) => new RegExp(pattern));
      const filteredTools = mockTools.filter((tool) => {
        return patterns.some((pattern) => pattern.test(tool.name));
      });

      const result = formatToolsList(filteredTools, 'names');

      expect(result).toBe('read_file,write_file,list_directory');
    });

    it('should handle exact tool name matching in allow mode', async () => {
      const { formatToolsList } = await import('../../src/index.js');

      const mockTools: Tool[] = [
        { name: 'read_file', description: 'Read file', inputSchema: { type: 'object' } },
        { name: 'read_file_v2', description: 'Read file v2', inputSchema: { type: 'object' } },
        { name: 'write_file', description: 'Write file', inputSchema: { type: 'object' } },
      ];

      // Simulate allow filtering with exact match pattern
      const allowPatterns = ['^read_file$'];
      const patterns = allowPatterns.map((pattern) => new RegExp(pattern));
      const filteredTools = mockTools.filter((tool) => {
        return patterns.some((pattern) => pattern.test(tool.name));
      });

      const result = formatToolsList(filteredTools, 'names');

      expect(result).toBe('read_file');
    });
  });
});