# Feature Specification: MCP Tool Filter Proxy

**Feature Branch**: `001-mcp-tool-filter-proxy`
**Created**: 2025-10-01
**Status**: Draft
**Input**: User description: "this is going to be MCP with a single purpose to filter out unwanted tools from another MCP. This MCP should support running in multiple instances. For example, ideally we want this to be an MCP that wraps another MCP so that it is easily configurable in the coding tools such as Claude. And we want to be able to easily list the tools that we are going to exclude without the need for some complicated extra configuration so that the user has to do minimal work to support that. That's a product requirement. It should be easy to set up and use. Second product requirement is to support two protocols, SSE and STDIO. The user must be able to use both types of communication protocols with our MCP and still get all of the features. But SSE should be the first one to be implemented. It's a priority because it's the one that we currently have explicit need for. And if needed, there is a proxy that can change the protocol that we use. So it's not a strict requirement to support both, but we should start with SSE if possible. Third product requirement for this. This MCP should completely remove tools that the user specifies from the context. They should not appear in the AI agent context. They should not be appear as usable. They should not be callable even if somehow the user or the agent are able to circumvent the filtering. They should not add a single token to the context of the model. In all major tools that support MCP, when inspected, the only tools that should appear are the allowed tools, i.e. not listed in the deny list. By default, all tools will be allowed and the user must specify the tools that they want to deny. No other interference with the communication should happen. No interference with the way tools are being called. No interference with the stack, with the parameters, nothing. The tools should be filtered as early as possible, ideally when the MCP is booted up, not via some interception technology that happens on every call of the tool, so that we do not impact the performance of whoever is using this MCP. Ideally, we also don't want to load huge amounts of data into the memory so that this MCP is as lean as possible. Next. As an optional feature, we should probably allow multi-MCP support, i.e. you use this one MCP and then it lists a bunch of tools that are an aggregation from some other MCPs. But this is not for the first implementation of this, not for the MVP. It's just a feature consideration that should be considered when designing the architecture of the solution. This project must be easily maintainable because it's a white-coded open source project. There should not be any complicated setup or proprietary code used that will impact the ability for us to just simply publish this project on GitHub."

## Clarifications

### Session 2025-10-01
- Q: Should proxy dynamically update tool list or cache at startup? → A: Cache at startup; MCPs typically don't change toollist unless restarted
- Q: Should there be a timeout for upstream communication? → A: Yes, research standard timeout values during planning
- Q: Is STDIO a must-have for MVP or deferred? → A: Deferred; not required for MVP
- Q: How should the deny list be specified? → A: Command-line arguments (e.g., --deny tool_a,tool_b)
- Q: How should user specify upstream MCP server? → A: URL/endpoint for SSE (e.g., --upstream http://localhost:3000); command to spawn for STDIO (future)
- Q: What if proxy loses connection to upstream during operation? → A: Fail fast: shut down proxy immediately with error
- Q: Should deny list support pattern matching or exact matches? → A: Full regex support (e.g., --deny "^file_.*$")

## Execution Flow (main)
```
1. Parse user description from Input
   → If empty: ERROR "No feature description provided"
2. Extract key concepts from description
   → Identify: actors, actions, data, constraints
3. For each unclear aspect:
   → Mark with [NEEDS CLARIFICATION: specific question]
4. Fill User Scenarios & Testing section
   → If no clear user flow: ERROR "Cannot determine user scenarios"
5. Generate Functional Requirements
   → Each requirement must be testable
   → Mark ambiguous requirements
6. Identify Key Entities (if data involved)
7. Run Review Checklist
   → If any [NEEDS CLARIFICATION]: WARN "Spec has uncertainties"
   → If implementation details found: ERROR "Remove tech details"
8. Return: SUCCESS (spec ready for planning)
```

---

## ⚡ Quick Guidelines
- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers

### Section Requirements
- **Mandatory sections**: Must be completed for every feature
- **Optional sections**: Include only when relevant to the feature
- When a section doesn't apply, remove it entirely (don't leave as "N/A")

### For AI Generation
When creating this spec from a user prompt:
1. **Mark all ambiguities**: Use [NEEDS CLARIFICATION: specific question] for any assumption you'd need to make
2. **Don't guess**: If the prompt doesn't specify something (e.g., "login system" without auth method), mark it
3. **Think like a tester**: Every vague requirement should fail the "testable and unambiguous" checklist item
4. **Common underspecified areas**:
   - User types and permissions
   - Data retention/deletion policies
   - Performance targets and scale
   - Error handling behaviors
   - Integration requirements
   - Security/compliance needs

---

## User Scenarios & Testing

### Primary User Story
A developer wants to use an existing MCP server but finds that some tools add unnecessary noise to their AI agent's context. They configure the MCP Tool Filter Proxy to wrap the original MCP server and specify which tools to exclude via a simple deny list. The AI agent now only sees the allowed tools, reducing context size and improving response quality. The developer can run multiple filtered instances of the same upstream MCP with different deny lists for different use cases.

