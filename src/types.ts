export interface ProxyConfig {
  upstreamUrl: string;
  denyPatterns: string[];
  timeouts: {
    connection: number;
    toolList: number;
  };
}

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
