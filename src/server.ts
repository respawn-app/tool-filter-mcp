import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { ProxyOrchestrator } from './proxy.js';

export async function createMCPServer(proxy: ProxyOrchestrator): Promise<Server> {
  const server = new Server(
    {
      name: 'tool-filter-mcp',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = proxy.getCachedTools();
    return {
      tools: tools.map(
        (t): Tool => ({
          name: t.name,
          description: t.description,
          inputSchema: {
            type: 'object',
            ...t.inputSchema,
          },
        })
      ),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (!proxy.isToolAllowed(name)) {
      throw {
        code: -32601,
        message: `Tool not found: ${name}`,
      };
    }

    const connection = proxy.getUpstreamConnection();
    const result = await connection.callTool(name, args || {});
    return result as { content?: unknown[]; isError?: boolean };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  return server;
}
