# Tasks: MCP Tool Filter Proxy

**Input**: Design documents from `/Users/nek/Developer/Tools/tool-filter-mcp/specs/001-mcp-tool-filter-proxy/`
**Prerequisites**: plan.md, research.md, data-model.md, contracts/, quickstart.md

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Single project**: `src/`, `tests/` at repository root
- Paths shown below use absolute paths from repository root

## Phase 3.1: Setup

- [x] T001 Create package.json with TypeScript, MCP SDK, Vitest, ESLint, Prettier dependencies
- [x] T002 Create tsconfig.json with strict mode, Node.js 20+ target, ESM module
- [x] T003 [P] Create .eslintrc.json with TypeScript rules and code quality standards
- [x] T004 [P] Create .prettierrc with consistent formatting rules
- [x] T005 Create vitest.config.ts for unit and integration test configuration
- [x] T006 Create .gitignore with node_modules, dist, coverage directories

## Phase 3.2: Types & Utilities (No Dependencies)

- [x] T007 [P] Create src/types.ts with ProxyConfig, FilteredTool, ToolFilterResult, ConnectionError interfaces
- [x] T008 [P] Create src/utils/regex-validator.ts implementing safe-regex2 ReDoS detection
- [x] T009 [P] Create src/utils/error-handler.ts for safe error message formatting (no stack traces)
- [x] T010 [P] Create tests/unit/regex-validator.test.ts with valid/invalid/unsafe regex test cases
- [x] T011 [P] Create tests/unit/error-handler.test.ts verifying no internal details leak

## Phase 3.3: Core Logic

- [x] T012 Create src/filter.ts implementing RegexFilter class with pattern compilation and tool matching
- [x] T013 Create tests/unit/filter.test.ts with filtering scenarios from quickstart (allow all, deny patterns, regex matching)
- [x] T014 Implement applyFilters() function in src/filter.ts returning ToolFilterResult with allowed/denied/invalidPatterns

## Phase 3.4: Test Infrastructure

- [x] T015 Create tests/fixtures/mock-mcp-server.ts providing test MCP server with configurable tool list
- [x] T016 [P] Create tests/fixtures/sample-tools.ts with test tool definitions (read_file, write_file, list_dir, get_env)

## Phase 3.5: Upstream Client

- [ ] T017 Create src/upstream-client.ts implementing UpstreamConnection class with MCP SDK client
- [ ] T018 Implement connect() method in src/upstream-client.ts with 30s timeout
- [ ] T019 Implement fetchTools() method in src/upstream-client.ts with 10s timeout
- [ ] T020 Implement connection loss monitoring in src/upstream-client.ts (exit on error)
- [ ] T021 Create tests/integration/upstream-client.test.ts with connection success/timeout/loss scenarios

## Phase 3.6: Proxy Orchestration

- [ ] T022 Create src/proxy.ts implementing main proxy orchestration logic
- [ ] T023 Implement startup sequence in src/proxy.ts: parse config → connect → fetch tools → filter → cache
- [ ] T024 Implement getCachedTools() method in src/proxy.ts returning immutable filtered tool list
- [ ] T025 Implement isToolAllowed(name: string) method in src/proxy.ts checking against cache
- [ ] T026 Create tests/integration/proxy-startup.test.ts verifying startup sequence and error handling

## Phase 3.7: MCP Server

- [ ] T027 Create src/server.ts implementing MCP Server with SSEServerTransport from SDK
- [ ] T028 Implement listTools() handler in src/server.ts returning cached filtered tools
- [ ] T029 Implement callTool() handler in src/server.ts: check allowed → forward to upstream or reject
- [ ] T030 Implement passthrough handlers in src/server.ts for resources, prompts, sampling (forward unmodified)
- [ ] T031 Create tests/integration/tool-filtering.test.ts with scenarios from quickstart (basic filtering, denied tool call)

## Phase 3.8: CLI Entry Point

- [ ] T032 Create src/index.ts with CLI argument parsing using Node.js built-in parseArgs or minimist
- [ ] T033 Implement --upstream and --deny argument validation in src/index.ts
- [ ] T034 Implement startup error handling in src/index.ts (invalid regex, connection failure, exit code 1)
- [ ] T035 Wire up proxy + server in src/index.ts and start HTTP server for SSE transport

## Phase 3.9: Integration Testing

