
# Implementation Plan: MCP Tool Filter Proxy

**Branch**: `001-mcp-tool-filter-proxy` | **Date**: 2025-10-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/Users/nek/Developer/Tools/tool-filter-mcp/specs/001-mcp-tool-filter-proxy/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from file system structure or context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Fill the Constitution Check section based on the content of the constitution document.
4. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, `GEMINI.md` for Gemini CLI, `QWEN.md` for Qwen Code or `AGENTS.md` for opencode).
7. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Build an MCP proxy server that wraps existing MCP servers and filters out unwanted tools via regex-based deny list. The proxy intercepts tool discovery at startup, caches the filtered tool set, and transparently forwards all other MCP protocol operations. Primary use case: reducing AI agent context by removing noisy tools while maintaining full compatibility with MCP ecosystem.

## Technical Context
**Language/Version**: TypeScript 5.x with strict mode enabled
**Primary Dependencies**: @modelcontextprotocol/sdk (official Anthropic SDK), Node.js 20+ LTS
**Storage**: N/A (stateless proxy, no persistent storage)
**Testing**: Vitest for unit and integration tests
**Target Platform**: Node.js cross-platform (Linux, macOS, Windows)
**Project Type**: single (CLI tool that acts as MCP server)
**Performance Goals**: <5ms overhead per tool call, <10MB memory footprint, <500ms startup time
**Constraints**: Minimal memory (<10MB), negligible latency overhead, fail-fast on errors, no reconnection logic
**Scale/Scope**: Single upstream MCP per proxy instance, support for 100+ tools filtered, designed for CLI tool simplicity

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Code Quality ✅ PASS
- TypeScript with strict mode enforces quality
- ESLint + Prettier ensure consistency
- Simple, focused architecture (single responsibility: filtering)

### II. Testability ✅ PASS
- Dependency injection for upstream MCP client
- Pure functions for regex matching and tool filtering
- Clear interfaces between proxy server, filter logic, and upstream client

### III. Reliability ✅ PASS
- All MCP protocol messages validated via SDK types
- Fail-fast on startup errors (bad regex, connection failure)
- Explicit error handling for connection loss (shutdown immediately)

### IV. Extensibility ✅ PASS
- Abstractions support future STDIO transport
- Configuration externalized (CLI args, future: config file)
- Filter logic separated from transport layer for future multi-MCP support

### V. Functional Programming ✅ PASS
- Immutable tool list after startup
- Pure filter functions (regex match, tool name validation)
- Minimal side effects (isolated to network I/O and startup)

### VI. Security ✅ PASS
- Regex validation with catastrophic backtracking detection
- MCP protocol schema validation via SDK
- No internal error exposure to clients (safe error messages)

**Initial Assessment**: PASS - No constitutional violations

## Project Structure

### Documentation (this feature)
```
specs/[###-feature]/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
src/
├── index.ts              # CLI entry point, argument parsing
├── server.ts             # MCP server setup (SSE transport)
├── proxy.ts              # Proxy orchestration logic
├── filter.ts             # Tool filtering with regex support
├── upstream-client.ts    # Upstream MCP connection management
├── types.ts              # Shared TypeScript types
└── utils/
    ├── regex-validator.ts    # Catastrophic backtracking detection
    └── error-handler.ts      # Safe error message formatting

tests/
├── unit/
│   ├── filter.test.ts
│   ├── regex-validator.test.ts
│   └── error-handler.test.ts
├── integration/
│   ├── proxy-startup.test.ts
│   ├── tool-filtering.test.ts
│   └── connection-loss.test.ts
└── fixtures/
    └── mock-mcp-server.ts    # Test upstream MCP

package.json
tsconfig.json
.eslintrc.json
.prettierrc
vitest.config.ts
```

**Structure Decision**: Single project structure selected. This is a focused CLI tool with clear separation of concerns: server setup, proxy logic, filtering, and upstream communication. Tests organized by scope (unit vs integration) with shared fixtures for mocking upstream MCPs.

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:
   ```
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate API contracts** from functional requirements:
   - For each user action → endpoint
   - Use standard REST/GraphQL patterns
   - Output OpenAPI/GraphQL schema to `/contracts/`

3. **Generate contract tests** from contracts:
   - One test file per endpoint
   - Assert request/response schemas
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - Each story → integration test scenario
   - Quickstart test = story validation steps

5. **Update agent file incrementally** (O(1) operation):
   - Run `.specify/scripts/bash/update-agent-context.sh claude`
     **IMPORTANT**: Execute it exactly as specified above. Do not add or remove any arguments.
   - If exists: Add only NEW tech from current plan
   - Preserve manual additions between markers
   - Update recent changes (keep last 3)
   - Keep under 150 lines for token efficiency
   - Output to repository root

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, agent-specific file

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Setup tasks: package.json, tsconfig, eslint, prettier, vitest
- Contract test tasks (fail first): MCP protocol compliance tests [P]
- Core implementation tasks: filter logic, regex validator, upstream client
- Integration test tasks: startup, filtering, connection loss [P]
- Quickstart validation task: execute quickstart scenarios

**Ordering Strategy**:
- Setup → Tests → Implementation (TDD)
- Independent modules marked [P] for parallel
- Dependencies: types → utils → core → server → CLI
- Test fixtures before tests that use them

**Estimated Output**: 20-25 numbered, ordered tasks in tasks.md

**Task Categories**:
1. Project Setup (5 tasks): package.json, TypeScript config, linting
2. Test Infrastructure (3 tasks): Vitest config, mock upstream, fixtures
3. Core Logic (8 tasks): filter, regex validation, error handling
4. Integration (5 tasks): upstream client, proxy, server, CLI
5. Testing & Validation (4 tasks): unit tests, integration tests, quickstart

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |


## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [x] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none)

**Artifacts Generated**:
- [x] research.md - Technology decisions and best practices
- [x] data-model.md - Core entities and data flow
- [x] contracts/mcp-proxy-contract.md - MCP protocol contract
- [x] quickstart.md - Usage scenarios and integration guide
- [x] CLAUDE.md - Agent-specific context file

---
*Based on Constitution v1.0.0 - See `.specify/memory/constitution.md`*
