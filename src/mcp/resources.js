/**
 * MCP resource definitions and handlers for Mindcraft.
 *
 * Static resources:
 *   mindcraft://agents             — snapshot of all registered agents
 *
 * Resource templates (parameterised by agent name):
 *   mindcraft://agent/{name}/state     — latest full game-state snapshot
 *   mindcraft://agent/{name}/settings  — current agent settings
 *   mindcraft://agent/{name}/output    — recent bot-output buffer
 *
 * Security: no resource reads, surfaces, or references keys.json.
 */

export function getResourceDefinitions() {
    return [
        {
            uri: 'mindcraft://agents',
            name: 'Mindcraft Agents',
            description:
                'Live status list of every registered Mindcraft agent: ' +
                'name, in_game flag, viewer port, and socket connectivity.',
            mimeType: 'application/json',
        },
    ];
}

export function getResourceTemplates() {
    return [
        {
            uriTemplate: 'mindcraft://agent/{name}/state',
            name: 'Agent Game State',
            description:
                'Most recent full game-state snapshot for the named agent: ' +
                'position, health, inventory, nearby entities/blocks, current action, etc.',
            mimeType: 'application/json',
        },
        {
            uriTemplate: 'mindcraft://agent/{name}/settings',
            name: 'Agent Settings',
            description:
                'Current runtime settings for the named agent as stored in MindServer. ' +
                'Credentials are never included.',
            mimeType: 'application/json',
        },
        {
            uriTemplate: 'mindcraft://agent/{name}/output',
            name: 'Agent Bot Output',
            description: 'Buffered console/chat output lines from the named agent (up to 200 entries).',
            mimeType: 'application/json',
        },
    ];
}

/**
 * Handle a resource read request.
 *
 * @param {string} uri
 * @param {import('./bridge.js').MindServerBridge} bridge
 * @returns {Promise<{contents: Array<{uri:string, mimeType:string, text:string}>}>}
 */
export async function handleResourceRead(uri, bridge) {
    // Static: all agents
    if (uri === 'mindcraft://agents') {
        const agents = bridge.getAgents();
        return jsonResource(uri, agents);
    }

    // Parameterised templates
    const stateMatch = uri.match(/^mindcraft:\/\/agent\/([^/]+)\/state$/);
    if (stateMatch) {
        const name = decodeURIComponent(stateMatch[1]);
        const state = bridge.getAgentState(name);
        return jsonResource(
            uri,
            state ?? { error: `No state available for agent "${name}". Agent may not be in-game.` }
        );
    }

    const settingsMatch = uri.match(/^mindcraft:\/\/agent\/([^/]+)\/settings$/);
    if (settingsMatch) {
        const name = decodeURIComponent(settingsMatch[1]);
        try {
            const settings = await bridge.getAgentSettings(name);
            // Strip any credential-shaped keys before surfacing
            const safe = stripCredentials(settings);
            return jsonResource(uri, safe);
        } catch (e) {
            return jsonResource(uri, { error: e.message });
        }
    }

    const outputMatch = uri.match(/^mindcraft:\/\/agent\/([^/]+)\/output$/);
    if (outputMatch) {
        const name = decodeURIComponent(outputMatch[1]);
        const lines = bridge.getOutputBuffer(name, false);
        return jsonResource(uri, lines);
    }

    throw new Error(`Unknown resource URI: ${uri}`);
}

// ------------------------------------------------------------------ //
// Helpers
// ------------------------------------------------------------------ //

function jsonResource(uri, value) {
    return {
        contents: [
            {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(value, null, 2),
            },
        ],
    };
}

/** Remove any keys that look like credentials before surfacing settings. */
function stripCredentials(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const BLOCKED = new Set([
        'api_key', 'apiKey', 'api_secret', 'apiSecret',
        'password', 'token', 'secret', 'private_key',
    ]);
    const result = {};
    for (const [k, v] of Object.entries(obj)) {
        if (BLOCKED.has(k)) {
            result[k] = '[redacted]';
        } else if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
            result[k] = stripCredentials(v);
        } else {
            result[k] = v;
        }
    }
    return result;
}
