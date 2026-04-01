/**
 * MCP tool definitions and handlers for bot observation:
 *   get_bot_output  — recent console/stdout lines from the bot process
 *   get_chat_events — recent Minecraft chat/whisper messages seen by the bot
 */

import { ok, err } from './helpers.js';

/**
 * Returns tool definitions for the observation tools.
 * @returns {object[]}
 */
export function observationToolDefs() {
    return [
        {
            name: 'get_bot_output',
            description: [
                'Return recent output lines emitted by the bot process',
                '(includes command results, narrated actions, and chat messages).',
                "Use this to verify whether a command succeeded or to read the bot's responses.",
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
        {
            name: 'get_chat_events',
            description: [
                'Return recent Minecraft chat/whisper messages seen by the bot.',
                'Each entry has sender, message, and timestamp.',
                'Use this to monitor player activity and react with send_command or send_chat.',
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
                        description: 'Maximum number of events to return (default: 50).',
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
    ];
}

/**
 * Handle an observation tool call.
 * Returns null if the tool name is not handled by this module.
 *
 * @param {string} name
 * @param {object} args
 * @param {import('../bridge.js').MindServerBridge} bridge
 * @returns {object|null}
 */
export function handleObservation(name, args, bridge) {
    switch (name) {
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

        case 'get_chat_events': {
            const limit = args.limit ?? 50;
            const clear = args.clear ?? false;
            const events = bridge.getChatBuffer(args.agent_name, clear);
            const recent = events.slice(-limit);
            if (recent.length === 0) {
                return ok(`No chat events buffered for "${args.agent_name}" yet.`);
            }
            return ok(
                recent
                    .map((e) => `[${new Date(e.timestamp).toISOString()}] <${e.sender}> ${e.message}`)
                    .join('\n')
            );
        }

        default:
            return null;
    }
}
