// MCP Tools Definition Module
// Enterprise compliant, modular design

export const mcpTools = new Map();

// Initialize core MCP tools
export function initializeMCPTools() {
  // Core MCP tools
  mcpTools.set('echo', {
    name: 'echo',
    description: 'Echo back the input message',
    inputSchema: {
      type: 'object',
      properties: { message: { type: 'string' } },
      required: ['message']
    }
  });

  mcpTools.set('get_server_info', {
    name: 'get_server_info',
    description: 'Get information about this MCP server',
    inputSchema: { type: 'object', properties: {} }
  });

  mcpTools.set('calculate', {
    name: 'calculate',
    description: 'Perform basic mathematical calculations',
    inputSchema: {
      type: 'object',
      properties: {
        operation: { type: 'string', enum: ['add', 'subtract', 'multiply', 'divide'] },
        a: { type: 'number' },
        b: { type: 'number' }
      },
      required: ['operation', 'a', 'b']
    }
  });



  mcpTools.set('git_status', {
    name: 'git_status',
    description: 'Get current git repository status',
    inputSchema: { type: 'object', properties: {} }
  });

  return mcpTools;
}

export default { mcpTools, initializeMCPTools };
