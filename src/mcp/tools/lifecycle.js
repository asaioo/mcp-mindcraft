/**
 * MCP tool definitions and handler for agent lifecycle operations:
 *   list_agents, create_agent, stop_agent, start_agent, destroy_agent
 */

import { ok, err, buildSettings } from './helpers.js';

/**
 * Return tool definitions for all agent lifecycle tools.
 *
 * @returns {object[]}
 */
export function lifecycleToolDefs() {
    return [
        {
            name: 'list_agents',
            description: 'Return current status of all registered Mindcraft agents.',
            inputSchema: {
                type: 'object',
                properties: {},
                required: [],
            },
        },
        {
            name: 'create_agent',
            description: [
                'Register and spawn a new Mindcraft bot.',
                'The profile must include at minimum a "name" field.',
                '',
                'The optional model field controls how the bot thinks:',
                '  - Omit model or set it to "mcp": Claude controls the bot via MCP tools',
                '    (no API key needed on the bot side). Use send_command / send_chat to',
                '    drive actions instead of the bot responding autonomously.',
                '  - Any other model string gives the bot its own AI brain that reads chat',
                '    and responds autonomously. Supported values include "gpt-4o",',
                '    "claude-3-5-sonnet", "gemini-2.5-flash", and any other model string',
                '    supported by Mindcraft.',
                '',
                'Multiple agents with different models can run simultaneously — e.g. one',
                'MCP-controlled bot and one GPT-4o bot can coexist in the same world.',
                '',
                'NEVER include api_key or credential fields in the profile.',
            ].join('\n'),
            inputSchema: {
                type: 'object',
                properties: {
                    profile: {
                        type: 'object',
                        description: 'Agent profile. Must include "name". Optionally include "model".',
                        properties: {
                            name: {
                                type: 'string',
                                description: 'Unique name for the bot (used as its Minecraft username).',
                            },
                            model: {
                                description: [
                                    'Model string for the bot\'s AI brain, or "mcp" (default) for',
                                    'Claude-controlled operation with no autonomous AI.',
                                    'Examples: "mcp", "gpt-4o", "claude-3-5-sonnet", "gemini-2.5-flash".',
                                ].join(' '),
                            },
                        },
                        required: ['name'],
                    },
                    host: {
                        type: 'string',
                        description: 'Minecraft server host (default: 127.0.0.1).',
                    },
                    port: {
                        type: 'number',
                        description: 'Minecraft server port (default: 55916).',
                    },
                    minecraft_version: {
                        type: 'string',
                        description: '"auto" to detect automatically, or a specific version string.',
                    },
                    auth: {
                        type: 'string',
                        enum: ['offline', 'microsoft'],
                        description: 'Authentication mode (default: "offline").',
                    },
                    load_memory: {
                        type: 'boolean',
                        description: 'Whether to load the agent\'s persisted memory on start.',
                    },
                    init_message: {
                        type: 'string',
                        description: 'Optional message sent to the agent immediately after it spawns.',
                    },
                },
                required: ['profile'],
            },
        },
        {
            name: 'stop_agent',
            description: 'Send SIGINT to an agent process (graceful stop).',
            inputSchema: {
                type: 'object',
                properties: {
                    agent_name: {
                        type: 'string',
                        description: 'Name of the Mindcraft bot to stop.',
                    },
                },
                required: ['agent_name'],
            },
        },
        {
            name: 'start_agent',
            description: 'Force-restart an already-registered agent.',
            inputSchema: {
                type: 'object',
                properties: {
                    agent_name: {
                        type: 'string',
                        description: 'Name of the Mindcraft bot to restart.',
                    },
                },
                required: ['agent_name'],
            },
        },
        {
            name: 'destroy_agent',
            description: 'Stop and permanently unregister an agent.',
            inputSchema: {
                type: 'object',
                properties: {
                    agent_name: {
                        type: 'string',
                        description: 'Name of the Mindcraft bot to destroy.',
                    },
                },
                required: ['agent_name'],
            },
        },
    ];
}

/**
 * Handle a lifecycle tool call.
 *
 * @param {string} name - Tool name from the MCP request.
 * @param {object} args - Tool arguments from the MCP request.
 * @param {import('../bridge.js').MindServerBridge} bridge
 * @returns {Promise<object|null>} MCP response object, or null if name is not a lifecycle tool.
 */
export async function handleLifecycle(name, args, bridge) {
    switch (name) {
        case 'list_agents':
            return ok(JSON.stringify(bridge.getAgents(), null, 2));

        case 'create_agent': {
            const settings = buildSettings(args);
            const result = await bridge.createAgent(settings);
            return result.success
                ? ok(`Agent "${args.profile.name}" created and spawning.`)
                : err(`Failed to create agent: ${result.error}`);
        }

        case 'stop_agent':
            bridge.stopAgent(args.agent_name);
            return ok(`Stop signal sent to "${args.agent_name}".`);

        case 'start_agent':
            bridge.startAgent(args.agent_name);
            return ok(`Start signal sent to "${args.agent_name}".`);

        case 'destroy_agent':
            bridge.destroyAgent(args.agent_name);
            return ok(`Agent "${args.agent_name}" destroyed.`);

        default:
            return null;
    }
}
