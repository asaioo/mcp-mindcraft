/**
 * MCP tool definitions and handlers for Mindcraft.
 *
 * Design:
 *   Claude is the only model/brain. No keys.json is required on the bot side
 *   because commands sent via send_command bypass Andy's AI pipeline entirely
 *   (agent.handleMessage detects !commandName(...) and executes directly).
 *   send_chat uses the direct-chat socket which calls bot.chat() with no AI.
 *
 * Tool surface:
 *   list_agents        — registered agents and their status
 *   send_command       — execute a Mindcraft command on Andy (no AI needed)
 *   send_chat          — make Andy say text in Minecraft chat (no AI needed)
 *   get_agent_state    — Andy's current game state snapshot
 *   list_commands      — commands Andy can execute (live docs from agent)
 *   get_bot_output     — recent console/chat output from Andy
 *   create_agent       — register and spawn a new agent
 *   stop_agent         — stop an agent
 *   start_agent        — restart an agent
 *   destroy_agent      — stop and unregister an agent
 */

export function getToolDefinitions() {
    return [
        // ---------------------------------------------------------------- //
        // Primary interaction tools — no model/API key needed on Andy's side
        // ---------------------------------------------------------------- //
        {
            name: 'send_command',
            description: [
                'Execute a Mindcraft command on Andy in Minecraft.',
                'Commands follow the !commandName(arg1, arg2, ...) syntax.',
                'They are executed DIRECTLY — Andy does NOT call an AI model.',
                '',
                'Examples:',
                '  !goToPlayer("Steve", 3)',
                '  !collectBlocks("oak_log", 5)',
                '  !attack("zombie")',
                '  !craftItem("crafting_table", 1)',
                '  !stop()',
                '',
                'Use list_commands to see every available command with argument docs.',
            ].join('\n'),
            inputSchema: {
                type: 'object',
                properties: {
                    agent_name: {
                        type: 'string',
                        description: 'Name of the Mindcraft bot (e.g. "Andy").',
                    },
                    command: {
                        type: 'string',
                        description: [
                            'Full command string including the ! prefix and parenthesised args.',
                            'String args must be quoted: !goToPlayer("Steve", 3)',
                        ].join(' '),
                    },
                },
                required: ['agent_name', 'command'],
            },
        },
        {
            name: 'send_chat',
            description: [
                'Make Andy say text in Minecraft chat without using an AI model.',
                'Use this to have Andy reply to players, announce actions, or narrate what he is doing.',
                'Text is sent verbatim — no AI processing occurs.',
            ].join('\n'),
            inputSchema: {
                type: 'object',
                properties: {
                    agent_name: {
                        type: 'string',
                        description: 'Name of the Mindcraft bot.',
                    },
                    message: {
                        type: 'string',
                        description: 'Text Andy will say in Minecraft chat.',
                    },
                },
                required: ['agent_name', 'message'],
            },
        },
        {
            name: 'get_agent_state',
            description: [
                "Return Andy's latest game-state snapshot:",
                'position, health, hunger, inventory, nearby entities and blocks, current action, etc.',
                'Returns null when Andy is not in-game or no state has been received yet.',
                'Call this before deciding what command to execute.',
            ].join('\n'),
            inputSchema: {
                type: 'object',
                properties: {
                    agent_name: {
                        type: 'string',
                        description: 'Name of the Mindcraft bot.',
                    },
                },
                required: ['agent_name'],
            },
        },
        {
            name: 'list_commands',
            description: [
                "Return the full command documentation for Andy's available commands.",
                'Read this before calling send_command to know exact syntax and argument types.',
                'Only commands not in Andy\'s blocked_actions list are returned.',
            ].join('\n'),
            inputSchema: {
                type: 'object',
                properties: {
                    agent_name: {
                        type: 'string',
                        description: 'Name of the Mindcraft bot.',
                    },
                },
                required: ['agent_name'],
            },
        },
        {
            name: 'get_bot_output',
            description: [
                "Return recent output lines emitted by Andy's bot process",
                '(includes command results, narrated actions, and chat messages).',
                'Use this to verify whether a command succeeded or to read Andy\'s responses.',
                'Pass clear=true to flush the buffer after reading.',
            ].join('\n'),
            inputSchema: {
                type: 'object',
                properties: {
                    agent_name: {
                        type: 'string',
                        description: 'Name of the Mindcraft bot.',
                    },
                    limit: {
                        type: 'number',
                        description: 'Maximum number of lines to return (default: 50).',
                        default: 50,
                    },
                    clear: {
                        type: 'boolean',
                        description: 'Flush the buffer after reading (default: false).',
                        default: false,
                    },
                },
                required: ['agent_name'],
            },
        },
        // ---------------------------------------------------------------- //
        // Agent lifecycle tools
        // ---------------------------------------------------------------- //
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
                'To have Claude control the bot via MCP (no keys.json), omit the model field',
                'and use send_command / send_chat to drive actions instead.',
                'NEVER include api_key or credential fields.',
            ].join('\n'),
            inputSchema: {
                type: 'object',
                properties: {
                    profile: {
                        type: 'object',
                        description: 'Agent profile. Must include "name".',
                        properties: {
                            name: { type: 'string' },
                            model: { description: 'Optional model spec (omit for pure MCP control).' },
                        },
                        required: ['name'],
                    },
                    host: { type: 'string', description: 'Minecraft server host (default: 127.0.0.1).' },
                    port: { type: 'number', description: 'Minecraft server port (default: 55916).' },
                    minecraft_version: { type: 'string', description: '"auto" or specific version.' },
                    auth: { type: 'string', enum: ['offline', 'microsoft'] },
                    load_memory: { type: 'boolean' },
                    init_message: { type: 'string' },
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
                    agent_name: { type: 'string' },
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
                    agent_name: { type: 'string' },
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
                    agent_name: { type: 'string' },
                },
                required: ['agent_name'],
            },
        },
    ];
}

