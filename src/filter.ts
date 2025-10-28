import { FilteredTool, ToolFilterResult } from './types.js';
import { validateRegexPatterns } from './utils/regex-validator.js';

export class RegexFilter {
  public readonly patterns: RegExp[];
  public readonly rawPatterns: string[];

  constructor(patterns: string[]) {
    const validation = validateRegexPatterns(patterns);
    if (!validation.valid || !validation.safe) {
      throw new Error(validation.error || 'Invalid regex patterns');
    }

    this.rawPatterns = patterns;
    this.patterns = patterns.map((p) => new RegExp(p));
  }

  matches(toolName: string): boolean {
    return this.patterns.some((pattern) => pattern.test(toolName));
  }
}

export function applyFilters(
  tools: FilteredTool[],
  denyPatterns: string[],
  allowPatterns: string[] = [],
  mode: 'deny' | 'allow' = 'deny'
): ToolFilterResult {
  // If in deny mode and no deny patterns, allow all tools
  if (mode === 'deny' && denyPatterns.length === 0) {
    return {
      allowed: tools,
      denied: [],
      invalidPatterns: [],
    };
  }

  // If in allow mode and no allow patterns, deny all tools
  if (mode === 'allow' && allowPatterns.length === 0) {
    return {
      allowed: [],
      denied: tools.map((t) => t.name),
      invalidPatterns: [],
    };
  }

  const patterns = mode === 'deny' ? denyPatterns : allowPatterns;
  const filter = new RegexFilter(patterns);
  const allowed: FilteredTool[] = [];
  const denied: string[] = [];
  const matchedPatterns = new Set<number>();

  for (const tool of tools) {
    let matched = false;
    for (let i = 0; i < filter.patterns.length; i++) {
      if (filter.patterns[i].test(tool.name)) {
        matchedPatterns.add(i);
        matched = true;
      }
    }

    // In deny mode: matched = denied, not matched = allowed
    // In allow mode: matched = allowed, not matched = denied
    if (mode === 'deny') {
      if (matched) {
        denied.push(tool.name);
      } else {
        allowed.push(tool);
      }
    } else {
      if (matched) {
        allowed.push(tool);
      } else {
        denied.push(tool.name);
      }
    }
  }

  const invalidPatterns: string[] = [];
  for (let i = 0; i < patterns.length; i++) {
    if (!matchedPatterns.has(i)) {
      invalidPatterns.push(patterns[i]);
    }
  }

  return {
    allowed,
    denied,
    invalidPatterns,
  };
}
