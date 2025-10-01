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
  denyPatterns: string[]
): ToolFilterResult {
  if (denyPatterns.length === 0) {
    return {
      allowed: tools,
      denied: [],
      invalidPatterns: [],
    };
  }

  const filter = new RegexFilter(denyPatterns);
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

    if (matched) {
      denied.push(tool.name);
    } else {
      allowed.push(tool);
    }
  }

  const invalidPatterns: string[] = [];
  for (let i = 0; i < denyPatterns.length; i++) {
    if (!matchedPatterns.has(i)) {
      invalidPatterns.push(denyPatterns[i]);
    }
  }

  return {
    allowed,
    denied,
    invalidPatterns,
  };
}
