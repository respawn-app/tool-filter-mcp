import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const sseTransportMock = vi.hoisted(() => vi.fn(() => ({
  close: vi.fn().mockResolvedValue(undefined),
})));

const streamableTransportMock = vi.hoisted(() => vi.fn(() => ({
  close: vi.fn().mockResolvedValue(undefined),
  terminateSession: vi.fn().mockResolvedValue(undefined),
})));

const clientConnectMock = vi.hoisted(() => vi.fn());

vi.mock('@modelcontextprotocol/sdk/client/sse.js', () => ({
  SSEClientTransport: sseTransportMock,
}));

vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: streamableTransportMock,
}));

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => {
  class MockClient {
    connect = clientConnectMock;
    listTools = vi.fn();
    callTool = vi.fn();
    close = vi.fn();
  }

  return {
    Client: MockClient,
  };
});

describe('CLI header support', () => {
  beforeEach(() => {
    sseTransportMock.mockClear();
    streamableTransportMock.mockClear();
    clientConnectMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('passes configured headers to transports', async () => {
    clientConnectMock.mockImplementation(async (transport: Record<string, unknown>) => {
      if ('terminateSession' in transport) {
        throw new Error('Error POSTing to endpoint (HTTP 405): Not Allowed');
      }
    });

    const { createUpstreamClient } = await import('../../src/index.js');

    const headers = {
      Authorization: 'Bearer token',
      'X-Custom': 'value',
    };

    const upstreamClient = await createUpstreamClient('https://example.com/mcp', headers);

    await expect(upstreamClient.connect()).resolves.toBeUndefined();

    expect(streamableTransportMock).toHaveBeenCalledTimes(1);
    expect(streamableTransportMock).toHaveBeenCalledWith(
      new URL('https://example.com/mcp'),
      {
        fetch: expect.any(Function),
        requestInit: { headers },
      }
    );

    expect(sseTransportMock).toHaveBeenCalledTimes(1);
    expect(sseTransportMock).toHaveBeenCalledWith(
      new URL('https://example.com/mcp'),
      {
        eventSourceInit: {
          headers,
          fetch: expect.any(Function),
        },
        requestInit: { headers },
        fetch: expect.any(Function),
      }
    );

    expect(clientConnectMock).toHaveBeenCalledTimes(2);

    upstreamClient.disconnect();
  });
});
