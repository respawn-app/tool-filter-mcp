import { describe, it, expect } from 'vitest';
import { MCPServer } from '../../src/server.js';
import { ProxyOrchestrator } from '../../src/proxy.js';
import { HttpProxyConfig, StdioProxyConfig } from '../../src/types.js';
import { createMockServer } from '../fixtures/mock-mcp-server.js';
import { sampleTools, databaseTools, allTools } from '../fixtures/sample-tools.js';

describe('MCPServer - Allow Mode Filtering', () => {
  describe('HTTP mode - tools/list handler with allow patterns', () => {
    it('should return only tools matching allow patterns', async () => {
      const mockUpstream = createMockServer(sampleTools);
      const config: HttpProxyConfig = {
        mode: 'http',
        upstreamUrl: 'http://localhost:3000',
        denyPatterns: [],
        allowPatterns: ['.*_file$'],
        filterMode: 'allow',
        timeouts: {
          connection: 30000,
          toolList: 10000,
        },
      };

      const proxy = new ProxyOrchestrator(config, mockUpstream as any);
      await proxy.startup();

      const server = new MCPServer(proxy);
      const result = await server.handleListTools();

      expect(result.tools).toHaveLength(2);
      expect(result.tools.map((t) => t.name)).toEqual(['read_file', 'write_file']);
    });

    it('should return empty list when no allow patterns provided', async () => {
      const mockUpstream = createMockServer(sampleTools);
      const config: HttpProxyConfig = {
        mode: 'http',
        upstreamUrl: 'http://localhost:3000',
        denyPatterns: [],
        allowPatterns: [],
        filterMode: 'allow',
        timeouts: {
          connection: 30000,
          toolList: 10000,
        },
      };

      const proxy = new ProxyOrchestrator(config, mockUpstream as any);
      await proxy.startup();

      const server = new MCPServer(proxy);
      const result = await server.handleListTools();

      expect(result.tools).toHaveLength(0);
    });

    it('should allow all tools when pattern matches everything', async () => {
      const mockUpstream = createMockServer(sampleTools);
      const config: HttpProxyConfig = {
        mode: 'http',
        upstreamUrl: 'http://localhost:3000',
        denyPatterns: [],
        allowPatterns: ['.*'],
        filterMode: 'allow',
        timeouts: {
          connection: 30000,
          toolList: 10000,
        },
      };

      const proxy = new ProxyOrchestrator(config, mockUpstream as any);
      await proxy.startup();

      const server = new MCPServer(proxy);
      const result = await server.handleListTools();

      expect(result.tools).toHaveLength(4);
      expect(result.tools).toEqual(sampleTools);
    });

    it('should allow tools with multiple allow patterns', async () => {
      const mockUpstream = createMockServer(sampleTools);
      const config: HttpProxyConfig = {
        mode: 'http',
        upstreamUrl: 'http://localhost:3000',
        denyPatterns: [],
        allowPatterns: ['^read_.*', '^list_.*'],
        filterMode: 'allow',
        timeouts: {
          connection: 30000,
          toolList: 10000,
        },
      };

      const proxy = new ProxyOrchestrator(config, mockUpstream as any);
      await proxy.startup();

      const server = new MCPServer(proxy);
      const result = await server.handleListTools();

      expect(result.tools).toHaveLength(2);
      expect(result.tools.map((t) => t.name)).toEqual(['read_file', 'list_dir']);
    });

    it('should allow exact tool names with anchors', async () => {
      const mockUpstream = createMockServer(sampleTools);
      const config: HttpProxyConfig = {
        mode: 'http',
        upstreamUrl: 'http://localhost:3000',
        denyPatterns: [],
        allowPatterns: ['^read_file$', '^get_env$'],
        filterMode: 'allow',
        timeouts: {
          connection: 30000,
          toolList: 10000,
        },
      };

      const proxy = new ProxyOrchestrator(config, mockUpstream as any);
      await proxy.startup();

      const server = new MCPServer(proxy);
      const result = await server.handleListTools();

      expect(result.tools).toHaveLength(2);
      expect(result.tools.map((t) => t.name)).toEqual(['read_file', 'get_env']);
    });

    it('should handle complex regex patterns', async () => {
      const mockUpstream = createMockServer(allTools);
      const config: HttpProxyConfig = {
        mode: 'http',
        upstreamUrl: 'http://localhost:3000',
        denyPatterns: [],
        allowPatterns: ['^(read|write)_.*', '.*_database$'],
        filterMode: 'allow',
        timeouts: {
          connection: 30000,
          toolList: 10000,
        },
      };

      const proxy = new ProxyOrchestrator(config, mockUpstream as any);
      await proxy.startup();

      const server = new MCPServer(proxy);
      const result = await server.handleListTools();

      expect(result.tools).toHaveLength(4);
      expect(result.tools.map((t) => t.name)).toEqual([
        'read_file',
        'write_file',
        'query_database',
        'update_database',
      ]);
    });
  });

  describe('HTTP mode - tools/call handler with allow patterns', () => {
    it('should forward allowed tool call to upstream', async () => {
      const mockUpstream = createMockServer(sampleTools);
      const config: HttpProxyConfig = {
        mode: 'http',
        upstreamUrl: 'http://localhost:3000',
        denyPatterns: [],
        allowPatterns: ['^list_.*', '^get_.*'],
        filterMode: 'allow',
        timeouts: {
          connection: 30000,
          toolList: 10000,
        },
      };

      const proxy = new ProxyOrchestrator(config, mockUpstream as any);
      await proxy.startup();

      const server = new MCPServer(proxy);
      const result = await server.handleCallTool('list_dir', { path: '/home' });

      expect(result).toBeDefined();
      expect(result).toHaveProperty('content');
    });

    it('should reject non-allowed tool call with error', async () => {
      const mockUpstream = createMockServer(sampleTools);
      const config: HttpProxyConfig = {
        mode: 'http',
        upstreamUrl: 'http://localhost:3000',
        denyPatterns: [],
        allowPatterns: ['^list_.*'],
        filterMode: 'allow',
        timeouts: {
          connection: 30000,
          toolList: 10000,
        },
      };

      const proxy = new ProxyOrchestrator(config, mockUpstream as any);
      await proxy.startup();

      const server = new MCPServer(proxy);

      await expect(server.handleCallTool('read_file', { path: '/test' })).rejects.toThrow(
        'Tool not found: read_file'
      );
    });

    it('should reject with error code -32601 for non-allowed tools', async () => {
      const mockUpstream = createMockServer(sampleTools);
      const config: HttpProxyConfig = {
        mode: 'http',
        upstreamUrl: 'http://localhost:3000',
        denyPatterns: [],
        allowPatterns: ['^get_.*'],
        filterMode: 'allow',
        timeouts: {
          connection: 30000,
          toolList: 10000,
        },
      };

      const proxy = new ProxyOrchestrator(config, mockUpstream as any);
      await proxy.startup();

      const server = new MCPServer(proxy);

      try {
        await server.handleCallTool('write_file', {});
      } catch (error: any) {
        expect(error.code).toBe(-32601);
        expect(error.message).toBe('Tool not found: write_file');
      }
    });

    it('should allow tool calls when pattern matches everything', async () => {
      const mockUpstream = createMockServer(sampleTools);
      const config: HttpProxyConfig = {
        mode: 'http',
        upstreamUrl: 'http://localhost:3000',
        denyPatterns: [],
        allowPatterns: ['.*'],
        filterMode: 'allow',
        timeouts: {
          connection: 30000,
          toolList: 10000,
        },
      };

      const proxy = new ProxyOrchestrator(config, mockUpstream as any);
      await proxy.startup();

      const server = new MCPServer(proxy);

      // All tools should be allowed
      const result1 = await server.handleCallTool('read_file', { path: '/test' });
      expect(result1).toBeDefined();

      const result2 = await server.handleCallTool('write_file', { path: '/test', content: 'data' });
      expect(result2).toBeDefined();

      const result3 = await server.handleCallTool('list_dir', { path: '/home' });
      expect(result3).toBeDefined();

      const result4 = await server.handleCallTool('get_env', { name: 'PATH' });
      expect(result4).toBeDefined();
    });

    it('should reject all tool calls when no allow patterns provided', async () => {
      const mockUpstream = createMockServer(sampleTools);
      const config: HttpProxyConfig = {
        mode: 'http',
        upstreamUrl: 'http://localhost:3000',
        denyPatterns: [],
        allowPatterns: [],
        filterMode: 'allow',
        timeouts: {
          connection: 30000,
          toolList: 10000,
        },
      };

      const proxy = new ProxyOrchestrator(config, mockUpstream as any);
      await proxy.startup();

      const server = new MCPServer(proxy);

      // All tools should be denied
      await expect(server.handleCallTool('read_file', { path: '/test' })).rejects.toThrow();
      await expect(server.handleCallTool('write_file', { path: '/test', content: 'data' })).rejects.toThrow();
      await expect(server.handleCallTool('list_dir', { path: '/home' })).rejects.toThrow();
      await expect(server.handleCallTool('get_env', { name: 'PATH' })).rejects.toThrow();
    });
  });

  describe('stdio mode - tools/list handler with allow patterns', () => {
    it('should return only tools matching allow patterns', async () => {
      const mockUpstream = createMockServer(sampleTools);
      const config: StdioProxyConfig = {
        mode: 'stdio',
        upstreamCommand: 'node',
        upstreamArgs: ['server.js'],
        denyPatterns: [],
        allowPatterns: ['.*_file$'],
        filterMode: 'allow',
        timeouts: {
          connection: 30000,
          toolList: 10000,
        },
      };

      const proxy = new ProxyOrchestrator(config, mockUpstream as any);
      await proxy.startup();

      const server = new MCPServer(proxy);
      const result = await server.handleListTools();

      expect(result.tools).toHaveLength(2);
      expect(result.tools.map((t) => t.name)).toEqual(['read_file', 'write_file']);
    });

    it('should handle multiple allow patterns in stdio mode', async () => {
      const mockUpstream = createMockServer(sampleTools);
      const config: StdioProxyConfig = {
        mode: 'stdio',
        upstreamCommand: 'node',
        upstreamArgs: ['server.js'],
        denyPatterns: [],
        allowPatterns: ['^read_.*', '^get_.*'],
        filterMode: 'allow',
        timeouts: {
          connection: 30000,
          toolList: 10000,
        },
      };

      const proxy = new ProxyOrchestrator(config, mockUpstream as any);
      await proxy.startup();

      const server = new MCPServer(proxy);
      const result = await server.handleListTools();

      expect(result.tools).toHaveLength(2);
      expect(result.tools.map((t) => t.name)).toEqual(['read_file', 'get_env']);
    });

    it('should return empty list when no allow patterns in stdio mode', async () => {
      const mockUpstream = createMockServer(sampleTools);
      const config: StdioProxyConfig = {
        mode: 'stdio',
        upstreamCommand: 'node',
        upstreamArgs: ['server.js'],
        denyPatterns: [],
        allowPatterns: [],
        filterMode: 'allow',
        timeouts: {
          connection: 30000,
          toolList: 10000,
        },
      };

      const proxy = new ProxyOrchestrator(config, mockUpstream as any);
      await proxy.startup();

      const server = new MCPServer(proxy);
      const result = await server.handleListTools();

      expect(result.tools).toHaveLength(0);
    });
  });

  describe('stdio mode - tools/call handler with allow patterns', () => {
    it('should forward allowed tool call in stdio mode', async () => {
      const mockUpstream = createMockServer(sampleTools);
      const config: StdioProxyConfig = {
        mode: 'stdio',
        upstreamCommand: 'node',
        upstreamArgs: ['server.js'],
        denyPatterns: [],
        allowPatterns: ['^list_.*'],
        filterMode: 'allow',
        timeouts: {
          connection: 30000,
          toolList: 10000,
        },
      };

      const proxy = new ProxyOrchestrator(config, mockUpstream as any);
      await proxy.startup();

      const server = new MCPServer(proxy);
      const result = await server.handleCallTool('list_dir', { path: '/home' });

      expect(result).toBeDefined();
      expect(result).toHaveProperty('content');
    });

    it('should reject non-allowed tool call in stdio mode', async () => {
      const mockUpstream = createMockServer(sampleTools);
      const config: StdioProxyConfig = {
        mode: 'stdio',
        upstreamCommand: 'node',
        upstreamArgs: ['server.js'],
        denyPatterns: [],
        allowPatterns: ['^list_.*'],
        filterMode: 'allow',
        timeouts: {
          connection: 30000,
          toolList: 10000,
        },
      };

      const proxy = new ProxyOrchestrator(config, mockUpstream as any);
      await proxy.startup();

      const server = new MCPServer(proxy);

      await expect(server.handleCallTool('read_file', { path: '/test' })).rejects.toThrow(
        'Tool not found: read_file'
      );
    });
  });

  describe('comparison between deny mode and allow mode', () => {
    it('should have inverse behavior between deny and allow modes', async () => {
      const mockUpstream1 = createMockServer(sampleTools);
      const denyConfig: HttpProxyConfig = {
        mode: 'http',
        upstreamUrl: 'http://localhost:3000',
        denyPatterns: ['.*_file$'],
        allowPatterns: [],
        filterMode: 'deny',
        timeouts: {
          connection: 30000,
          toolList: 10000,
        },
      };

      const proxy1 = new ProxyOrchestrator(denyConfig, mockUpstream1 as any);
      await proxy1.startup();

      const server1 = new MCPServer(proxy1);
      const denyResult = await server1.handleListTools();

      const mockUpstream2 = createMockServer(sampleTools);
      const allowConfig: HttpProxyConfig = {
        mode: 'http',
        upstreamUrl: 'http://localhost:3000',
        denyPatterns: [],
        allowPatterns: ['.*_file$'],
        filterMode: 'allow',
        timeouts: {
          connection: 30000,
          toolList: 10000,
        },
      };

      const proxy2 = new ProxyOrchestrator(allowConfig, mockUpstream2 as any);
      await proxy2.startup();

      const server2 = new MCPServer(proxy2);
      const allowResult = await server2.handleListTools();

      // Deny mode should filter out _file tools, allow mode should keep only _file tools
      expect(denyResult.tools.map((t) => t.name)).toEqual(['list_dir', 'get_env']);
      expect(allowResult.tools.map((t) => t.name)).toEqual(['read_file', 'write_file']);

      // Together they should cover all tools
      const allToolNames = [
        ...denyResult.tools.map((t) => t.name),
        ...allowResult.tools.map((t) => t.name),
      ].sort();
      expect(allToolNames).toEqual(['get_env', 'list_dir', 'read_file', 'write_file']);
    });
  });
});
