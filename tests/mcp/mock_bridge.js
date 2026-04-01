/**
 * Mock MindServerBridge for testing MCP tools without a real socket connection.
 */
export function createMockBridge(overrides = {}) {
    const agents = overrides.agents ?? [
        { name: 'Andy', in_game: true, socket_connected: true, viewerPort: 3000 },
        { name: 'Bob', in_game: false, socket_connected: true, viewerPort: 3001 },
    ];

    const outputBuffer = overrides.outputBuffer ?? {
        Andy: [
            { timestamp: 1000, message: 'Collecting oak_log...' },
            { timestamp: 2000, message: 'Collected 5 oak_log.' },
        ],
    };

    const chatBuffer = overrides.chatBuffer ?? {
        Andy: [
            { sender: 'Steve', message: 'hello', timestamp: 1000 },
            { sender: 'Alex', message: 'help me', timestamp: 2000 },
        ],
    };

    const latestStates = overrides.latestStates ?? {
        Andy: {
            position: { x: 100, y: 64, z: 200 },
            health: 20,
            food: 18,
            inventory: [{ name: 'oak_log', count: 5 }],
        },
    };

    const chatRules = {};
    const commandsSent = [];
    const chatsSent = [];
    const messagesSent = [];
    let _connected = overrides.connected ?? true;
    let _commandDocs = overrides.commandDocs ?? '!goToPlayer(player_name, closeness)\n!collectBlocks(type, num)';
    let _createResult = overrides.createResult ?? { success: true };
    // For wait_for_chat
    const _chatWaiters = {};

    return {
        // State
        agents,
        outputBuffer,
        chatBuffer,
        latestStates,
        chatRules,
        commandsSent,
        chatsSent,
        messagesSent,
        _chatWaiters,

        // Connection
        isConnected: () => _connected,
        setConnected: (v) => { _connected = v; },

        // Agent queries
        getAgents: () => agents,
        getAgentState: (name) => latestStates[name] ?? null,

        // Interaction
        sendCommand: (agentName, command) => {
            commandsSent.push({ agentName, command });
        },
        directChat: (agentName, message) => {
            chatsSent.push({ agentName, message });
        },
        sendMessage: (agentName, data) => {
            messagesSent.push({ agentName, data });
        },

        // Queries
        getCommands: async (agentName) => {
            if (!agents.find(a => a.name === agentName)) throw new Error('Agent not found');
            return _commandDocs;
        },
        getAgentSettings: async (agentName) => {
            const agent = agents.find(a => a.name === agentName);
            if (!agent) throw new Error('Agent not found');
            return { name: agentName, model: 'mcp', api_key: 'secret123' };
        },

        // Buffers
        getOutputBuffer: (agentName, clear = false) => {
            const buf = outputBuffer[agentName] ?? [];
            if (clear) outputBuffer[agentName] = [];
            return buf;
        },
        getChatBuffer: (agentName, clear = false) => {
            const buf = chatBuffer[agentName] ?? [];
            if (clear) chatBuffer[agentName] = [];
            return buf;
        },

        // Chat rules
        addChatRule: (agentName, id, patternSource, command) => {
            if (!chatRules[agentName]) chatRules[agentName] = {};
            chatRules[agentName][id] = { pattern: new RegExp(patternSource, 'i'), command };
        },
        removeChatRule: (agentName, id) => {
            if (chatRules[agentName]) delete chatRules[agentName][id];
        },
        listChatRules: (agentName) => {
            const rules = chatRules[agentName] ?? {};
            return Object.entries(rules).map(([id, r]) => ({
                id, pattern: r.pattern.source, command: r.command,
            }));
        },
        clearChatRules: (agentName) => {
            chatRules[agentName] = {};
        },

        // Lifecycle
        createAgent: async (settings) => _createResult,
        stopAgent: (name) => { commandsSent.push({ agentName: name, command: '__stop__' }); },
        startAgent: (name) => { commandsSent.push({ agentName: name, command: '__start__' }); },
        destroyAgent: (name) => { commandsSent.push({ agentName: name, command: '__destroy__' }); },

        // Wait for chat (new feature)
        waitForChat: (agentName, timeoutMs = 30000) => {
            return new Promise((resolve) => {
                const timer = setTimeout(() => {
                    delete _chatWaiters[agentName];
                    resolve([]);
                }, timeoutMs);
                _chatWaiters[agentName] = (events) => {
                    clearTimeout(timer);
                    delete _chatWaiters[agentName];
                    resolve(events);
                };
            });
        },
        // Simulate incoming chat (for tests)
        _simulateChat: (agentName, sender, message) => {
            const event = { sender, message, timestamp: Date.now() };
            const buf = chatBuffer[agentName] ?? [];
            buf.push(event);
            chatBuffer[agentName] = buf;
            if (_chatWaiters[agentName]) {
                _chatWaiters[agentName]([event]);
            }
        },
    };
}
