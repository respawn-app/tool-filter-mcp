import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import express, { Express } from 'express';
import { Server as HttpServer } from 'http';
import { spawn, ChildProcess } from 'child_process';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { z } from 'zod';

const STREAMABLE_HTTP_PORT = 64400;
const SSE_PORT = 64401;

async function startStreamableHttpServer(port: number): Promise<{ app: Express; server: HttpServer }> {
  const app = express();
  app.use(express.json());

  app.use(async (req, res) => {
    const mcpServer = new McpServer(
      {
        name: 'test-streamable-http-server',
        version: '1.0.0',
      },
      {
        capabilities: { tools: {} },
      }
    );

    mcpServer.tool(
      'test_tool',
      'A test tool for Streamable HTTP',
      {
        message: z.string().describe('Test message'),
      },
      async ({ message }) => ({
        content: [
          {
            type: 'text',
            text: `Streamable HTTP response: ${message}`,
          },
        ],
      })
    );

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });

    await mcpServer.connect(transport);

    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      const parsedBody = body ? JSON.parse(body) : undefined;
      await transport.handleRequest(req, res, parsedBody);
    });
  });

  const server = await new Promise<HttpServer>((resolve) => {
    const s = app.listen(port, () => resolve(s));
  });

  return { app, server };
}

async function startSseServer(port: number): Promise<{ app: Express; server: HttpServer }> {
  const app = express();
  app.use(express.json());

  const transports = new Map<string, SSEServerTransport>();

  app.get('/sse', async (req, res) => {
    const mcpServer = new McpServer(
      {
        name: 'test-sse-server',
        version: '1.0.0',
      },
      {
        capabilities: { tools: {} },
      }
    );

    mcpServer.tool(
      'test_tool',
      'A test tool for SSE',
      {
        message: z.string().describe('Test message'),
      },
      async ({ message }) => ({
        content: [
          {
            type: 'text',
            text: `SSE response: ${message}`,
          },
        ],
      })
    );

    const transport = new SSEServerTransport('/messages', res);
    const sessionId = transport.sessionId;
    transports.set(sessionId, transport);

    transport.onclose = () => {
      transports.delete(sessionId);
    };

    await mcpServer.connect(transport);
  });

  app.post('/messages', async (req, res) => {
    const sessionId = req.query.sessionId as string;
    if (!sessionId) {
      res.status(400).send('Missing sessionId');
      return;
    }

    const transport = transports.get(sessionId);
    if (!transport) {
      res.status(404).send('Session not found');
      return;
    }

    await transport.handlePostMessage(req, res, req.body);
  });

  const server = await new Promise<HttpServer>((resolve) => {
    const s = app.listen(port, () => resolve(s));
  });

  return { app, server };
}

describe('Transport compatibility', () => {
  let streamableHttpServer: HttpServer;
  let sseServer: HttpServer;

  beforeAll(async () => {
    const streamableResult = await startStreamableHttpServer(STREAMABLE_HTTP_PORT);
    streamableHttpServer = streamableResult.server;

    const sseResult = await startSseServer(SSE_PORT);
    sseServer = sseResult.server;
  }, 15000);

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      streamableHttpServer.close(() => resolve());
    });

    await new Promise<void>((resolve) => {
      sseServer.close(() => resolve());
    });
  });

  it('should connect to Streamable HTTP server and call a tool', (done) => {
    const cliPath = join(process.cwd(), 'dist', 'index.js');

    const proxyProcess = spawn('node', [
      cliPath,
      '--upstream',
      `http://localhost:${STREAMABLE_HTTP_PORT}`,
    ]);

    let stderr = '';

    proxyProcess.stderr?.on('data', (data) => {
      stderr += data.toString();

      if (stderr.includes('Connected via Streamable HTTP transport')) {
        proxyProcess.kill();
        expect(stderr).toContain('Connected via Streamable HTTP transport');
        expect(stderr).toContain('Proxy ready');
        done();
      }

      if (stderr.includes('Error:') || stderr.includes('falling back to SSE')) {
        proxyProcess.kill();
        done(new Error('Should not fall back to SSE for Streamable HTTP server'));
      }
    });

    setTimeout(() => {
      if (proxyProcess) {
        proxyProcess.kill();
        done(new Error('Timeout waiting for Streamable HTTP connection'));
      }
    }, 5000);
  }, 10000);

  it('should fall back to SSE when Streamable HTTP fails', (done) => {
    const cliPath = join(process.cwd(), 'dist', 'index.js');

    const proxyProcess = spawn('node', [
      cliPath,
      '--upstream',
      `http://localhost:${SSE_PORT}/sse`,
    ]);

    let stderr = '';

    proxyProcess.stderr?.on('data', (data) => {
      stderr += data.toString();

      if (stderr.includes('Connected via SSE transport (deprecated)')) {
        proxyProcess.kill();
        expect(stderr).toContain('falling back to SSE transport');
        expect(stderr).toContain('Connected via SSE transport (deprecated)');
        expect(stderr).toContain('Proxy ready');
        done();
      }

      if (stderr.includes('Error:') && !stderr.includes('falling back')) {
        proxyProcess.kill();
        done(new Error('Unexpected error'));
      }
    });

    setTimeout(() => {
      if (proxyProcess) {
        proxyProcess.kill();
        done(new Error('Timeout waiting for SSE fallback'));
      }
    }, 5000);
  }, 10000);

  it('should successfully use Streamable HTTP server with tools', (done) => {
    const cliPath = join(process.cwd(), 'dist', 'index.js');

    const proxyProcess: ChildProcess = spawn('node', [
      cliPath,
      '--upstream',
      `http://localhost:${STREAMABLE_HTTP_PORT}`,
    ]);

    let stderr = '';
    let connected = false;

    proxyProcess.stderr?.on('data', (data) => {
      stderr += data.toString();

      if (stderr.includes('Connected via Streamable HTTP transport') && !connected) {
        connected = true;
        expect(stderr).toContain('Proxy ready');
        expect(stderr).toContain('Filtered 1 tools from upstream');

        proxyProcess.kill();
        done();
      }

      if (stderr.includes('Error:')) {
        proxyProcess.kill();
        done(new Error(`Connection error: ${stderr}`));
      }
    });

    setTimeout(() => {
      if (proxyProcess) {
        proxyProcess.kill();
        done(new Error('Timeout'));
      }
    }, 5000);
  }, 10000);
});
