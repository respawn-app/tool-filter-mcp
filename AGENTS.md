# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains the TypeScript source (CLI entry in `src/index.ts`, core proxy logic in `src/proxy.ts`, client/transport logic in `src/client.ts`, and helpers in `src/utils/`).
- `tests/` holds unit and integration tests (e.g., `tests/unit/*.test.ts`, `tests/integration/*.test.ts`).
- `dist/` is the compiled output produced by the build.
- `docs/` and `specs/` are supporting materials when present; they are not runtime dependencies.

## Build, Test, and Development Commands
- `npm run build` — compile TypeScript to `dist/` using the project tsconfig.
- `npm test -- --run` — run the full Vitest suite once (non-watch).
- `npm run lint` — run ESLint over `src/` and `tests/`.
- `npm run format` — format TS files via Prettier.
- `npm run format:check` — CI-friendly formatting check.

## Coding Style & Naming Conventions
- TypeScript 5.x in strict mode; keep typings explicit where inference is unclear.
- 2-space indentation, semicolons, and ESM imports with `.js` extensions (compiled target).
- Filenames are kebab-case (e.g., `tool-list-formatter.ts`); types/interfaces use PascalCase.
- Formatting and linting are enforced via Prettier and ESLint; keep changes compliant.

## Testing Guidelines
- Test framework: Vitest.
- Tests live in `tests/unit/` and `tests/integration/` and use the `*.test.ts` naming pattern.
- Prefer targeted runs while iterating: `npm test -- --run tests/unit/<name>.test.ts`.
- Ensure all tests pass before opening a PR.

## Commit & Pull Request Guidelines
- Commit messages are short, imperative, and scoped to the change (e.g., “Bump version to 0.4.2”, “Update deps and refresh 2026 maintenance”).
- PRs should include: a brief summary, test command(s) run, and any noteworthy behavior changes.
- Link relevant issues if applicable; no screenshots required for this CLI-only project.

## Configuration & Runtime Notes
- Node.js 20+ is required.
- The CLI supports HTTP/SSE and stdio upstream MCP servers; see `README.md` for usage examples and header/env options.
