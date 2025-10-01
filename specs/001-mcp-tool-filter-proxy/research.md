# Research: MCP Tool Filter Proxy

## Research Questions

### 1. MCP Protocol & SDK

**Decision**: Use @modelcontextprotocol/sdk for SSE transport

**Rationale**:
- Official SDK from Anthropic provides type-safe MCP protocol implementation
- Built-in SSE transport support via `SSEServerTransport`
- Handles protocol versioning and message validation automatically
- Active maintenance and community support

**Alternatives Considered**:
- Raw EventSource + manual protocol implementation: Rejected (high complexity, error-prone)
- Custom SSE library: Rejected (reinventing wheel, SDK already optimized)

**Key Findings**:
- SDK provides `Server` class for hosting MCP servers
- `listTools()` handler returns tool list to clients
- `callTool()` handler processes tool invocations
- Client classes available for connecting to upstream MCPs

### 2. Upstream Timeout Standards

**Decision**: 30 seconds for initial connection, 10 seconds for tool list fetch

**Rationale**:
- Standard HTTP timeout practices: 30s for TCP connection establishment
- Tool list fetch is lightweight operation (JSON response), 10s generous but prevents hangs
- MCP servers typically respond in <1s, but network issues need buffer

**Alternatives Considered**:
- 5s timeout: Rejected (too aggressive for poor network conditions)
- 60s timeout: Rejected (too permissive, delays error detection)
- No timeout: Rejected (violates fail-fast requirement)

**Key Findings**:
- Node.js `fetch` API supports `signal: AbortSignal` for timeouts
- Use `AbortController` with `setTimeout` for custom timeout logic

### 3. Catastrophic Backtracking Detection

**Decision**: Use `safe-regex2` npm package for ReDoS detection

**Rationale**:
- Proven library specifically designed for ReDoS vulnerability detection
- Fast analysis (< 1ms per regex)
- No false positives reported in production use
- Used by ESLint and other security-focused tools

**Alternatives Considered**:
- Manual backtracking analysis: Rejected (complex, error-prone)
- `safe-regex` (v1): Rejected (outdated, safe-regex2 is maintained successor)
- Runtime timeout on regex match: Rejected (degrades performance, doesn't prevent DoS)

**Key Findings**:
- `safe-regex2` returns boolean indicating safety
- Reject regex patterns that fail safety check at startup
- Provide clear error message with rejected pattern

### 4. SSE Transport Best Practices

**Decision**: Use MCP SDK's built-in `SSEServerTransport` with default settings

**Rationale**:
- SDK handles SSE framing, heartbeats, and connection management
- Automatic reconnection detection (client responsibility)
- No custom SSE logic needed

**Alternatives Considered**:
- Custom SSE implementation: Rejected (complex, SDK already handles it)
- WebSocket transport: Rejected (SSE is requirement, WebSocket not in MVP scope)

**Key Findings**:
- SSE transport requires HTTP server (use Node.js `http` module)
- SDK provides `SSEServerTransport` constructor accepting request/response objects
- Transport handles message serialization/deserialization

### 5. Regex Pattern Format

**Decision**: Support comma-separated regex patterns in `--deny` argument

**Rationale**:
- Simple CLI syntax: `--deny "^file_,.*_write$"`
- Each pattern tested independently against tool names
- Logical OR behavior (match any pattern = filtered)

**Alternatives Considered**:
- Multiple `--deny` flags: Rejected (verbose, less intuitive)
- JSON array in CLI arg: Rejected (escaping issues, poor UX)
- Config file only: Rejected (adds setup complexity)

**Key Findings**:
- Split on comma, trim whitespace
- Validate each pattern independently
- Compile patterns once at startup (cache RegExp objects)

### 6. Tool Caching Strategy

**Decision**: Fetch and cache tool list once at startup, never refresh

**Rationale**:
- Clarification confirmed MCPs don't change tools at runtime
- Eliminates polling/refresh overhead
- Simplifies architecture (no cache invalidation logic)
- User restarts proxy if upstream MCP restarts

**Alternatives Considered**:
- Periodic refresh: Rejected (unnecessary complexity, per clarifications)
- On-demand refresh API: Rejected (adds attack surface, not in requirements)

**Key Findings**:
- Fetch tools via upstream client during proxy initialization
- Store filtered tools in immutable array
- Return cached array for all `listTools()` requests

### 7. Connection Loss Handling

**Decision**: Detect connection loss via error events, shutdown immediately

**Rationale**:
- Clarification specified fail-fast behavior (no reconnection)
- Clean shutdown prevents zombie proxy serving stale data
- Simple implementation (exit process with error code)

**Alternatives Considered**:
- Graceful degradation: Rejected (contradicts fail-fast requirement)
- Reconnection with backoff: Rejected (per clarifications)

**Key Findings**:
- Monitor upstream client `error` and `close` events
- Log clear error message to stderr
- Call `process.exit(1)` to terminate proxy

### 8. Error Message Safety

**Decision**: Map internal errors to generic MCP error codes, log details to stderr

**Rationale**:
- Prevents information leakage to clients
- MCP protocol supports structured error responses
- Detailed logs available for debugging via stderr

**Alternatives Considered**:
- Expose full stack traces: Rejected (security risk)
- Silent failures: Rejected (poor debuggability)

**Key Findings**:
- Use MCP SDK error types (e.g., `McpError`)
- Log internal error details to stderr with timestamp
- Return generic error message to client (e.g., "Tool not available")

## Summary

All research questions resolved. Key technologies: @modelcontextprotocol/sdk for MCP protocol, safe-regex2 for ReDoS protection, Node.js built-in modules for HTTP/networking. Architecture validated: startup-time tool caching, fail-fast error handling, immutable filtered tool list.
