import { ok, err } from './helpers.js';

/**
 * Tool definitions for chat rule management.
 *
 * @returns {object[]}
 */
export function chatRuleToolDefs() {
    return [
        {
            name: 'add_chat_rule',
            description: [
                'Register a rule that auto-executes a bot command whenever an incoming Minecraft chat message matches a pattern.',
                'pattern is a JavaScript regex string (case-insensitive). Use .* for wildcards.',
                'command is the full Mindcraft command to run, e.g. !attack("{sender}").',
                'Use {sender} and {message} as placeholders — they are replaced at match time.',
                '',
                'Example: pattern="help" command="!goToPlayer(\\"{sender}\\", 2)"',
                '→ whenever anyone says "help", the bot walks to them.',
                '',
                'Rules persist until explicitly removed or the MCP server restarts.',
            ].join('\n'),
            inputSchema: {
                type: 'object',
                properties: {
                    agent_name: { type: 'string', description: 'Name of the Mindcraft bot.' },
                    id: { type: 'string', description: 'Unique rule identifier (use to update or remove later).' },
                    pattern: { type: 'string', description: 'JavaScript regex string to match against the chat message.' },
                    command: { type: 'string', description: 'Mindcraft command to dispatch on match. Supports {sender} and {message}.' },
                },
                required: ['agent_name', 'id', 'pattern', 'command'],
            },
        },
        {
            name: 'remove_chat_rule',
            description: 'Remove a previously registered chat rule by its id.',
            inputSchema: {
                type: 'object',
                properties: {
                    agent_name: { type: 'string' },
                    id: { type: 'string', description: 'Rule id to remove.' },
                },
                required: ['agent_name', 'id'],
            },
        },
        {
            name: 'list_chat_rules',
            description: 'Return all active chat rules for the agent (id, pattern, command).',
            inputSchema: {
                type: 'object',
                properties: {
                    agent_name: { type: 'string' },
                },
                required: ['agent_name'],
            },
        },
        {
            name: 'clear_chat_rules',
            description: 'Remove all chat rules for the agent.',
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
 * Handle a chat-rule tool call.
 *
 * @param {string} name
 * @param {object} args
 * @param {import('../bridge.js').MindServerBridge} bridge
 * @returns {object|null} MCP response object, or null if name is not a chat-rule tool.
 */
export function handleChatRules(name, args, bridge) {
    switch (name) {
        case 'add_chat_rule': {
            try {
                void new RegExp(args.pattern, 'i');
            } catch (e) {
                return err(`Invalid regex pattern "${args.pattern}": ${e.message}`);
            }
            if (!args.command.startsWith('!')) {
                return err(`Command must start with "!". Got: "${args.command}"`);
            }
            bridge.addChatRule(args.agent_name, args.id, args.pattern, args.command);
            return ok(
                `Chat rule "${args.id}" added for "${args.agent_name}".\n` +
                `Pattern: /${args.pattern}/i\n` +
                `Command: ${args.command}`
            );
        }

        case 'remove_chat_rule':
            bridge.removeChatRule(args.agent_name, args.id);
            return ok(`Chat rule "${args.id}" removed from "${args.agent_name}".`);

        case 'list_chat_rules': {
            const rules = bridge.listChatRules(args.agent_name);
            if (rules.length === 0) return ok(`No chat rules registered for "${args.agent_name}".`);
            return ok(JSON.stringify(rules, null, 2));
        }

        case 'clear_chat_rules':
            bridge.clearChatRules(args.agent_name);
            return ok(`All chat rules cleared for "${args.agent_name}".`);

        default:
            return null;
    }
}
