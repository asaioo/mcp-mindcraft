/**
 * MCP tools for reactive chat handling and model forwarding.
 *
 * wait_for_chat  — long-poll for new in-game chat messages (blocks until message arrives or timeout)
 * send_to_model  — forward a message through the agent's own AI pipeline (requires a non-mcp model)
 */

import { ok, err, checkAgentReady } from './helpers.js';

export function chatForwardToolDefs() {
    return [
        {
            name: 'wait_for_chat',
            description: [
                'Block until a new Minecraft chat message arrives for the agent, or until timeout.',
                'Use this in a loop to reactively respond to player messages:',
                '  1. Call wait_for_chat to get the next message',
                '  2. Decide how to respond (send_command, send_chat, etc.)',
                '  3. Call wait_for_chat again',
                '',
                'Unlike get_chat_events (which returns already-buffered messages), this tool',
                'waits for NEW messages that arrive after the call is made.',
                'Returns the new message(s) or a timeout notice.',
            ].join('\n'),
            inputSchema: {
                type: 'object',
                properties: {
                    agent_name: {
                        type: 'string',
                        description: 'Name of the Mindcraft bot.',
                    },
                    timeout: {
                        type: 'number',
                        description: 'Max milliseconds to wait (default: 30000, max: 60000).',
                        default: 30000,
                    },
                },
                required: ['agent_name'],
            },
        },
        {
            name: 'send_to_model',
            description: [
                'Forward a message to the agent\'s own AI model for processing.',
                'The agent will interpret the message through its full AI pipeline',
                '(prompt construction, model call, command execution) and respond autonomously.',
                '',
                'This is useful when the agent has a real model (e.g. gpt-4o, claude-3-5-sonnet)',
                'and you want it to handle a task using its own reasoning rather than',
                'sending explicit commands.',
                '',
                'For MCP-only agents (model="mcp"), this has no effect since the dummy model',
                'returns empty responses. Use send_command instead.',
                '',
                'Use get_bot_output afterward to see what the agent did.',
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
                        description: 'Message to send through the agent\'s AI pipeline.',
                    },
                    sender: {
                        type: 'string',
                        description: 'Who the message is from (default: "player"). The agent treats this as the source.',
                        default: 'player',
                    },
                },
                required: ['agent_name', 'message'],
            },
        },
    ];
}

/**
 * Handle a chat-forwarding tool call.
 *
 * @param {string} name
 * @param {object} args
 * @param {import('../bridge.js').MindServerBridge} bridge
 * @returns {Promise<object|null>}
 */
export async function handleChatForward(name, args, bridge) {
    switch (name) {
        case 'wait_for_chat': {
            const notReady = checkAgentReady(bridge, args.agent_name);
            if (notReady) return err(notReady);

            const timeout = Math.min(args.timeout ?? 30000, 60000);
            const events = await bridge.waitForChat(args.agent_name, timeout);

            if (!events || events.length === 0) {
                return ok(
                    `No new chat messages for "${args.agent_name}" within ${timeout}ms. ` +
                    'Call again to keep listening.'
                );
            }
            return ok(
                events
                    .map((e) => `[${new Date(e.timestamp).toISOString()}] <${e.sender}> ${e.message}`)
                    .join('\n')
            );
        }

        case 'send_to_model': {
            const notReady = checkAgentReady(bridge, args.agent_name);
            if (notReady) return err(notReady);

            const sender = args.sender ?? 'player';
            bridge.sendMessage(args.agent_name, { from: sender, message: args.message });
            return ok(
                `Message forwarded to "${args.agent_name}" AI pipeline from "${sender}": ${args.message}\n` +
                'Use get_bot_output to see the agent\'s response.'
            );
        }

        default:
            return null;
    }
}
