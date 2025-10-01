# MCP Proxy Contract

## Overview
The MCP Tool Filter Proxy implements the MCP protocol as both a server (for downstream clients) and client (for upstream MCP servers). This contract defines the behavior at both interfaces.

## Downstream Interface (Proxy → Client)

### 1. tools/list Request

**Request** (from client):
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
```

**Response** (from proxy):
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "allowed_tool_1",
        "description": "Description of tool 1",
        "inputSchema": {
          "type": "object",
          "properties": {...}
        }
      },
      {
        "name": "allowed_tool_2",
        "description": "Description of tool 2",
        "inputSchema": {
          "type": "object",
          "properties": {...}
        }
      }
    ]
  }
}
```

**Contract**:
- Proxy MUST return only tools that passed deny list filter
- Response MUST NOT include any tools matching deny patterns
- Tool order preserved from upstream
- Response cached from startup (no upstream call)

### 2. tools/call Request - Allowed Tool

**Request** (from client):
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "allowed_tool_1",
    "arguments": {
      "arg1": "value1"
    }
  }
}
```

**Response** (from proxy):
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Tool execution result"
      }
    ]
  }
}
```

**Contract**:
- Proxy MUST forward request to upstream MCP
- Proxy MUST return upstream response unmodified
- Proxy MUST preserve request/response timing characteristics

### 3. tools/call Request - Denied Tool

**Request** (from client):
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "denied_tool",
    "arguments": {}
  }
}
```

**Response** (from proxy):
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "error": {
    "code": -32601,
    "message": "Tool not found: denied_tool"
  }
}
```

**Contract**:
- Proxy MUST reject without forwarding to upstream
- Error code -32601 (Method not found per JSON-RPC 2.0)
- Message format: "Tool not found: {tool_name}"
- Response MUST NOT reveal filtering details

### 4. Other MCP Methods

**Supported Methods**:
- `resources/list` - Forwarded transparently
- `resources/read` - Forwarded transparently
- `prompts/list` - Forwarded transparently
- `prompts/get` - Forwarded transparently
- `sampling/createMessage` - Forwarded transparently

**Contract**:
- Proxy MUST forward all non-tool methods to upstream unmodified
- Proxy MUST return upstream response unmodified
- No filtering applied to resources, prompts, or sampling

## Upstream Interface (Proxy → Upstream MCP)

### 1. tools/list Fetch (Startup Only)

**Request** (from proxy):
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
```

**Expected Response**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [...]
  }
}
```

**Contract**:
- Proxy MUST fetch tool list during startup
- Timeout: 10 seconds (fail startup if exceeded)
- On error: log details, exit with code 1
- Response cached for entire proxy lifetime

### 2. tools/call Forward

**Contract**:
- Proxy MUST forward only if tool in allowed list
- Request passed through unmodified
- Response passed through unmodified
- Errors propagated to client

### 3. Connection Monitoring

**Contract**:
- Proxy MUST detect upstream connection loss
- On connection error: log to stderr, exit immediately with code 1
- No reconnection attempts
- No graceful degradation

## Error Handling

### Startup Errors

**Invalid Regex Pattern**:
```
Error: Invalid regex pattern in deny list: "^[a-z"
Pattern must be valid JavaScript regex
```
Exit code: 1

**ReDoS Detection**:
```
Error: Unsafe regex pattern detected: "(a+)+"
Pattern could cause catastrophic backtracking
```
Exit code: 1

**Upstream Connection Failure**:
```
Error: Failed to connect to upstream MCP at http://localhost:3000
Connection timeout after 30000ms
```
Exit code: 1

**Tool List Fetch Failure**:
```
Error: Failed to fetch tool list from upstream MCP
Request timeout after 10000ms
```
Exit code: 1

### Runtime Errors

**Connection Loss**:
```stderr
Error: Lost connection to upstream MCP
Shutting down proxy
```
Exit code: 1

**Invalid Tool Call**:
```json
{
  "jsonrpc": "2.0",
  "id": 123,
  "error": {
    "code": -32601,
    "message": "Tool not found: denied_tool"
  }
}
```

## Performance Requirements

- Tool list request: < 1ms (cached response)
- Allowed tool call: < 5ms overhead vs direct upstream call
- Denied tool call: < 1ms (no upstream communication)
- Startup time: < 500ms
- Memory footprint: < 10MB

## Security Requirements

- Regex patterns validated with safe-regex2
- No internal error details exposed to clients
- Upstream responses validated against MCP schema
- Tool names sanitized in error messages (no code injection)
