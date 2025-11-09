import type { ProxyConfig } from './types.js';
import type { CLIArgs } from './cli-args.js';
import { parseHeaders } from './utils/header-parser.js';
import { parseEnvVars } from './utils/env-parser.js';

export function createProxyConfig(args: CLIArgs): ProxyConfig {
  const denyPatterns = args.deny
    ? args.deny.split(',').map((p) => p.trim()).filter((p) => p.length > 0)
    : [];

  const timeouts = {
    connection: 30000,
    toolList: 10000,
  };

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

  throw new Error('Invalid configuration: no upstream specified');
}
