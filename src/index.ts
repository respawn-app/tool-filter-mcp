#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { ProxyConfig } from './types.js';
import { ProxyOrchestrator } from './proxy.js';
import { createMCPServer } from './server.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import {
  SSEClientTransport,
  type SSEClientTransportOptions,
} from '@modelcontextprotocol/sdk/client/sse.js';
import {
  StreamableHTTPClientTransport,
  type StreamableHTTPClientTransportOptions,
} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { EventSourceInit } from 'eventsource';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { formatStartupError } from './utils/error-handler.js';
import { parseHeaders } from './utils/header-parser.js';

type ToolListFormat = 'table' | 'json' | 'names';

interface CLIArgs {
  upstream?: string;
  upstreamStdio?: boolean;
  deny?: string;
  header?: string[];
  env?: string[];
  positionals: string[];
  listTools?: boolean;
  format?: ToolListFormat;
}

export function parseCLIArgs(): CLIArgs {
  const { values, positionals } = parseArgs({
    options: {
      upstream: {
        type: 'string',
        short: 'u',
      },
      'upstream-stdio': {
        type: 'boolean',
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
      env: {
        type: 'string',
        short: 'e',
        multiple: true,
      },
      'list-tools': {
        type: 'boolean',
        short: 'l',
      },
      format: {
        type: 'string',
        short: 'f',
      },
    },
    allowPositionals: true,
  });

  if (!values.upstream) {
    console.error('Error: --upstream argument is required');
    console.error('Usage: tool-filter-mcp --upstream <url> [--deny <patterns>] [--header <name:value>]');
    process.exit(1);
  }

  const upstream = values.upstream;
  const upstreamStdio = values['upstream-stdio'];
  const deny = values.deny;
  const header = values.header;
  const env = values.env;
  const listTools = values['list-tools'];
  const format = values.format as ToolListFormat | undefined;

  // Validate mutual exclusion
  if (!upstream && !upstreamStdio) {
    console.error('Error: Either --upstream or --upstream-stdio is required');
    console.error('Usage (HTTP): tool-filter-mcp --upstream <url> [--deny <patterns>] [--header <name:value>]');
    console.error('Usage (stdio): tool-filter-mcp --upstream-stdio [--deny <patterns>] [--env <KEY=value>] -- <command> [args...]');
    process.exit(1);
  }

  if (upstream && upstreamStdio) {
    console.error('Error: --upstream and --upstream-stdio are mutually exclusive');
    console.error(
      'Use --upstream for HTTP/SSE servers or --upstream-stdio for stdio servers, but not both'
    );
    process.exit(1);
  }

  // Validate URL if using HTTP upstream
  if (upstream) {
    try {
      new URL(upstream);
    } catch {
      console.error(`Error: Invalid upstream URL: ${upstream}`);
      process.exit(1);
    }
  }

  // Validate format if provided
  if (format && !['table', 'json', 'names'].includes(format)) {
    console.error(`Error: Invalid format "${format}". Must be one of: table, json, names`);
    process.exit(1);
  }

  // Warn if positionals are provided with HTTP upstream (ignored)
  if (positionals.length > 0) {
    console.error('Warning: Positional arguments are only applicable with --upstream-stdio and will be ignored');
  }

  // Validate stdio mode has command
  if (upstreamStdio && positionals.length === 0) {
    console.error('Error: --upstream-stdio requires a command and arguments after --');
    console.error('Usage: tool-filter-mcp --upstream-stdio [--deny <patterns>] [--env <KEY=value>] -- <command> [args...]');
    console.error('Example: tool-filter-mcp --upstream-stdio --env API_KEY=secret -- uvx --from git+https://... zen-mcp-server');
    process.exit(1);
  }

  // Warn if --header is used with stdio upstream (ignored)
  if (upstreamStdio && header && header.length > 0) {
    console.error('Warning: --header is only applicable with --upstream and will be ignored');
  }

  // Warn if --env is used with HTTP upstream (ignored)
  if (upstream && env && env.length > 0) {
    console.error('Warning: --env is only applicable with --upstream-stdio and will be ignored');
  }

  return {
    upstream,
    upstreamStdio,
    deny,
    header,
    env,
    listTools,
    format: format || 'table',
    positionals,
  };
}

export function parseEnvVars(envArray: string[]): Record<string, string> {
  const envVars: Record<string, string> = {};

  for (const envStr of envArray) {
    const separatorIndex = envStr.indexOf('=');
    if (separatorIndex === -1) {
      console.error(`Warning: Invalid environment variable format: "${envStr}". Expected KEY=value format.`);
      continue;
    }

    const key = envStr.slice(0, separatorIndex).trim();
    const value = envStr.slice(separatorIndex + 1);

    if (key.length === 0) {
      console.error(`Warning: Invalid environment variable format: "${envStr}". Key cannot be empty.`);
      continue;
    }

    envVars[key] = value;
  }

  return envVars;
}

export function createProxyConfig(args: CLIArgs): ProxyConfig {
  const denyPatterns = args.deny
    ? args.deny.split(',').map((p) => p.trim()).filter((p) => p.length > 0)
    : [];

  const timeouts = {
    connection: 30000,
    toolList: 10000,
  };

  // HTTP mode
  if (args.upstream) {
    const headers = args.header && args.header.length > 0
      ? parseHeaders(args.header)
      : undefined;

    return {
      mode: 'http',
      upstreamUrl: args.upstream,
      denyPatterns,
      headers,
      timeouts,
    };
  }

  // Stdio mode
  if (args.upstreamStdio) {
    const [upstreamCommand, ...upstreamArgs] = args.positionals;
    const env = args.env && args.env.length > 0
      ? parseEnvVars(args.env)
      : undefined;

    return {
      mode: 'stdio',
      upstreamCommand,
      upstreamArgs,
      denyPatterns,
      env,
      timeouts,
    };
  }

  // This should never happen due to validation in parseCLIArgs
  throw new Error('Invalid configuration: no upstream specified');
}


export function truncateDescription(desc: string, maxLength: number): string {
  const firstLine = desc.split('\n')[0];
  if (firstLine.length > maxLength) {
    return firstLine.substring(0, maxLength) + '...';
  }
  return firstLine !== desc ? firstLine + '...' : firstLine;
}

export function formatToolsList(tools: Tool[], format: ToolListFormat): string {
  if (tools.length === 0) {
    return format === 'json' ? '[]' : '';
  }

  switch (format) {
    case 'json':
      return JSON.stringify(tools, null, 2);

    case 'names':
      return tools.map((t) => t.name).join(',');

    case 'table':
    default:
      const header = `Available tools (${tools.length} total):\n`;
      const maxNameLength = Math.max(...tools.map((t) => t.name.length), 20);
      const separator = '\n';
      const maxDescLength = 100;

      const rows = tools.map((tool) => {
        const name = tool.name.padEnd(maxNameLength + 2);
        const desc = truncateDescription(tool.description || '(no description)', maxDescLength);

        return `${name}${desc}`;
      });

      return header + separator + rows.join('\n');
  }
}

function normalizeAllowHeader(header: string | null): string | null {
  if (!header) {
    return null;
  }

  const methods = header
    .split(',')
    .map((method) => method.trim().toUpperCase())
    .filter((method) => method.length > 0);

  if (methods.length === 0) {
    return null;
  }

  return [...new Set(methods)].join(', ');
}

async function probeAllowedMethods(
  upstreamUrl: string,
  headers: Record<string, string>,
  fetchImpl: typeof fetch
): Promise<string | null> {
  const methodsToTry: Array<RequestInit['method']> = ['OPTIONS', 'HEAD'];
  const headerEntries = Object.entries(headers ?? {});

  for (const method of methodsToTry) {
    try {
      const requestInit: RequestInit = { method };

      if (headerEntries.length > 0) {
        const requestHeaders = new Headers();
        for (const [key, value] of headerEntries) {
          requestHeaders.set(key, value);
        }
        requestInit.headers = requestHeaders;
      }

      const response = await fetchImpl(upstreamUrl, requestInit);
      const allowHeader = normalizeAllowHeader(
        response.headers && typeof response.headers.get === 'function'
          ? response.headers.get('allow')
          : null
      );

      if (allowHeader) {
        return allowHeader;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function isMethodNotAllowedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = (error as { code?: unknown }).code;

  if (typeof code === 'number') {
    return code === 405;
  }

  if (typeof code === 'string') {
    const parsed = Number(code);
    return Number.isInteger(parsed) && parsed === 405;
  }

  return false;
}

export interface WrappedClient {
  connect(): Promise<void>;
  listTools(): Promise<{ tools: Tool[] }>;
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
  disconnect(): void;
  isConnected(): boolean;
}

export async function createUpstreamClient(
  upstreamUrl: string,
  headers?: Record<string, string>
): Promise<WrappedClient> {
  const allowHeaderRef: { value: string | null } = { value: null };
  const baseFetch: typeof fetch = fetch;
  const upstreamTarget = new URL(upstreamUrl);
  const safeHeaders = headers ?? {};

  const fetchWithAllowCapture: typeof fetch = async (input, init) => {
    const response = await baseFetch(input, init);

    if (response && typeof response === 'object' && 'status' in response && response.status === 405) {
      const headers =
        'headers' in response && response.headers && typeof (response.headers as Headers).get === 'function'
          ? (response.headers as Headers)
          : undefined;
      const allowHeader = headers ? headers.get('allow') : null;
      allowHeaderRef.value = normalizeAllowHeader(allowHeader);
    }

    return response;
  };

  const eventSourceInit: EventSourceInit & {
    headers?: Record<string, string>;
    fetch: typeof fetch;
  } = {
    fetch: fetchWithAllowCapture,
  };

  const requestInit: RequestInit | undefined = Object.keys(safeHeaders).length > 0
    ? { headers: safeHeaders }
    : undefined;

  if (Object.keys(safeHeaders).length > 0) {
    eventSourceInit.headers = safeHeaders;
  }

  const transportOptions: SSEClientTransportOptions = {
    eventSourceInit,
    fetch: fetchWithAllowCapture,
    ...(requestInit ? { requestInit } : {}),
  };
  const streamableOptions: StreamableHTTPClientTransportOptions = {
    fetch: fetchWithAllowCapture,
    ...(requestInit ? { requestInit } : {}),
  };

  const determineTransportOrder = (url: URL): Array<'streamable' | 'sse'> => {
    const rawPath = url.pathname.toLowerCase();
    const normalizedPath = rawPath === '/' ? '/' : rawPath.replace(/\/+$/, '');
    if (normalizedPath.endsWith('/sse')) {
      return ['sse', 'streamable'];
    }
    if (normalizedPath.endsWith('/mcp')) {
      return ['streamable', 'sse'];
    }
    return ['streamable', 'sse'];
  };

  const transportOrder = determineTransportOrder(upstreamTarget);
  const createClient = (): Client =>
    new Client(
      {
        name: 'tool-filter-mcp',
        version: '0.2.0',
      },
      {
        capabilities: {},
      }
    );

  let client: Client = createClient();
  let activeTransport: SSEClientTransport | StreamableHTTPClientTransport | null = null;
  let connected = false;

  const closeTransport = async (
    transport: SSEClientTransport | StreamableHTTPClientTransport
  ): Promise<void> => {
    try {
      await transport.close();
    } catch {}
  };

  const shouldFallbackToSse = (error: unknown): boolean => {
    if (isMethodNotAllowedError(error)) {
      return true;
    }

    if (error instanceof Error && typeof error.message === 'string') {
      return /HTTP\s+40[45]/.test(error.message);
    }

    return false;
  };

  return {
    async connect(): Promise<void> {
      activeTransport = null;
      connected = false;

      for (let index = 0; index < transportOrder.length; index += 1) {
        const attempt = transportOrder[index];

        allowHeaderRef.value = null;
        client = createClient();

        const transport =
          attempt === 'streamable'
            ? new StreamableHTTPClientTransport(new URL(upstreamUrl), streamableOptions)
            : new SSEClientTransport(new URL(upstreamUrl), transportOptions);

        try {
          await client.connect(transport);
          activeTransport = transport;
          connected = true;
          return;
        } catch (error) {
          await closeTransport(transport);
          activeTransport = null;
          connected = false;

          if (attempt === 'streamable') {
            const hasSseRemaining = transportOrder.slice(index + 1).includes('sse');

            if (hasSseRemaining && shouldFallbackToSse(error)) {
              allowHeaderRef.value = null;
              continue;
            }

            if (isMethodNotAllowedError(error)) {
              const allowedMethods =
                allowHeaderRef.value ??
                (await probeAllowedMethods(upstreamUrl, safeHeaders, fetchWithAllowCapture));
              const message = allowedMethods
                ? `Upstream responded with HTTP 405 Method Not Allowed. Supported methods: ${allowedMethods}.`
                : 'Upstream responded with HTTP 405 Method Not Allowed and did not provide an Allow header.';

              throw new Error(message, { cause: error });
            }

            throw error;
          }

          const hasStreamableRemaining = transportOrder.slice(index + 1).includes('streamable');

          if (hasStreamableRemaining) {
            continue;
          }

          if (isMethodNotAllowedError(error)) {
            const allowedMethods =
              allowHeaderRef.value ??
              (await probeAllowedMethods(upstreamUrl, safeHeaders, fetchWithAllowCapture));
            const message = allowedMethods
              ? `Upstream responded with HTTP 405 Method Not Allowed. Supported methods: ${allowedMethods}.`
              : 'Upstream responded with HTTP 405 Method Not Allowed and did not provide an Allow header.';

            throw new Error(message, { cause: error });
          }

          throw error;
        }
      }
    },
    async listTools(): Promise<{ tools: Tool[] }> {
      const result = await client.listTools();
      return result as { tools: Tool[] };
    },
    async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
      return await client.callTool({ name, arguments: args });
    },
    disconnect(): void {
      if (activeTransport instanceof StreamableHTTPClientTransport) {
        void activeTransport.terminateSession().catch(() => undefined);
      }

      void client.close();
      connected = false;
      activeTransport = null;
    },
    isConnected(): boolean {
      return connected;
    },
  };
}

export async function createStdioUpstreamClient(
  command: string,
  args: string[],
  env?: Record<string, string>
): Promise<WrappedClient> {
  const client = new Client(
    {
      name: 'tool-filter-mcp',
      version: '0.3.1',
    },
    {
      capabilities: {},
    }
  );

  let transport: StdioClientTransport | null = null;
  let connected = false;

  return {
    async connect(): Promise<void> {
      transport = new StdioClientTransport({
        command,
        args,
        env,
      });

      await client.connect(transport);
      connected = true;
    },

    async listTools(): Promise<{ tools: Tool[] }> {
      const result = await client.listTools();
      return result as { tools: Tool[] };
    },

    async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
      return await client.callTool({ name, arguments: args });
    },

    disconnect(): void {
      void client.close();
      connected = false;
      transport = null;
    },

    isConnected(): boolean {
      return connected;
    },
  };
}

export async function listToolsMode(args: CLIArgs): Promise<void> {
  try {
    const config = createProxyConfig(args);

    // Create upstream client based on config mode
    let upstreamClient: WrappedClient;

    if (config.mode === 'http') {
      console.error(`Connecting to upstream MCP at ${config.upstreamUrl}...`);
      upstreamClient = await createUpstreamClient(config.upstreamUrl, config.headers);
    } else {
      const commandDisplay = `${config.upstreamCommand} ${config.upstreamArgs.join(' ')}`;
      console.error(`Connecting to upstream MCP via stdio: ${commandDisplay}...`);
      upstreamClient = await createStdioUpstreamClient(config.upstreamCommand, config.upstreamArgs, config.env);
    }
    await upstreamClient.connect()

    console.error('Fetching tools from upstream...');

    const result = await upstreamClient.listTools();
    let tools = result.tools;

    // Apply filtering if deny patterns are provided
    if (config.denyPatterns.length > 0) {
      const patterns = config.denyPatterns.map((pattern) => new RegExp(pattern));
      tools = tools.filter((tool) => {
        return !patterns.some((pattern) => pattern.test(tool.name));
      });
      console.error(`Applied ${config.denyPatterns.length} filter pattern(s)`);
    }

    // Output to stdout (not stderr) so it can be piped/redirected
    const formatted = formatToolsList(tools, args.format || 'table');
    // eslint-disable-next-line no-console
    console.log(formatted);

    upstreamClient.disconnect();
  } catch (error) {
    const errorMessage = formatStartupError(error);
    console.error(`Error: ${errorMessage}`);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  try {
    const args = parseCLIArgs();

    // Handle list-tools mode
    if (args.listTools) {
      await listToolsMode(args);
      return;
    }

    const config = createProxyConfig(args);

    // Create upstream client based on config mode
    let upstreamClient: WrappedClient;

    if (config.mode === 'http') {
      console.error(`Connecting to upstream MCP at ${config.upstreamUrl}...`);
      upstreamClient = await createUpstreamClient(config.upstreamUrl, config.headers);
    } else {
      const commandDisplay = `${config.upstreamCommand} ${config.upstreamArgs.join(' ')}`;
      console.error(`Connecting to upstream MCP via stdio: ${commandDisplay}...`);
      upstreamClient = await createStdioUpstreamClient(config.upstreamCommand, config.upstreamArgs, config.env);
    }

    const proxy = new ProxyOrchestrator(config, upstreamClient);
    await proxy.startup();

    const filteredTools = proxy.getCachedTools();
    console.error(
      `Proxy ready. Filtered ${filteredTools.length} tools from upstream.`
    );

    if (config.denyPatterns.length > 0) {
      console.error(`Deny patterns: ${config.denyPatterns.join(', ')}`);
    }

    if (config.mode === 'http' && config.headers && Object.keys(config.headers).length > 0) {
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

// Run main() unless we're being imported for testing
// Check for common test environments instead of exact path matching
// which breaks with npx due to symlink resolution
const isTest = process.env.NODE_ENV === 'test' ||
              process.argv.some(arg => arg.includes('vitest') || arg.includes('jest'));

if (!isTest) {
  void main();
}
