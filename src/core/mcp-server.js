// MCP WebSocket Server Class Module
// Enterprise compliant - clean class definition

import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { initializeMCPTools } from './mcp-tools.js';
import { handleInitialize, handleToolsList, handleToolCall } from './mcp-handlers-slim.js';

export class MCPWebSocketServer {
  constructor() {
    this.clients = new Map();
    this.tools = new Map();
    this.resources = new Map();
    
    this.initializeMCPCapabilities();
  }

  initializeMCPCapabilities() {
    // Initialize tools from module
    initializeMCPTools();
    
    // Copy tools from module
    this.tools = new Map();
    this.tools.set('echo', {
      name: 'echo',
      description: 'Echo back the input message',
      inputSchema: {
        type: 'object',
        properties: { message: { type: 'string' } },
        required: ['message']
      }
    });

    this.tools.set('get_server_info', {
      name: 'get_server_info',
      description: 'Get information about this MCP server',
      inputSchema: { type: 'object', properties: {} }
    });

    this.tools.set('calculate', {
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

    // Core MCP resources
    this.resources.set('server_capabilities', {
      uri: 'capability://server',
      name: 'Server Capabilities',
      description: 'Information about server capabilities and features'
    });
  }

  async handleMessage(ws, data) {
    try {
      switch (data.method) {
        case 'initialize':
          return await handleInitialize(data, ws, this.clients);
        case 'tools/list':
          return await handleToolsList(data, this.tools);
        case 'tools/call':
          return await handleToolCall(data, this.tools);
        case 'resources/list':
          return {
            jsonrpc: '2.0',
            id: data.id,
            result: { resources: Array.from(this.resources.values()) }
          };
        default:
          return {
            jsonrpc: '2.0',
            id: data.id,
            error: { code: -32601, message: `Method not found: ${data.method}` }
          };
      }
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id: data.id,
        error: { code: -32603, message: error.message }
      };
    }
  }
}

export default MCPWebSocketServer;
