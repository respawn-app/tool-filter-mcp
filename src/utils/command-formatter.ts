export function quoteArgWithSpecialChars(arg: string): string {
  // If the argument contains spaces, quotes, or is empty, wrap it in quotes
  if (arg.length === 0 || /[\s"]/.test(arg)) {
    // Escape any existing double quotes and wrap in quotes
    return `"${arg.replace(/"/g, '\\"')}"`;
  }
  return arg;
}

/**
 * Formats a command and its arguments for display in error messages.
 * Properly quotes arguments that contain spaces or special characters.
 */
export function formatCommandDisplay(command: string, args: string[]): string {
  const quotedCommand = quoteArgWithSpecialChars(command);
  const quotedArgs = args.map(quoteArgWithSpecialChars);
  return [quotedCommand, ...quotedArgs].join(' ');
}
