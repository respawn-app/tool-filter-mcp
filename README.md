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
- **Header Pass-Through**: Add custom HTTP headers for authentication
- **Zero Latency**: Cached tool list, minimal overhead
- **Fail-Fast**: Immediate error on connection issues or invalid patterns
- **Transparent Proxying**: Forwards allowed tool calls to upstream without modification

## Installation

```bash
npx @respawn-app/tool-filter-mcp --upstream <url> --deny <patterns>
```

## Usage

### Basic Example

Filter tools matching `.*_file$` pattern:

```bash
npx @respawn-app/tool-filter-mcp \
  --upstream http://localhost:3000/sse \
  --deny ".*_file$"
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

Add to your `.mcp.json`:

```json
{
  "mcpServers": {
    "filtered-server": {
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
    "filtered-server": {
      "command": "npx",
      "args": [
        "@respawn-app/tool-filter-mcp",
        "--upstream",
        "http://localhost:3000/sse",
        "--header",
        "Authorization: Bearer ${API_TOKEN}",
        "--header",
        "X-Custom-Header: $CUSTOM_VALUE"
      ],
      "type": "stdio"
    }
  }
}
```

## CLI Options

- `--upstream <url>` (required): Upstream MCP server URL (SSE transport)
- `--deny <patterns>`: Comma-separated regex patterns for tools to filter
- `--header <name:value>`: Custom HTTP header to pass to upstream server (can be repeated for multiple headers)
  - Format: `--header "Header-Name: value"`
  - Supports environment variable expansion: `$VAR` or `${VAR}`
  - Example: `--header "Authorization: Bearer $TOKEN"`

## Requirements

- Node.js >= 20.0.0
- Upstream MCP server with SSE transport

## License

MIT
