import { describe, it, expect } from 'vitest';
import { ProxyOrchestrator } from '../../src/proxy.js';
import { ProxyConfig } from '../../src/types.js';
import { createMockServer, createFailingMockServer } from '../fixtures/mock-mcp-server.js';
import { sampleTools, allTools } from '../fixtures/sample-tools.js';

describe('ProxyOrchestrator', () => {
  describe('startup sequence', () => {
    it('should complete startup successfully', async () => {
      const mockServer = createMockServer(sampleTools);
      const config: ProxyConfig = {
        upstreamUrl: 'http://localhost:3000',
        denyPatterns: [],
        timeouts: {
          connection: 30000,
          toolList: 10000,
        },
      };

      const proxy = new ProxyOrchestrator(config, mockServer as any);
      await proxy.startup();

      expect(proxy.isReady()).toBe(true);
    });

    it('should filter tools during startup', async () => {
      const mockServer = createMockServer(sampleTools);
      const config: ProxyConfig = {
        upstreamUrl: 'http://localhost:3000',
        denyPatterns: ['.*_file$'],
        timeouts: {
          connection: 30000,
          toolList: 10000,
        },
      };

      const proxy = new ProxyOrchestrator(config, mockServer as any);
      await proxy.startup();

      const tools = proxy.getCachedTools();
      expect(tools).toHaveLength(2);
      expect(tools.map((t) => t.name)).toEqual(['list_dir', 'get_env']);
    });

    it('should fail startup on connection error', async () => {
      const mockServer = createFailingMockServer();
      const config: ProxyConfig = {
        upstreamUrl: 'http://localhost:9999',
        denyPatterns: [],
        timeouts: {
          connection: 30000,
          toolList: 10000,
        },
      };

      const proxy = new ProxyOrchestrator(config, mockServer as any);
      await expect(proxy.startup()).rejects.toThrow('Connection refused');
      expect(proxy.isReady()).toBe(false);
    });

    it('should fail startup on invalid regex pattern', async () => {
      const mockServer = createMockServer(sampleTools);
      const config: ProxyConfig = {
        upstreamUrl: 'http://localhost:3000',
        denyPatterns: ['^[a-z'],
        timeouts: {
          connection: 30000,
          toolList: 10000,
        },
      };

      const proxy = new ProxyOrchestrator(config, mockServer as any);
      await expect(proxy.startup()).rejects.toThrow('Invalid regex pattern');
    });

    it('should fail startup on unsafe regex pattern', async () => {
      const mockServer = createMockServer(sampleTools);
      const config: ProxyConfig = {
        upstreamUrl: 'http://localhost:3000',
        denyPatterns: ['(a+)+'],
        timeouts: {
          connection: 30000,
          toolList: 10000,
        },
      };

      const proxy = new ProxyOrchestrator(config, mockServer as any);
      await expect(proxy.startup()).rejects.toThrow('Unsafe regex pattern');
    });

    it('should handle empty tool list after filtering', async () => {
      const mockServer = createMockServer(sampleTools);
      const config: ProxyConfig = {
        upstreamUrl: 'http://localhost:3000',
        denyPatterns: ['.*'],
        timeouts: {
          connection: 30000,
          toolList: 10000,
        },
      };

      const proxy = new ProxyOrchestrator(config, mockServer as any);
      await proxy.startup();

      expect(proxy.isReady()).toBe(true);
      expect(proxy.getCachedTools()).toHaveLength(0);
    });
  });

  describe('getCachedTools', () => {
    it('should return filtered tool list', async () => {
      const mockServer = createMockServer(allTools);
      const config: ProxyConfig = {
        upstreamUrl: 'http://localhost:3000',
        denyPatterns: ['.*_database$'],
        timeouts: {
          connection: 30000,
          toolList: 10000,
        },
      };

      const proxy = new ProxyOrchestrator(config, mockServer as any);
      await proxy.startup();

      const tools = proxy.getCachedTools();
      expect(tools).toHaveLength(4);
      expect(tools.every((t) => !t.name.endsWith('_database'))).toBe(true);
    });

    it('should return immutable tool list', async () => {
      const mockServer = createMockServer(sampleTools);
      const config: ProxyConfig = {
        upstreamUrl: 'http://localhost:3000',
        denyPatterns: [],
        timeouts: {
          connection: 30000,
          toolList: 10000,
        },
      };

      const proxy = new ProxyOrchestrator(config, mockServer as any);
      await proxy.startup();

      const tools1 = proxy.getCachedTools();
      const tools2 = proxy.getCachedTools();

      expect(tools1).toEqual(tools2);
      expect(tools1).not.toBe(tools2);
    });

    it('should throw when not ready', () => {
      const mockServer = createMockServer(sampleTools);
      const config: ProxyConfig = {
        upstreamUrl: 'http://localhost:3000',
        denyPatterns: [],
        timeouts: {
          connection: 30000,
          toolList: 10000,
        },
      };

      const proxy = new ProxyOrchestrator(config, mockServer as any);
      expect(() => proxy.getCachedTools()).toThrow('Proxy not ready');
    });
  });

  describe('isToolAllowed', () => {
    it('should return true for allowed tool', async () => {
      const mockServer = createMockServer(sampleTools);
      const config: ProxyConfig = {
        upstreamUrl: 'http://localhost:3000',
        denyPatterns: ['.*_file$'],
        timeouts: {
          connection: 30000,
          toolList: 10000,
        },
      };

      const proxy = new ProxyOrchestrator(config, mockServer as any);
      await proxy.startup();

      expect(proxy.isToolAllowed('list_dir')).toBe(true);
      expect(proxy.isToolAllowed('get_env')).toBe(true);
    });

    it('should return false for denied tool', async () => {
      const mockServer = createMockServer(sampleTools);
      const config: ProxyConfig = {
        upstreamUrl: 'http://localhost:3000',
        denyPatterns: ['.*_file$'],
        timeouts: {
          connection: 30000,
          toolList: 10000,
        },
      };

      const proxy = new ProxyOrchestrator(config, mockServer as any);
      await proxy.startup();

      expect(proxy.isToolAllowed('read_file')).toBe(false);
      expect(proxy.isToolAllowed('write_file')).toBe(false);
    });

    it('should return false for non-existent tool', async () => {
      const mockServer = createMockServer(sampleTools);
      const config: ProxyConfig = {
        upstreamUrl: 'http://localhost:3000',
        denyPatterns: [],
        timeouts: {
          connection: 30000,
          toolList: 10000,
        },
      };

      const proxy = new ProxyOrchestrator(config, mockServer as any);
      await proxy.startup();

      expect(proxy.isToolAllowed('nonexistent_tool')).toBe(false);
    });

    it('should throw when not ready', () => {
      const mockServer = createMockServer(sampleTools);
      const config: ProxyConfig = {
        upstreamUrl: 'http://localhost:3000',
        denyPatterns: [],
        timeouts: {
          connection: 30000,
          toolList: 10000,
        },
      };

      const proxy = new ProxyOrchestrator(config, mockServer as any);
      expect(() => proxy.isToolAllowed('any_tool')).toThrow('Proxy not ready');
    });
  });

  describe('getUpstreamConnection', () => {
    it('should return upstream connection instance', async () => {
      const mockServer = createMockServer(sampleTools);
      const config: ProxyConfig = {
        upstreamUrl: 'http://localhost:3000',
        denyPatterns: [],
        timeouts: {
          connection: 30000,
          toolList: 10000,
        },
      };

      const proxy = new ProxyOrchestrator(config, mockServer as any);
      await proxy.startup();

      const connection = proxy.getUpstreamConnection();
      expect(connection).toBeDefined();
      expect(connection.isConnected()).toBe(true);
    });
  });
});
