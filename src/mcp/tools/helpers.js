/**
 * Shared response helpers for MCP tool handlers.
 */

export function ok(text) {
    return { content: [{ type: 'text', text }] };
}

export function err(text) {
    return { content: [{ type: 'text', text }], isError: true };
}

/**
 * Build a settings object for createAgent from raw MCP tool args.
 *
 * @param {object} args - Raw args from the create_agent tool call.
 * @returns {object} Settings object ready to pass to bridge.createAgent().
 */
/**
 * Returns an error message string if the agent is not ready to receive commands,
 * or null if it is ready.
 * @param {import('../bridge.js').MindServerBridge} bridge
 * @param {string} agentName
 * @returns {string|null}
 */
export function checkAgentReady(bridge, agentName) {
    const agents = bridge.getAgents();
    const agent = agents.find((a) => a.name === agentName);
    if (!agent) return `Agent "${agentName}" not found. Use list_agents to see available agents.`;
    if (!agent.socket_connected) return `Agent "${agentName}" is registered but not connected to MindServer.`;
    if (!agent.in_game) return `Agent "${agentName}" is connected but not in-game yet.`;
    return null;
}

export function buildSettings(args) {
    const settings = { profile: args.profile };
    for (const key of ['host', 'port', 'minecraft_version', 'auth', 'load_memory', 'init_message']) {
        if (args[key] !== undefined) settings[key] = args[key];
    }
    return settings;
}
