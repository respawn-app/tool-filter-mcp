# Data Model: MCP Tool Filter Proxy

## Core Entities

### ProxyConfig
Configuration for the proxy instance.

**Fields**:
- `upstreamUrl`: string - URL of upstream MCP server (e.g., "http://localhost:3000")
- `denyPatterns`: string[] - Array of regex patterns for tools to filter
- `timeouts`: object
  - `connection`: number - Connection timeout in ms (default: 30000)
  - `toolList`: number - Tool list fetch timeout in ms (default: 10000)

**Validation Rules**:
- `upstreamUrl` must be valid HTTP/HTTPS URL
- `denyPatterns` must be valid regex strings (fail fast on invalid)
- `denyPatterns` must pass ReDoS safety check via safe-regex2
- `timeouts` must be positive integers

**State Transitions**: Immutable after initialization

### FilteredTool
Represents a tool from upstream MCP after filtering.

**Fields**:
- `name`: string - Tool identifier
- `description?`: string - Optional tool description
- `inputSchema`: object - JSON Schema for tool parameters

**Relationships**: Subset of upstream MCP's tool list

**Validation Rules**:
- Must conform to MCP tool schema
- `name` must not match any deny pattern
- `inputSchema` must be valid JSON Schema

**State Transitions**: Immutable after startup filtering

### UpstreamConnection
Manages connection to upstream MCP server.

**Fields**:
- `url`: string - Upstream server URL
- `connected`: boolean - Connection status
- `toolCache`: FilteredTool[] | null - Cached filtered tools
- `client`: MCPClient - SDK client instance

**Validation Rules**:
- `connected` transitions false→true on successful connection
- `toolCache` set once after successful tool list fetch
- `client` must not be null when connected=true

**State Transitions**:
1. Disconnected → Connecting (during startup)
2. Connecting → Connected (on successful connection)
3. Connected → Disconnected (on connection loss, triggers shutdown)

### RegexFilter
Encapsulates regex-based tool filtering logic.

**Fields**:
- `patterns`: RegExp[] - Compiled regex patterns
- `rawPatterns`: string[] - Original pattern strings (for error messages)

**Validation Rules**:
- All patterns must compile successfully
- All patterns must pass safe-regex2 safety check

**State Transitions**: Immutable after construction

## Value Objects

### ToolFilterResult
Result of applying filters to tool list.

**Fields**:
- `allowed`: FilteredTool[] - Tools that passed filter
- `denied`: string[] - Tool names that were filtered out
- `invalidPatterns`: string[] - Deny patterns that matched no tools (warnings)

**Validation Rules**: Arrays must be disjoint (no overlap between allowed names and denied names)

### ConnectionError
Structured error for upstream connection failures.

**Fields**:
- `code`: string - Error code ("TIMEOUT", "REFUSED", "INVALID_RESPONSE")
- `message`: string - Safe error message for client
- `internalDetails`: string - Detailed error for stderr logging

**Validation Rules**: `message` must not contain stack traces or internal paths

## Relationships

```
ProxyConfig
    ↓ configures
UpstreamConnection
    ↓ fetches
FilteredTool[]
    ↓ returned by
RegexFilter
```

## Data Flow

1. **Startup**:
   - Parse CLI args → ProxyConfig
   - Validate ProxyConfig (regex safety check)
   - Create UpstreamConnection with ProxyConfig.upstreamUrl
   - Fetch tools from upstream → raw tool list
   - Apply RegexFilter → FilteredTool[]
   - Cache FilteredTool[] in UpstreamConnection
   - Start MCP server with SSE transport

2. **Tool List Request**:
   - Client requests tools via MCP protocol
   - Proxy returns cached FilteredTool[]
   - No upstream communication (cached)

3. **Tool Call Request**:
   - Client calls tool via MCP protocol
   - Proxy checks tool name against FilteredTool[] cache
   - If denied: return "tool not found" error
   - If allowed: forward to upstream, return response

4. **Connection Loss**:
   - Upstream connection error detected
   - Log ConnectionError details to stderr
   - Shutdown proxy process immediately (exit code 1)

## Constraints

- Tool cache never updated after startup (no TTL, no refresh)
- Max 100+ tools supported (memory constraint: ~10MB)
- Regex patterns applied in O(n) time per tool (n = number of patterns)
- All entities immutable except UpstreamConnection.connected
