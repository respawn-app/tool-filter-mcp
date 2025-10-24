import { FilteredTool } from './types.js';

export interface UpstreamTimeouts {
  connection: number;
  toolList: number;
}

export interface MCPClient {
  connect(): Promise<void>;
  listTools(): Promise<{ tools: FilteredTool[] }>;
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
  disconnect(): void;
  isConnected(): boolean;
}

export class UpstreamConnection {
  private identifier: string;
  private client: MCPClient;
  private timeouts: UpstreamTimeouts;
  private connected: boolean = false;
  private toolCache: FilteredTool[] | null = null;

  constructor(
    identifier: string,
    client: MCPClient,
    timeouts: UpstreamTimeouts = { connection: 30000, toolList: 10000 }
  ) {
    this.identifier = identifier;
    this.client = client;
    this.timeouts = timeouts;
  }

  async connect(): Promise<void> {
    if (this.connected) {
      throw new Error('Already connected');
    }

    try {
      await this.withTimeout(this.client.connect(), this.timeouts.connection, 'Connection timeout');
      this.connected = true;
    } catch (error) {
      this.connected = false;
      throw error;
    }
  }

  async fetchTools(): Promise<FilteredTool[]> {
    if (!this.connected) {
      throw new Error('Not connected');
    }

    if (this.toolCache !== null) {
      return this.toolCache;
    }

    try {
      const response = await this.withTimeout(
        this.client.listTools(),
        this.timeouts.toolList,
        'Tool list fetch timeout'
      );
      this.toolCache = response.tools;
      return this.toolCache;
    } catch (error) {
      throw error;
    }
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.connected) {
      throw new Error('Not connected');
    }

    return await this.client.callTool(name, args);
  }

  disconnect(): void {
    if (this.connected) {
      this.client.disconnect();
      this.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected && this.client.isConnected();
  }

  getIdentifier(): string {
    return this.identifier;
  }

  getCachedTools(): FilteredTool[] | null {
    return this.toolCache;
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage: string
  ): Promise<T> {
    let timeoutHandle: NodeJS.Timeout;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(`${errorMessage} after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timeoutHandle!);
      return result;
    } catch (error) {
      clearTimeout(timeoutHandle!);
      throw error;
    }
  }
}
