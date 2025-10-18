export type UpstreamMode = 'http' | 'stdio';

export interface BaseProxyConfig {
  denyPatterns: string[];
  timeouts: {
    connection: number;
    toolList: number;
  };
}

export interface HttpProxyConfig extends BaseProxyConfig {
  mode: 'http';
  upstreamUrl: string;
  headers?: Record<string, string>;
}

export interface StdioProxyConfig extends BaseProxyConfig {
  mode: 'stdio';
  upstreamCommand: string;
  upstreamArgs: string[];
  env?: Record<string, string>;
}

export type ProxyConfig = HttpProxyConfig | StdioProxyConfig;

export interface FilteredTool {
  name: string;
  description?: string;
  inputSchema: object;
}

export interface ToolFilterResult {
  allowed: FilteredTool[];
  denied: string[];
  invalidPatterns: string[];
}

export interface ConnectionError {
  code: 'TIMEOUT' | 'REFUSED' | 'INVALID_RESPONSE';
  message: string;
  internalDetails: string;
}
