#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { ProxyConfig } from './types.js';
import { ProxyOrchestrator } from './proxy.js';
import { MCPServer } from './server.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { formatStartupError } from './utils/error-handler.js';

interface CLIArgs {
  upstream: string;
  deny?: string;
  port?: number;
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
      port: {
        type: 'string',
        short: 'p',
      },
    },
  });

  if (!values.upstream) {
    console.error('Error: --upstream argument is required');
    console.error('Usage: tool-filter-mcp --upstream <url> [--deny <patterns>] [--port <port>]');
    process.exit(1);
  }

  const upstream = values.upstream;
  const deny = values.deny;
  const port = values.port ? parseInt(values.port, 10) : 3001;

  if (values.port && isNaN(port)) {
    console.error(`Error: Invalid port number: ${values.port}`);
    process.exit(1);
  }

  try {
    new URL(upstream);
  } catch (error) {
    console.error(`Error: Invalid upstream URL: ${upstream}`);
    process.exit(1);
  }

  return {
    upstream,
    deny,
    port,
  };
}

function createProxyConfig(args: CLIArgs): ProxyConfig {
  const denyPatterns = args.deny
    ? args.deny.split(',').map((p) => p.trim()).filter((p) => p.length > 0)
    : [];

  return {
    upstreamUrl: args.upstream,
    denyPatterns,
    timeouts: {
      connection: 30000,
      toolList: 10000,
    },
  };
}

async function createUpstreamClient(upstreamUrl: string): Promise<any> {
  const transport = new SSEClientTransport(new URL(upstreamUrl));
  const client = new Client(
    {
      name: 'tool-filter-mcp',
      version: '0.1.0',
    },
    {
      capabilities: {},
    }
  );

  await client.connect(transport);
  return client;
}

async function main(): Promise<void> {
  try {
    const args = parseCLIArgs();
    const config = createProxyConfig(args);

    console.error(`Connecting to upstream MCP at ${config.upstreamUrl}...`);

    const upstreamClient = await createUpstreamClient(config.upstreamUrl);

    const proxy = new ProxyOrchestrator(config, upstreamClient);
    await proxy.startup();

    const filteredTools = proxy.getCachedTools();
    console.error(
      `Proxy ready. Filtered ${filteredTools.length} tools from upstream.`
    );

    if (config.denyPatterns.length > 0) {
      console.error(`Deny patterns: ${config.denyPatterns.join(', ')}`);
    }

    new MCPServer(proxy);

    console.error(`MCP proxy server running on port ${args.port}`);
    console.error('Press Ctrl+C to stop');

    process.on('SIGINT', () => {
      console.error('\nShutting down...');
      proxy.shutdown();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.error('\nShutting down...');
      proxy.shutdown();
      process.exit(0);
    });

    await new Promise(() => {});
  } catch (error) {
    const errorMessage = formatStartupError(error);
    console.error(`Error: ${errorMessage}`);
    process.exit(1);
  }
}

main();
