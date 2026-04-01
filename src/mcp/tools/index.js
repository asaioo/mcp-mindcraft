/**
 * MCP tool aggregator — collects definitions and handlers from all tool modules.
 *
 * Tool categories:
 *   interaction   — send_command, send_chat, get_agent_state, list_commands
 *   observation   — get_bot_output, get_chat_events
 *   chat_rules    — add/remove/list/clear chat rules
 *   chat_forward  — wait_for_chat, send_to_model
 *   lifecycle     — list/create/stop/start/destroy agents
 */

import { interactionToolDefs, handleInteraction } from './interaction.js';
import { observationToolDefs, handleObservation } from './observation.js';
import { chatRuleToolDefs, handleChatRules } from './chat_rules.js';
import { chatForwardToolDefs, handleChatForward } from './chat_forward.js';
import { lifecycleToolDefs, handleLifecycle } from './lifecycle.js';
import { err } from './helpers.js';

/**
 * Return all tool definitions from every module.
 * @returns {object[]}
 */
export function getToolDefinitions() {
    return [
        ...interactionToolDefs(),
        ...observationToolDefs(),
        ...chatRuleToolDefs(),
        ...chatForwardToolDefs(),
        ...lifecycleToolDefs(),
    ];
}

// Handler chain — each handler returns null if it doesn't own the tool name.
const handlers = [
    handleInteraction,
    handleObservation,
    handleChatRules,
    handleChatForward,
    handleLifecycle,
];

/**
 * Dispatch an MCP tool call to the appropriate handler module.
 *
 * @param {string} name
 * @param {object} args
 * @param {import('../bridge.js').MindServerBridge} bridge
 */
export async function handleToolCall(name, args, bridge) {
    if (!bridge.isConnected()) {
        return err('MCP bridge is not connected to MindServer. Start MindServer first (node main.js).');
    }

    for (const handler of handlers) {
        const result = await handler(name, args, bridge);
        if (result !== null) return result;
    }

    return err(`Unknown tool: ${name}`);
}
