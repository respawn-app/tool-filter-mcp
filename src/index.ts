#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { ProxyConfig } from './types.js';
import { ProxyOrchestrator } from './proxy.js';
import { createMCPServer } from './server.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { formatStartupError } from './utils/error-handler.js';
import { parseHeaders } from './utils/header-parser.js';

interface CLIArgs {
  upstream: string;
  deny?: string;
  header?: string[];
}

function parseCLIArgs(): CLIArgs {
  const { values } = parseArgs({
    options: {
      upstream: {
        type: 'string',
        short: 'u',
      },
      deny: {
        type: 'string',
        short: 'd',
      },
      header: {
        type: 'string',
        short: 'h',
        multiple: true,
      },
    },
  });

  if (!values.upstream) {
    console.error('Error: --upstream argument is required');
    console.error('Usage: tool-filter-mcp --upstream <url> [--deny <patterns>] [--header <name:value>]');
    process.exit(1);
  }

  const upstream = values.upstream;
  const deny = values.deny;
  const header = values.header;

  try {
    new URL(upstream);
  } catch {
    console.error(`Error: Invalid upstream URL: ${upstream}`);
    process.exit(1);
  }

  return {
    upstream,
    deny,
    header,
  };
}

function createProxyConfig(args: CLIArgs): ProxyConfig {
  const denyPatterns = args.deny
    ? args.deny.split(',').map((p) => p.trim()).filter((p) => p.length > 0)
    : [];

  const headers = args.header && args.header.length > 0
    ? parseHeaders(args.header)
    : undefined;

  return {
    upstreamUrl: args.upstream,
    denyPatterns,
    headers,
    timeouts: {
      connection: 30000,
      toolList: 10000,
    },
  };
}

interface WrappedClient {
  connect(): Promise<void>;
  listTools(): Promise<{ tools: { name: string; description?: string; inputSchema: object }[] }>;
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
  disconnect(): void;
  isConnected(): boolean;
}

async function createUpstreamClient(
  upstreamUrl: string,
  headers?: Record<string, string>
): Promise<WrappedClient> {
  const transportOptions: {
    eventSourceInit?: { fetch: typeof fetch };
    requestInit?: RequestInit;
  } = {};

  if (headers && Object.keys(headers).length > 0) {
    transportOptions.eventSourceInit = {
      fetch: (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
        const mergedHeaders = new Headers(init?.headers || {});
        for (const [name, value] of Object.entries(headers)) {
          mergedHeaders.set(name, value);
        }
        return fetch(input, { ...init, headers: mergedHeaders });
      },
    };

    transportOptions.requestInit = {
      headers,
    };
  }

  const transport = new SSEClientTransport(new URL(upstreamUrl), transportOptions);
  const client = new Client(
    {
      name: 'tool-filter-mcp',
      version: '0.1.0',
    },
    {
      capabilities: {},
    }
  );

  let connected = false;

  return {
    async connect(): Promise<void> {
      await client.connect(transport);
      connected = true;
    },
    async listTools(): Promise<{ tools: { name: string; description?: string; inputSchema: object }[] }> {
      const result = await client.listTools();
      return result as { tools: { name: string; description?: string; inputSchema: object }[] };
    },
    async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
      return await client.callTool({ name, arguments: args });
    },
    disconnect(): void {
      void client.close();
      connected = false;
    },
    isConnected(): boolean {
      return connected;
    },
  };
}

async function main(): Promise<void> {
  try {
    const args = parseCLIArgs();
    const config = createProxyConfig(args);

    console.error(`Connecting to upstream MCP at ${config.upstreamUrl}...`);

    const upstreamClient = await createUpstreamClient(config.upstreamUrl, config.headers);

    const proxy = new ProxyOrchestrator(config, upstreamClient);
    await proxy.startup();

    const filteredTools = proxy.getCachedTools();
    console.error(
      `Proxy ready. Filtered ${filteredTools.length} tools from upstream.`
    );

    if (config.denyPatterns.length > 0) {
      console.error(`Deny patterns: ${config.denyPatterns.join(', ')}`);
    }

    if (config.headers && Object.keys(config.headers).length > 0) {
      console.error(`Custom headers: ${Object.keys(config.headers).join(', ')}`);
    }

    const server = await createMCPServer(proxy);

    console.error('MCP proxy server running on stdio');
    console.error('Press Ctrl+C to stop');

    process.on('SIGINT', () => {
      console.error('\nShutting down...');
      proxy.shutdown();
      void server.close();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.error('\nShutting down...');
      proxy.shutdown();
      void server.close();
      process.exit(0);
    });
  } catch (error) {
    const errorMessage = formatStartupError(error);
    console.error(`Error: ${errorMessage}`);
    process.exit(1);
  }
}

void main();
