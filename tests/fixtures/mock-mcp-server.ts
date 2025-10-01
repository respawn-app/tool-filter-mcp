import { FilteredTool } from '../../src/types.js';

export interface MockMCPServerConfig {
  tools: FilteredTool[];
  shouldFailConnection?: boolean;
  connectionDelay?: number;
  toolListDelay?: number;
}

export class MockMCPServer {
  private config: MockMCPServerConfig;
  private connected: boolean = false;

  constructor(config: MockMCPServerConfig) {
    this.config = {
      shouldFailConnection: false,
      connectionDelay: 0,
      toolListDelay: 0,
      ...config,
    };
  }

  async connect(): Promise<void> {
    if (this.config.shouldFailConnection) {
      throw new Error('Connection refused');
    }

    if (this.config.connectionDelay && this.config.connectionDelay > 0) {
      await this.delay(this.config.connectionDelay);
    }

    this.connected = true;
  }

  async listTools(): Promise<{ tools: FilteredTool[] }> {
    if (!this.connected) {
      throw new Error('Not connected');
    }

    if (this.config.toolListDelay && this.config.toolListDelay > 0) {
      await this.delay(this.config.toolListDelay);
    }

    return {
      tools: this.config.tools,
    };
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.connected) {
      throw new Error('Not connected');
    }

    const tool = this.config.tools.find((t) => t.name === name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: `Mock result for ${name} with args: ${JSON.stringify(args)}`,
        },
      ],
    };
  }

  disconnect(): void {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export function createMockServer(tools: FilteredTool[]): MockMCPServer {
  return new MockMCPServer({ tools });
}

export function createFailingMockServer(): MockMCPServer {
  return new MockMCPServer({
    tools: [],
    shouldFailConnection: true,
  });
}

export function createSlowMockServer(tools: FilteredTool[], delay: number): MockMCPServer {
  return new MockMCPServer({
    tools,
    connectionDelay: delay,
    toolListDelay: delay,
  });
}
