/**
 * Mindcraft MCP Server
 *
 * Exposes Mindcraft agent controls (lifecycle, messaging, state) as MCP
 * tools and resources for use by Claude Code.
 *
 * Transport: stdio (standard MCP transport for Claude Code integration).
 *
 * Usage:
 *   node mcp.js [--mindserver-port 8080]
 *
 * The server connects to a running MindServer instance as a Socket.io
 * client. Start MindServer first with `node main.js`, then start this
 * MCP server in a separate process.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListResourcesRequestSchema,
    ListResourceTemplatesRequestSchema,
    ListToolsRequestSchema,
    ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { MindServerBridge } from './bridge.js';
import { getToolDefinitions, handleToolCall } from './tools/index.js';
import { getResourceDefinitions, getResourceTemplates, handleResourceRead } from './resources.js';

const SERVER_NAME = 'mindcraft-mcp';
const SERVER_VERSION = '0.1.0';

/**
 * Create and start the Mindcraft MCP server.
 *
 * @param {{ mindserverPort?: number }} options
 */
export async function startMcpServer({ mindserverPort = 8080 } = {}) {
    // ------------------------------------------------------------------ //
    // 1. Connect to MindServer
    // ------------------------------------------------------------------ //
    const bridge = new MindServerBridge(mindserverPort);

    process.stderr.write(
        `[mindcraft-mcp] Connecting to MindServer on port ${mindserverPort}…\n`
    );

    try {
        await bridge.connect();
        process.stderr.write('[mindcraft-mcp] Connected to MindServer.\n');
    } catch (e) {
        // Non-fatal: some tools will return errors while disconnected, but
        // the server itself should still start so Claude Code can at least
        // query available tools.
        process.stderr.write(`[mindcraft-mcp] WARNING: ${e.message}\n`);
        process.stderr.write('[mindcraft-mcp] Server starting in degraded mode.\n');
    }

    // ------------------------------------------------------------------ //
    // 2. Create MCP server
    // ------------------------------------------------------------------ //
    const server = new Server(
        { name: SERVER_NAME, version: SERVER_VERSION },
        {
            capabilities: {
                tools: {},
                resources: { subscribe: false },
            },
        }
    );

    // ------------------------------------------------------------------ //
    // 3. Tool handlers
    // ------------------------------------------------------------------ //
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: getToolDefinitions(),
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args = {} } = request.params;
        try {
            return await handleToolCall(name, args, bridge);
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Tool "${name}" threw an error: ${e.message}` }],
                isError: true,
            };
        }
    });

    // ------------------------------------------------------------------ //
    // 4. Resource handlers
    // ------------------------------------------------------------------ //
    server.setRequestHandler(ListResourcesRequestSchema, async () => ({
        resources: getResourceDefinitions(),
    }));

    server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
        resourceTemplates: getResourceTemplates(),
    }));

    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
        const { uri } = request.params;
        try {
            return await handleResourceRead(uri, bridge);
        } catch (e) {
            return {
                contents: [
                    {
                        uri,
                        mimeType: 'application/json',
                        text: JSON.stringify({ error: e.message }),
                    },
                ],
            };
        }
    });

    // ------------------------------------------------------------------ //
    // 5. Start stdio transport
    // ------------------------------------------------------------------ //
    const transport = new StdioServerTransport();
    await server.connect(transport);

    process.stderr.write('[mindcraft-mcp] MCP server ready on stdio.\n');

    return { server, bridge };
}