- [ ] T036 [P] Create tests/integration/connection-loss.test.ts verifying proxy exits on upstream disconnect
- [ ] T037 [P] Create tests/integration/multiple-instances.test.ts verifying independent proxy instances with different deny lists
- [ ] T038 [P] Create tests/integration/regex-errors.test.ts verifying invalid regex and ReDoS detection at startup
- [ ] T039 Create tests/integration/empty-deny-list.test.ts verifying all tools exposed when no deny patterns
- [ ] T040 Create tests/integration/filter-all-tools.test.ts verifying empty tool list when all tools filtered

## Phase 3.10: Build & Validation

- [ ] T041 Add build script to package.json: tsc --build
- [ ] T042 Add test script to package.json: vitest
- [ ] T043 Add lint script to package.json: eslint src tests
- [ ] T044 Run npm run build and verify dist/ output
- [ ] T045 Run npm test and verify all tests pass
- [ ] T046 Run npm run lint and fix any violations
- [ ] T047 Execute quickstart Scenario 1 (Basic Filtering) end-to-end
- [ ] T048 Execute quickstart Scenario 3 (Invalid Regex Handling) end-to-end
- [ ] T049 Execute quickstart Scenario 4 (ReDoS Detection) end-to-end

## Dependencies

**Critical Paths**:
- Types (T007) before all implementation tasks
- Utils (T008-T009) before filter (T012), upstream-client (T017), CLI (T032)
- Filter (T012-T014) before proxy (T022)
- Upstream client (T017-T020) before proxy (T022)
- Proxy (T022-T025) before server (T027)
- Server (T027-T030) before CLI (T032)
- All implementation before integration tests (T036-T040)
- Build (T041-T044) before quickstart validation (T047-T049)

**Parallel Opportunities**:
- T003, T004 (config files)
- T007, T008, T009 (independent modules)
- T010, T011 (independent unit tests)
- T015, T016 (test fixtures)
- T036, T037, T038 (integration tests after implementation)

## Parallel Execution Examples

### Batch 1: Setup Configuration Files
```bash
# Launch T003 and T004 together (different files, no dependencies)
Task: "Create .eslintrc.json with TypeScript rules and code quality standards"
Task: "Create .prettierrc with consistent formatting rules"
```

### Batch 2: Types & Utilities
```bash
# Launch T007, T008, T009 together (independent modules)
Task: "Create src/types.ts with ProxyConfig, FilteredTool, ToolFilterResult, ConnectionError interfaces"
Task: "Create src/utils/regex-validator.ts implementing safe-regex2 ReDoS detection"
Task: "Create src/utils/error-handler.ts for safe error message formatting (no stack traces)"
```

### Batch 3: Unit Tests for Utilities
```bash
# Launch T010 and T011 together (different test files)
Task: "Create tests/unit/regex-validator.test.ts with valid/invalid/unsafe regex test cases"
Task: "Create tests/unit/error-handler.test.ts verifying no internal details leak"
```

### Batch 4: Test Fixtures
```bash
# Launch T015 and T016 together (independent fixture files)
Task: "Create tests/fixtures/mock-mcp-server.ts providing test MCP server with configurable tool list"
Task: "Create tests/fixtures/sample-tools.ts with test tool definitions (read_file, write_file, list_dir, get_env)"
```

### Batch 5: Integration Tests
```bash
# Launch T036, T037, T038 together (different integration test files)
Task: "Create tests/integration/connection-loss.test.ts verifying proxy exits on upstream disconnect"
Task: "Create tests/integration/multiple-instances.test.ts verifying independent proxy instances with different deny lists"
Task: "Create tests/integration/regex-errors.test.ts verifying invalid regex and ReDoS detection at startup"
```

## Notes

- All tasks use TDD approach: tests before implementation where applicable
- Tests MUST fail before implementation (verify contract compliance)
- Paths are absolute from repository root
- [P] tasks have no shared file conflicts
- Verify tests fail before implementing (T010-T011, T013, T021, T026, T031, T036-T040)
- Integration tests require mock upstream server (T015) completed first
- Quickstart validation (T047-T049) requires full build (T044) and passing tests (T045)

## Validation Checklist

- [ ] All contract scenarios from contracts/mcp-proxy-contract.md covered by tests
- [ ] All entities from data-model.md have corresponding implementation files
- [ ] All quickstart scenarios executable end-to-end
- [ ] Parallel tasks truly independent (no shared file writes)
- [ ] Each task specifies exact file path
- [ ] Build produces executable dist/index.js
- [ ] All tests pass (unit + integration)
- [ ] Performance goals met (<5ms overhead, <10MB memory, <500ms startup)
