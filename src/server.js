#!/usr/bin/env node

import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';
import Joi from 'joi';

dotenv.config();

// MCP Protocol Implementation (2025-03-26 Specification)
class MCPWebSocketServer {
  constructor() {
    this.clients = new Map();
    this.tools = new Map();
    this.resources = new Map();
    
    this.initializeMCPCapabilities();
  }

  initializeMCPCapabilities() {
    // Core MCP tools
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
      uri: 'resource://server_capabilities',
      name: 'Server Capabilities',
      description: 'Information about this MCP server capabilities',
      mimeType: 'application/json'
    });

    console.log('🔧 MCP capabilities initialized:', {
      tools: Array.from(this.tools.keys()),
      resources: Array.from(this.resources.keys())
    });
  }

  // MCP Protocol validation schemas
  getValidationSchemas() {
    return {
      initialize: Joi.object({
        jsonrpc: Joi.string().valid('2.0').required(),
        id: Joi.alternatives().try(Joi.string(), Joi.number()).required(),
        method: Joi.string().valid('initialize').required(),
        params: Joi.object({
          protocolVersion: Joi.string().required(),
          capabilities: Joi.object().required(),
          clientInfo: Joi.object({
            name: Joi.string().required(),
            version: Joi.string().required()
          }).required()
        }).required()
      }),
      
      toolCall: Joi.object({
        jsonrpc: Joi.string().valid('2.0').required(),
        id: Joi.alternatives().try(Joi.string(), Joi.number()).required(),
        method: Joi.string().valid('tools/call').required(),
        params: Joi.object({
          name: Joi.string().required(),
          arguments: Joi.object()
        }).required()
      })
    };
  }

  // Handle MCP method calls
  async handleMCPMethod(method, params, id) {
    try {
      switch (method) {
        case 'initialize':
          return this.handleInitialize(params, id);
        case 'tools/list':
          return this.handleToolsList(id);
        case 'tools/call':
          return this.handleToolCall(params, id);
        case 'resources/list':
          return this.handleResourcesList(id);
        case 'resources/read':
          return this.handleResourceRead(params, id);
        default:
          return {
            jsonrpc: '2.0',
            id,
            error: { code: -32601, message: 'Method not found' }
          };
      }
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32603, message: 'Internal error', data: error.message }
      };
    }
  }

  handleInitialize(params, id) {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2025-03-26',
        capabilities: {
          tools: { listChanged: true },
          resources: { subscribe: true, listChanged: true },
          prompts: { listChanged: true },
          logging: {}
        },
        serverInfo: {
          name: 'Ultimate MCP Server',
          version: '1.0.0',
          description: 'Enterprise-grade MCP server with WebSocket transport'
        }
      }
    };
  }

  handleToolsList(id) {
    return {
      jsonrpc: '2.0',
      id,
      result: { tools: Array.from(this.tools.values()) }
    };
  }

  handleResourcesList(id) {
    return {
      jsonrpc: '2.0',
      id,
      result: { resources: Array.from(this.resources.values()) }
    };
  }

  async handleToolCall(params, id) {
    const { name, arguments: args } = params;
    
    if (!this.tools.has(name)) {
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32602, message: `Tool "${name}" not found` }
      };
    }

    switch (name) {
      case 'echo':
        return {
          jsonrpc: '2.0',
          id,
          result: { content: [{ type: 'text', text: `Echo: ${args.message}` }] }
        };
      
      case 'get_server_info':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [{
              type: 'text',
              text: JSON.stringify({
                server: 'Ultimate MCP Server',
                version: '1.0.0',
                protocol: '2025-03-26',
                tools: Array.from(this.tools.keys()),
                resources: Array.from(this.resources.keys()),
                clients: this.clients.size
              }, null, 2)
            }]
          }
        };
      
      case 'calculate':
        const { operation, a, b } = args;
        let result;
        switch (operation) {
          case 'add': result = a + b; break;
          case 'subtract': result = a - b; break;
          case 'multiply': result = a * b; break;
          case 'divide': result = b !== 0 ? a / b : 'Error: Division by zero'; break;
          default: throw new Error('Invalid operation');
        }
        return {
          jsonrpc: '2.0',
          id,
          result: { content: [{ type: 'text', text: `${a} ${operation} ${b} = ${result}` }] }
        };
      
      default:
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32603, message: 'Tool execution failed' }
        };
    }
  }
}

// Create Express app for health checks
const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true }
}));

app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') || false }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});
app.use(limiter);

app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    mcp: {
      protocol: 'MCP 2025-03-26',
      transport: 'WebSocket',
      clients: mcpServer.clients.size,
      tools: mcpServer.tools.size,
      resources: mcpServer.resources.size,
      uptime: process.uptime()
    }
  });
});

// Create HTTP server
const server = createServer(app);

// Create MCP WebSocket server
const mcpServer = new MCPWebSocketServer();
const wss = new WebSocketServer({ 
  server,
  path: '/mcp',
  verifyClient: (info) => {
    // Basic security check
    const origin = info.origin;
    return !origin || process.env.ALLOWED_ORIGINS?.split(',').includes(origin) || process.env.NODE_ENV === 'development';
  }
});

wss.on('connection', (ws, req) => {
  const clientId = uuidv4();
  mcpServer.clients.set(clientId, { ws, connectedAt: Date.now() });
  
  console.log(`📱 MCP Client connected: ${clientId} (${mcpServer.clients.size} total)`);

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      // Validate JSON-RPC structure
      const schemas = mcpServer.getValidationSchemas();
      
      if (message.method === 'initialize') {
        const { error } = schemas.initialize.validate(message);
        if (error) {
          ws.send(JSON.stringify({
            jsonrpc: '2.0',
            id: message.id,
            error: { code: -32602, message: 'Invalid params', data: error.details }
          }));
          return;
        }
      }

      const response = await mcpServer.handleMCPMethod(message.method, message.params, message.id);
      ws.send(JSON.stringify(response));
      
    } catch (error) {
      console.error('❌ MCP Message error:', error);
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error' }
      }));
    }
  });

  ws.on('close', () => {
    mcpServer.clients.delete(clientId);
    console.log(`📱 MCP Client disconnected: ${clientId} (${mcpServer.clients.size} remaining)`);
  });

  ws.on('error', (error) => {
    console.error(`❌ MCP WebSocket error for ${clientId}:`, error);
    mcpServer.clients.delete(clientId);
  });
});

// Start servers
const PORT = process.env.PORT || 3000;
const HEALTH_PORT = process.env.HEALTH_PORT || 3001;

// Health check server
app.listen(HEALTH_PORT, () => {
  console.log(`✅ Health Check Server listening on port ${HEALTH_PORT}`);
});

// Main MCP server
server.listen(PORT, () => {
  console.log('============================================================');
  console.log('🚀 Ultimate MCP Server (2025-03-26 Specification)');
  console.log(`🔌 WebSocket MCP endpoint: ws://192.168.68.94:${PORT}/mcp`);
  console.log(`🏥 Health check: http://192.168.68.94:${HEALTH_PORT}/health`);
  console.log('🔒 Security hardening: ENABLED');
  console.log(`🛠️ Tools: ${mcpServer.tools.size} available`);
  console.log(`📚 Resources: ${mcpServer.resources.size} available`);
  console.log('============================================================');
});