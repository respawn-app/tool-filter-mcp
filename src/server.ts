import { ProxyOrchestrator } from './proxy.js';
import { FilteredTool } from './types.js';

export interface MCPToolCallError extends Error {
  code: number;
  message: string;
}

export class MCPServer {
  private proxy: ProxyOrchestrator;

  constructor(proxy: ProxyOrchestrator) {
    this.proxy = proxy;
  }

  async handleListTools(): Promise<{ tools: FilteredTool[] }> {
    const tools = this.proxy.getCachedTools();
    return { tools };
  }

  async handleCallTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.proxy.isToolAllowed(name)) {
      const error = new Error(`Tool not found: ${name}`) as MCPToolCallError;
      error.code = -32601;
      throw error;
    }

    const connection = this.proxy.getUpstreamConnection();
    return await connection.callTool(name, args);
  }

  supportsResources(): boolean {
    return true;
  }

  supportsPrompts(): boolean {
    return true;
  }

  supportsSampling(): boolean {
    return true;
  }

  async handleResourcesList(): Promise<unknown> {
    return { resources: [] };
  }

  async handleResourceRead(uri: string): Promise<unknown> {
    const connection = this.proxy.getUpstreamConnection();
    return await (connection as any).readResource?.(uri);
  }

  async handlePromptsList(): Promise<unknown> {
    return { prompts: [] };
  }

  async handlePromptGet(name: string): Promise<unknown> {
    const connection = this.proxy.getUpstreamConnection();
    return await (connection as any).getPrompt?.(name);
  }

  async handleSamplingCreateMessage(params: unknown): Promise<unknown> {
    const connection = this.proxy.getUpstreamConnection();
    return await (connection as any).createMessage?.(params);
  }
}
