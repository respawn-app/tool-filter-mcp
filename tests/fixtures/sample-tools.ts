import { FilteredTool } from '../../src/types.js';

export const sampleTools: FilteredTool[] = [
  {
    name: 'read_file',
    description: 'Read contents of a file',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file to read',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Write contents to a file',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file to write',
        },
        content: {
          type: 'string',
          description: 'Content to write to the file',
        },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'list_dir',
    description: 'List contents of a directory',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the directory to list',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'get_env',
    description: 'Get environment variable value',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the environment variable',
        },
      },
      required: ['name'],
    },
  },
];

export const databaseTools: FilteredTool[] = [
  {
    name: 'query_database',
    description: 'Execute a database query',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'SQL query to execute',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'update_database',
    description: 'Update database records',
    inputSchema: {
      type: 'object',
      properties: {
        table: {
          type: 'string',
          description: 'Table to update',
        },
        data: {
          type: 'object',
          description: 'Data to update',
        },
      },
      required: ['table', 'data'],
    },
  },
];

export const allTools: FilteredTool[] = [...sampleTools, ...databaseTools];
