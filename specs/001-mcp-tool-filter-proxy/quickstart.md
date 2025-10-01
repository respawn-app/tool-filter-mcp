# Quickstart: MCP Tool Filter Proxy

## Prerequisites
- Node.js 20+ installed
- Existing MCP server running (for testing)

## Installation

```bash
npm install
npm run build
```

## Basic Usage

### 1. Start Proxy with No Filtering (Allow All)

```bash
node dist/index.js --upstream http://localhost:3000
```

**Expected Behavior**:
- Proxy starts on default port (3001)
- Connects to upstream at http://localhost:3000
- Fetches and caches tool list
- All tools from upstream exposed to clients

**Verification**:
```bash
curl http://localhost:3001/tools/list
# Should return all upstream tools
```

### 2. Start Proxy with Simple Tool Filtering

```bash
node dist/index.js --upstream http://localhost:3000 --deny "file_read,file_write"
```

**Expected Behavior**:
- Proxy filters out tools named "file_read" and "file_write"
- All other tools exposed

**Verification**:
```bash
curl http://localhost:3001/tools/list | jq '.tools[].name'
# Should NOT include "file_read" or "file_write"
```

### 3. Start Proxy with Regex Filtering

```bash
node dist/index.js --upstream http://localhost:3000 --deny "^file_.*,.*_database$"
```

**Expected Behavior**:
- Filters tools starting with "file_"
- Filters tools ending with "_database"

**Verification**:
```bash
curl http://localhost:3001/tools/list | jq '.tools[].name' | grep file_
# Should return no results

curl http://localhost:3001/tools/list | jq '.tools[].name' | grep _database
# Should return no results
```

## Test Scenarios

### Scenario 1: Basic Filtering
**Given**: Upstream MCP with tools: ["read_file", "write_file", "list_dir", "get_env"]
**When**: Start proxy with `--deny ".*_file$"`
**Then**: Proxy exposes: ["list_dir", "get_env"]

**Test**:
```bash
# Start mock upstream (from test fixtures)
npm run test:mock-upstream &

# Start proxy
node dist/index.js --upstream http://localhost:3000 --deny ".*_file$"

# Verify tool list
curl http://localhost:3001/tools/list | jq '.tools[].name' | sort
# Expected output:
# "get_env"
# "list_dir"

# Test allowed tool call
curl -X POST http://localhost:3001/tools/call \
  -H "Content-Type: application/json" \
  -d '{"name": "list_dir", "arguments": {}}'
# Should succeed and return result

# Test denied tool call
curl -X POST http://localhost:3001/tools/call \
  -H "Content-Type: application/json" \
  -d '{"name": "read_file", "arguments": {}}'
# Should return error: "Tool not found: read_file"
```

### Scenario 2: Multiple Proxy Instances

**Test**:
```bash
# Start first proxy (filter file tools)
node dist/index.js --upstream http://localhost:3000 --deny "^file_" --port 3001 &

# Start second proxy (filter database tools)
node dist/index.js --upstream http://localhost:3000 --deny "database" --port 3002 &

# Verify independent filtering
curl http://localhost:3001/tools/list | jq '.tools[].name' | grep file_
# No results (file tools filtered)

curl http://localhost:3002/tools/list | jq '.tools[].name' | grep database
# No results (database tools filtered)
```

### Scenario 3: Invalid Regex Handling

**Test**:
```bash
# Start proxy with invalid regex
node dist/index.js --upstream http://localhost:3000 --deny "^[a-z"
# Expected: Exit with error message
# "Error: Invalid regex pattern in deny list: ^[a-z"
# "Pattern must be valid JavaScript regex"
# Exit code: 1
```

### Scenario 4: ReDoS Detection

**Test**:
```bash
# Start proxy with unsafe regex
node dist/index.js --upstream http://localhost:3000 --deny "(a+)+"
# Expected: Exit with error message
# "Error: Unsafe regex pattern detected: (a+)+"
# "Pattern could cause catastrophic backtracking"
# Exit code: 1
```

### Scenario 5: Upstream Connection Failure

**Test**:
```bash
# Start proxy with non-existent upstream
node dist/index.js --upstream http://localhost:9999
# Expected: Exit with error message
# "Error: Failed to connect to upstream MCP at http://localhost:9999"
# "Connection timeout after 30000ms"
# Exit code: 1
```

### Scenario 6: Empty Deny List

**Test**:
```bash
# Start proxy with no deny arg
node dist/index.js --upstream http://localhost:3000

# Verify all tools exposed
curl http://localhost:3001/tools/list | jq '.tools | length'
# Should equal upstream tool count
```

### Scenario 7: Filter All Tools

**Test**:
```bash
# Start proxy filtering all tools
node dist/index.js --upstream http://localhost:3000 --deny ".*"

# Verify empty tool list
curl http://localhost:3001/tools/list | jq '.tools'
# Expected: []
```

## Integration with Claude Code

### 1. Add to MCP Settings

Edit `~/.claude/mcp_settings.json`:

```json
{
  "mcpServers": {
    "filtered-filesystem": {
      "command": "node",
      "args": [
        "/path/to/tool-filter-mcp/dist/index.js",
        "--upstream",
        "http://localhost:3000",
        "--deny",
        "^file_write,^rm_"
      ]
    }
  }
}
```

### 2. Restart Claude Code

Claude Code will now connect to filtered proxy instead of direct upstream MCP.

### 3. Verify Filtering

Check Claude Code's tool list:
- Filtered tools should not appear in available tools
- Attempts to use filtered tools should fail gracefully

## Performance Validation

### Latency Test

```bash
# Measure tool list response time (should be < 1ms)
time curl -s http://localhost:3001/tools/list > /dev/null

# Measure allowed tool call overhead
# Direct upstream call:
time curl -s -X POST http://localhost:3000/tools/call -H "Content-Type: application/json" -d '{"name":"allowed_tool","arguments":{}}' > /dev/null

# Via proxy:
time curl -s -X POST http://localhost:3001/tools/call -H "Content-Type: application/json" -d '{"name":"allowed_tool","arguments":{}}' > /dev/null

# Overhead should be < 5ms
```

### Memory Test

```bash
# Start proxy
node dist/index.js --upstream http://localhost:3000 --deny "test" &

# Check memory usage
ps aux | grep "node dist/index.js" | awk '{print $6}'
# Should be < 10000 KB (10MB)
```

## Troubleshooting

### Proxy Won't Start

1. Check upstream MCP is running: `curl http://localhost:3000/health`
2. Verify Node.js version: `node --version` (should be 20+)
3. Check for port conflicts: `lsof -i :3001`

### Tools Not Filtered

1. Verify regex pattern syntax: Test in regex tester
2. Check tool names match exactly: Compare with `curl http://localhost:3000/tools/list`
3. Ensure patterns are quoted in shell: `--deny "pattern"` not `--deny pattern`

### Connection Drops

1. Check upstream MCP logs for errors
2. Verify network stability
3. Proxy should exit automatically on connection loss (expected behavior)

## Next Steps

- See `contracts/mcp-proxy-contract.md` for full protocol specification
- See `data-model.md` for internal architecture
- Run full test suite: `npm test`
