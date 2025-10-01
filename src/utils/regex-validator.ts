import safeRegex from 'safe-regex2';

export interface RegexValidationResult {
  valid: boolean;
  safe: boolean;
  error?: string;
}

export function validateRegexPattern(pattern: string): RegexValidationResult {
  try {
    const regex = new RegExp(pattern);
    const isSafe = safeRegex(pattern);

    if (!isSafe) {
      return {
        valid: true,
        safe: false,
        error: `Unsafe regex pattern detected: ${pattern}\nPattern could cause catastrophic backtracking`,
      };
    }

    return {
      valid: true,
      safe: true,
    };
  } catch (error) {
    return {
      valid: false,
      safe: false,
      error: `Invalid regex pattern in deny list: ${pattern}\nPattern must be valid JavaScript regex`,
    };
  }
}

export function validateRegexPatterns(patterns: string[]): RegexValidationResult {
  for (const pattern of patterns) {
    const result = validateRegexPattern(pattern);
    if (!result.valid || !result.safe) {
      return result;
    }
  }

  return {
    valid: true,
    safe: true,
  };
}
