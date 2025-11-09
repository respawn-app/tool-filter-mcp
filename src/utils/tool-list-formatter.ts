import type { Tool } from '@modelcontextprotocol/sdk/types.js';

export type ToolListFormat = 'table' | 'json' | 'names';

export function truncateDescription(desc: string, maxLength: number): string {
  const firstLine = desc.split('\n')[0];
  if (firstLine.length > maxLength) {
    return firstLine.substring(0, maxLength) + '...';
  }
  return firstLine !== desc ? firstLine + '...' : firstLine;
}

export function formatToolsList(tools: Tool[], format: ToolListFormat): string {
  if (tools.length === 0) {
    return format === 'json' ? '[]' : '';
  }

  switch (format) {
    case 'json':
      return JSON.stringify(tools, null, 2);

    case 'names':
      return tools.map((t) => t.name).join(',');

    case 'table':
    default:
      const header = `Available tools (${tools.length} total):\n`;
      const maxNameLength = Math.max(...tools.map((t) => t.name.length), 20);
      const separator = '\n';
      const maxDescLength = 100;

      const rows = tools.map((tool) => {
        const name = tool.name.padEnd(maxNameLength + 2);
        const desc = truncateDescription(tool.description || '(no description)', maxDescLength);

        return `${name}${desc}`;
      });

      return header + separator + rows.join('\n');
  }
}
