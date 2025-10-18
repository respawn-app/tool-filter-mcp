# tool-filter-mcp

[![npm version](https://badge.fury.io/js/@respawn-app%2Ftool-filter-mcp.svg)](https://www.npmjs.com/package/@respawn-app/tool-filter-mcp)

MCP proxy server that filters tools from upstream MCP servers via regex-based deny list.

#### Maintained: ✅ Yes (Fall 2025)

## Why use this?

For effective context engineering, we want to minimize useless tokens. Most major agents right now (e.g. Claude Code)
do NOT [remove tool descriptions](https://github.com/anthropics/claude-code/issues/6759) from the context.
Even though the tool is completely denied and unused, the model will still get its entire description and **still**
try to call the tool (and get error messages). For big MCPs, such as github, supabase, jetbrains IDE, atlassian, this 
is catastrophic to the context and leads to context pollution by 40-60k of **useless** tokens. 
You wanted your agent to be able to see jira ticket descriptions?
Please also have these 44 useless tools to edit assignees on confluence pages.

This MCP completely solves the issue without introducing any overhead.
This project is fully vibe-coded with claude. Contributions welcome!

## Features

- **Tool Filtering**: Block specific tools using regex patterns
- **Dual Transport Support**: Connect to HTTP/SSE or stdio MCP servers
- **Header Pass-Through**: Add custom HTTP headers for authentication (HTTP mode)
- **Zero Latency**: Cached tool list, minimal overhead
- **Fail-Fast**: Immediate error on connection issues or invalid patterns
- **Transparent Proxying**: Forwards allowed tool calls to upstream without modification

## Installation

```bash
# For HTTP/SSE MCP servers
npx @respawn-app/tool-filter-mcp --upstream <url> --deny <patterns>

# For stdio MCP servers
npx @respawn-app/tool-filter-mcp --upstream-stdio --deny <patterns> -- <command> [args...]
```

## Usage

### Basic Example (HTTP/SSE)

Filter tools matching `.*_file$` pattern from an HTTP MCP server:

```bash
npx @respawn-app/tool-filter-mcp \
  --upstream http://localhost:3000/sse \
  --deny ".*_file$"
```

### Basic Example (stdio)

Filter tools from a local stdio MCP server:

```bash
npx @respawn-app/tool-filter-mcp \
  --upstream-stdio \
  --deny "dangerous_.*" \
  -- npx my-mcp-server
```

### With Environment Variables (stdio)

Pass environment variables to the upstream stdio server:

```bash
npx @respawn-app/tool-filter-mcp \
  --upstream-stdio \
  --env "API_KEY=secret123" \
  --env "DEBUG=true" \
  --deny "admin_.*" \
  -- npx my-mcp-server
```

### Multiple Patterns

Use comma-separated patterns:

```bash
npx @respawn-app/tool-filter-mcp \
  --upstream http://localhost:3000/sse \
  --deny "get_file_text,create_new_file,replace_text"
```

### With Authentication Headers

Add custom headers for authentication:

```bash
npx @respawn-app/tool-filter-mcp \
  --upstream http://localhost:3000/sse \
  --header "Authorization: Bearer your-token-here" \
  --header "X-API-Key: your-api-key"
```

Headers support environment variable expansion (if not yet expanded by your app):

```bash
npx @respawn-app/tool-filter-mcp \
  --upstream http://localhost:3000/sse \
  --header "Authorization: Bearer $AUTH_TOKEN"
```

### With Claude Code

#### HTTP/SSE Upstream Server

Add to your `.mcp.json`:

```json
{
  "mcpServers": {
    "filtered-http-server": {
      "command": "npx",
      "args": [
        "@respawn-app/tool-filter-mcp",
        "--upstream",
        "http://localhost:3000/sse",
        "--deny",
        "dangerous_tool_1,dangerous_tool_2"
      ],
      "type": "stdio"
    }
  }
}
```

With authentication headers (supports environment variable expansion):

```json
{
  "mcpServers": {
    "filtered-http-server": {
      "command": "npx",
      "args": [
        "@respawn-app/tool-filter-mcp",
        "--upstream",
        "http://localhost:3000/sse",
        "--header",
        "Authorization: Bearer ${API_TOKEN}",
        "--header",
        "X-Custom-Header: $CUSTOM_VALUE",
        "--deny",
        "sensitive_.*"
      ],
      "type": "stdio"
    }
  }
}
```

#### Stdio Upstream Server

```json
{
  "mcpServers": {
    "filtered-zen": {
      "command": "npx",
      "args": [
        "@respawn-app/tool-filter-mcp",
        "--upstream-stdio",
        "--deny",
        "dangerous_.*,sensitive_.*",
        "--",
        "npx",
        "my-mcp-server"
      ],
      "type": "stdio"
    }
  }
}
```

With multiple arguments to the upstream server:

```json
{
  "mcpServers": {
    "filtered-stdio-server": {
      "command": "npx",
      "args": [
        "@respawn-app/tool-filter-mcp",
        "--upstream-stdio",
        "--deny",
        "admin_.*",
        "--",
        "node",
        "my-mcp-server.js",
        "--config=config.json",
        "--verbose"
      ],
      "type": "stdio"
    }
  }
}
```

With arguments that start with dashes (like uvx):

```json
{
  "mcpServers": {
    "filtered-uvx-server": {
      "command": "npx",
      "args": [
        "@respawn-app/tool-filter-mcp",
        "--upstream-stdio",
        "--deny",
        "test_.*",
        "--",
        "uvx",
        "--from",
        "git+https://github.com/BeehiveInnovations/zen-mcp-server.git",
        "zen-mcp-server"
      ],
      "type": "stdio"
    }
  }
}
```

With environment variables for the upstream stdio server:

```json
{
  "mcpServers": {
    "filtered-server-with-env": {
      "command": "npx",
      "args": [
        "@respawn-app/tool-filter-mcp",
        "--upstream-stdio",
        "--env",
        "API_KEY=${MY_API_KEY}",
        "--env",
        "DEBUG=true",
        "--deny",
        "admin_.*",
        "--",
        "npx",
        "my-mcp-server"
      ],
      "type": "stdio"
    }
  }
}
```

## CLI Options

### Connection Mode (mutually exclusive)

You must specify exactly one of:

- `--upstream <url>`: Connect to upstream HTTP/SSE MCP server
- `--upstream-stdio`: Spawn and connect to upstream stdio MCP server
  - Requires command and arguments after `--` separator
  - Example: `--upstream-stdio -- npx zen-mcp-server`

### Common Options

- `--deny <patterns>`: Comma-separated regex patterns for tools to filter

### HTTP/SSE Mode Options

Only applicable with `--upstream`:

- `--header <name:value>`: Custom HTTP header to pass to upstream server (can be repeated for multiple headers)
  - Format: `--header "Header-Name: value"`
  - Supports environment variable expansion: `$VAR` or `${VAR}`
  - Example: `--header "Authorization: Bearer $TOKEN"`

### Stdio Mode Options

Only applicable with `--upstream-stdio`:

- `--env <KEY=value>`: Environment variable to pass to the upstream stdio server (can be repeated for multiple variables)
  - Format: `--env "KEY=value"`
  - Example: `--env "API_KEY=secret" --env "DEBUG=true"`
- After the `--` separator, provide the command and all its arguments
  - Everything after `--` is passed to the upstream server
  - Supports arguments starting with dashes (like `--from`, `--config`, etc.)
  - Example: `--upstream-stdio -- uvx --from git+https://... package-name`

## Requirements

- Node.js >= 20.0.0
- Upstream MCP server with:
  - SSE or Streamable HTTP transport (for `--upstream`), OR
  - stdio transport (for `--upstream-stdio`)

## License

MIT
