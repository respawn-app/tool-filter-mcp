#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
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
import type { EventSourceInit } from 'eventsource';
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
  listTools(): Promise<{ tools: { name: string; description?: string; inputSchema: object }[] }>;
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
    async listTools(): Promise<{ tools: { name: string; description?: string; inputSchema: object }[] }> {
      const result = await client.listTools();
      return result as { tools: { name: string; description?: string; inputSchema: object }[] };
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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void main();
}