/**
 * Dispatch an MCP tool call to the bridge.
 *
 * @param {string} name
 * @param {object} args
 * @param {import('./bridge.js').MindServerBridge} bridge
 */
export async function handleToolCall(name, args, bridge) {
    if (!bridge.isConnected()) {
        return err('MCP bridge is not connected to MindServer. Start MindServer first (node main.js).');
    }

    switch (name) {
        // ---------------------------------------------------------------- //
        // Primary interaction
        // ---------------------------------------------------------------- //
        case 'send_command': {
            const cmd = args.command.trim();
            if (!cmd.startsWith('!')) {
                return err(
                    `Commands must start with "!". Got: "${cmd}". ` +
                    'Example: !goToPlayer("Steve", 3)'
                );
            }
            bridge.sendCommand(args.agent_name, cmd);
            return ok(
                `Command sent to "${args.agent_name}": ${cmd}\n` +
                'Use get_bot_output to read the result.'
            );
        }

        case 'send_chat': {
            bridge.directChat(args.agent_name, args.message);
            return ok(`"${args.agent_name}" will say in Minecraft chat: ${args.message}`);
        }

        case 'get_agent_state': {
            const state = bridge.getAgentState(args.agent_name);
            if (!state) {
                return ok(
                    `No state available for "${args.agent_name}". ` +
                    'The agent may not be in-game yet. Check list_agents.'
                );
            }
            return ok(JSON.stringify(state, null, 2));
        }

        case 'list_commands': {
            let docs;
            try {
                docs = await bridge.getCommands(args.agent_name);
            } catch (e) {
                return err(`Could not fetch commands: ${e.message}`);
            }
            return ok(docs || 'No command documentation available.');
        }

        case 'get_bot_output': {
            const limit = args.limit ?? 50;
            const clear = args.clear ?? false;
            const lines = bridge.getOutputBuffer(args.agent_name, clear);
            const recent = lines.slice(-limit);
            if (recent.length === 0) {
                return ok(`No output buffered for "${args.agent_name}" yet.`);
            }
            return ok(
                recent
                    .map((e) => `[${new Date(e.timestamp).toISOString()}] ${e.message}`)
                    .join('\n')
            );
        }

        // ---------------------------------------------------------------- //
        // Lifecycle
        // ---------------------------------------------------------------- //
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
            return err(`Unknown tool: ${name}`);
    }
}

// ------------------------------------------------------------------ //
// Helpers
// ------------------------------------------------------------------ //

function ok(text) {
    return { content: [{ type: 'text', text }] };
}

function err(text) {
    return { content: [{ type: 'text', text }], isError: true };
}

function buildSettings(args) {
    const settings = { profile: args.profile };
    for (const key of ['host', 'port', 'minecraft_version', 'auth', 'load_memory', 'init_message']) {
        if (args[key] !== undefined) settings[key] = args[key];
    }
    return settings;
}
