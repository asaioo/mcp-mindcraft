/**
 * MCP tool definitions and handlers for direct bot interaction.
 *
 * Covers: send_command, send_chat, get_agent_state, list_commands
 *
 * These tools drive the bot without invoking any AI model on the bot's side.
 * send_command dispatches a !command(...) string that is executed directly by
 * the agent's command pipeline.  send_chat calls bot.chat() verbatim.
 */

import { ok, err, checkAgentReady } from './helpers.js';

/**
 * Return the tool definitions for the interaction tools.
 * @returns {object[]}
 */
export function interactionToolDefs() {
    return [
        {
            name: 'send_command',
            description: [
                'Execute a Mindcraft command on the named bot in Minecraft.',
                'Commands follow the !commandName(arg1, arg2, ...) syntax.',
                'They are executed DIRECTLY — the bot does NOT call an AI model.',
                '',
                'Examples:',
                '  !goToPlayer("Steve", 3)',
                '  !collectBlocks("oak_log", 5)',
                '  !attack("zombie")',
                '  !stop()',
                '',
                'Use list_commands to see every available command with argument docs.',
            ].join('\n'),
            inputSchema: {
                type: 'object',
                properties: {
                    agent_name: {
                        type: 'string',
                        description: 'Name of the Mindcraft bot.',
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
                'Make the named bot say text in Minecraft chat without using an AI model.',
                'Use this to have the bot reply to players, announce actions, or narrate what it is doing.',
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
                        description: 'Text the bot will say in Minecraft chat.',
                    },
                },
                required: ['agent_name', 'message'],
            },
        },
        {
            name: 'get_agent_state',
            description: [
                "Return the agent's latest game-state snapshot:",
                'position, health, hunger, inventory, nearby entities and blocks, current action, etc.',
                'Returns null when the agent is not in-game or no state has been received yet.',
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
                "Return the full command documentation for the agent's available commands.",
                'Read this before calling send_command to know exact syntax and argument types.',
                "Only commands not in the agent's blocked_actions list are returned.",
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
    ];
}

/**
 * Handle an interaction tool call.
 *
 * Returns a MCP response object on match, or null if `name` is not one of the
 * interaction tools (allowing the caller to try the next module).
 *
 * @param {string} name
 * @param {object} args
 * @param {import('../bridge.js').MindServerBridge} bridge
 * @returns {Promise<object|null>}
 */
export async function handleInteraction(name, args, bridge) {
    switch (name) {
        case 'send_command': {
            const cmd = args.command.trim();
            if (!cmd.startsWith('!')) {
                return err(
                    `Commands must start with "!". Got: "${cmd}". ` +
                    'Example: !goToPlayer("Steve", 3)'
                );
            }
            const notReady = checkAgentReady(bridge, args.agent_name);
            if (notReady) return err(notReady);
            bridge.sendCommand(args.agent_name, cmd);
            return ok(
                `Command sent to "${args.agent_name}": ${cmd}\n` +
                'Use get_bot_output to read the result.'
            );
        }

        case 'send_chat': {
            const notReady = checkAgentReady(bridge, args.agent_name);
            if (notReady) return err(notReady);
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
            const notReady = checkAgentReady(bridge, args.agent_name);
            if (notReady) return err(notReady);
            let docs;
            try {
                docs = await bridge.getCommands(args.agent_name);
            } catch (e) {
                return err(`Could not fetch commands: ${e.message}`);
            }
            return ok(docs || 'No command documentation available.');
        }

        default:
            return null;
    }
}
