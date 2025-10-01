<!--
SYNC IMPACT REPORT
==================
Version Change: INITIAL → 1.0.0
Modified Principles: N/A (initial constitution)
Added Sections: Core Principles, Technology Stack, Security Requirements, Governance
Removed Sections: N/A

Templates Requiring Updates:
✅ plan-template.md - Constitution Check section references validated
✅ spec-template.md - No dependencies identified
✅ tasks-template.md - No dependencies identified
✅ agent-file-template.md - No dependencies identified

Follow-up TODOs: None
-->

# Tool Filter MCP Constitution

## Core Principles

### I. Code Quality
All code MUST adhere to modern TypeScript best practices and produce elegant, readable solutions. Code reviews MUST verify adherence to established patterns and idioms. Complexity MUST be justified; prefer simple, clear implementations over clever ones.

**Rationale**: Quality code reduces bugs, improves maintainability, and enables confident refactoring.

### II. Testability
Code MUST be structured to enable easy testing through dependency injection, pure functions, and clear interfaces. Tests are written as needed to validate functionality, not mandatorily upfront. Every module MUST be independently testable.

**Rationale**: Testable code enforces good architecture while allowing pragmatic test creation based on actual needs.

### III. Reliability
The MCP proxy MUST handle all error conditions gracefully without crashing. All MCP protocol interactions MUST be validated. Edge cases in tool filtering MUST be explicitly handled with clear error messages.

**Rationale**: As a proxy, reliability is non-negotiable; failures cascade to dependent systems.

### IV. Extensibility
Architecture MUST support future enhancements without requiring rewrites. Use abstractions where variation is expected. Configuration MUST be externalized. Avoid hardcoding assumptions about tool structures or MCP implementations.

**Rationale**: MCP ecosystem evolves; the filter must adapt to protocol changes and new filtering requirements.

### V. Functional Programming
Prefer immutable data structures and pure functions. Minimize side effects; isolate them in clearly marked boundaries. Use functional patterns (map, filter, reduce) over imperative loops where clarity improves.

**Rationale**: Immutability eliminates entire classes of bugs and makes concurrent operations safer.

### VI. Security
All MCP protocol messages MUST be validated against expected schemas. Tool filter configurations MUST be sanitized to prevent injection attacks. Never expose internal errors to MCP clients; log details, return safe messages.

**Rationale**: Proxy position makes this a potential attack vector; strict validation is essential.

## Technology Stack

**Language**: TypeScript 5.x with strict mode enabled
**Runtime**: Node.js 20+ LTS
**MCP SDK**: @modelcontextprotocol/sdk (official Anthropic SDK)
**Testing**: Vitest (when tests are needed)
**Package Manager**: npm

**Tooling Requirements**:
- ESLint with TypeScript rules for code quality
- Prettier for consistent formatting
- Type checking MUST pass with zero errors before commits

## Security Requirements

1. **Input Validation**: All MCP messages MUST be validated against protocol schema before processing
2. **Configuration Safety**: Tool filter patterns MUST be sanitized; reject regex patterns with catastrophic backtracking potential
3. **Error Handling**: Internal stack traces MUST NOT leak to MCP clients; use structured error codes
4. **Dependency Auditing**: Run `npm audit` before releases; no high/critical vulnerabilities allowed
5. **Principle of Least Privilege**: Proxy operates with minimal permissions; no filesystem access beyond configuration

## Governance

This constitution supersedes all other development practices. All implementation plans MUST pass the Constitution Check gate before Phase 0 research begins, and again after Phase 1 design.

**Amendment Process**:
- Proposed changes MUST document rationale and impact on existing code
- Version MUST increment per semantic versioning (MAJOR for breaking principle changes, MINOR for additions, PATCH for clarifications)
- Templates (plan, spec, tasks) MUST be updated to reflect amended principles

**Compliance**:
- All pull requests MUST verify no constitutional violations
- Complexity that violates principles MUST be justified in plan.md Complexity Tracking section
- Agent-specific guidance files (CLAUDE.md, etc.) provide runtime development patterns aligned with these principles

**Version**: 1.0.0 | **Ratified**: 2025-10-01 | **Last Amended**: 2025-10-01