### Acceptance Scenarios
1. **Given** an MCP server exposing 20 tools, **When** the user configures the proxy with a deny list of 5 tool names, **Then** the AI agent receives only 15 tools in the tools list response
2. **Given** the proxy is running with SSE protocol, **When** the AI agent requests the tools list, **Then** the filtered tools are returned via SSE without modification to other protocol aspects
3. **Given** a deny list containing "tool_a" and "tool_b", **When** the AI agent attempts to call "tool_a", **Then** the proxy rejects the call as if the tool doesn't exist
4. **Given** multiple proxy instances wrapping the same upstream MCP, **When** each instance has a different deny list, **Then** each instance independently filters tools according to its own configuration
5. **Given** an empty deny list, **When** the proxy starts, **Then** all upstream tools are exposed without filtering
6. **Given** the proxy configuration, **When** the user specifies tool patterns to deny via command-line arguments, **Then** configuration supports regex patterns (e.g., `--deny "^file_.*$,.*_database$"`)

### Edge Cases
- What happens when a denied tool pattern doesn't match any upstream tools? (System MUST ignore invalid deny list entries without errors)
- What happens when the deny list contains all tools from the upstream MCP? (System MUST return an empty tools list)
- What happens when the upstream MCP connection fails during proxy startup? (System MUST fail fast with clear error message)
- What happens when the upstream MCP adds new tools after proxy startup? (System MUST NOT detect changes; tool list is cached at startup and remains static until proxy restart)
- What happens when the AI agent calls a tool that was denied? (System MUST return "tool not found" error, never forward the call)
- What happens when the upstream MCP is slow to respond to tool list requests? (System MUST timeout after standard duration; specific value to be researched during planning)
- What happens when proxy loses connection to upstream MCP during operation? (System MUST shut down immediately with error; no reconnection attempts)
- What happens when an invalid regex pattern is provided in deny list? (System MUST fail fast at startup with clear validation error)
- What happens when a regex pattern could cause catastrophic backtracking? (System MUST detect and reject dangerous patterns at startup)

## Requirements

### Functional Requirements
- **FR-001**: System MUST wrap an existing MCP server and act as a transparent proxy for all non-filtered operations
- **FR-002**: System MUST support SSE (Server-Sent Events) transport protocol as the primary implementation
- **FR-003**: System MUST accept upstream MCP server URL via command-line argument (e.g., `--upstream http://localhost:3000`)
- **FR-004**: System MUST accept deny list via command-line arguments supporting regex patterns (e.g., `--deny "^file_.*$,.*_database$"`)
- **FR-005**: System MUST filter tools at proxy initialization/startup time, not per-request
- **FR-006**: System MUST completely remove denied tools from the tools list response
- **FR-007**: System MUST reject calls to denied tools with "tool not found" semantics
- **FR-008**: System MUST NOT modify any other aspect of MCP communication (resources, prompts, sampling, non-denied tool calls)
- **FR-009**: System MUST support running multiple independent proxy instances simultaneously
- **FR-010**: System MUST use minimal memory footprint
- **FR-011**: System MUST NOT introduce measurable performance overhead for allowed tool calls
- **FR-012**: System MUST expose only allowed tools when inspected by MCP-compatible clients
- **FR-013**: Default behavior MUST allow all tools (deny list is opt-in)
- **FR-014**: System MUST be easily configurable within AI coding tools like Claude Code
- **FR-015**: System MUST be publishable as open-source with no proprietary dependencies
- **FR-016**: STDIO transport protocol support is deferred post-MVP; SSE is sufficient for initial release
- **FR-017**: Architecture MUST accommodate future multi-MCP aggregation support without significant refactoring
- **FR-018**: Future STDIO support MUST accept upstream via command to spawn process (e.g., `--upstream-cmd "node mcp-server.js"`)
- **FR-019**: System MUST shut down immediately with clear error if upstream connection is lost during operation (no reconnection attempts)

### Performance Requirements
- **PR-001**: Tool filtering MUST occur at startup, not on every tool call
- **PR-002**: Proxy MUST NOT cache large amounts of data in memory beyond necessary tool metadata
- **PR-003**: Allowed tool calls MUST have negligible latency overhead compared to direct upstream calls
- **PR-004**: Upstream communication MUST timeout after standard duration to prevent hanging (specific value to be researched during planning)

### Security Requirements
- **SR-001**: Denied tools MUST be completely inaccessible, even if explicitly requested by name
- **SR-002**: Proxy MUST validate all MCP protocol messages from upstream before forwarding
- **SR-003**: Regex patterns in deny list MUST be validated at startup; invalid patterns MUST cause immediate failure
- **SR-004**: Regex patterns MUST be checked for catastrophic backtracking potential and rejected if dangerous

### Key Entities
- **Upstream MCP Server**: The original MCP server being wrapped, exposes a set of tools
- **Deny List**: User-provided list of regex patterns matching tool names to exclude from the filtered output
- **Proxy Instance**: A single running instance of the Tool Filter MCP, wraps one upstream server
- **Filtered Tool Set**: The subset of upstream tools remaining after deny list patterns are applied
- **Transport Protocol**: Communication protocol (SSE or STDIO) used between proxy and AI agent

---

## Review & Acceptance Checklist
*GATE: Automated checks run during main() execution*

### Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness
- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

---

## Execution Status
*Updated by main() during processing*

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [x] Review checklist passed

---
