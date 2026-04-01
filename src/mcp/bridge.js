/**
 * MindServerBridge — Socket.io client that wraps MindServer events as
 * async Promise-based calls for use by the MCP server.
 *
 * Security: this client never loads, reads, or forwards keys.json.
 * Model credentials stay inside each agent's profile and are never
 * surfaced through any method here.
 *
 * Architecture note:
 *   - send_command  → send-message → agent.handleMessage → executeCommand()
 *                     (command path: no AI call, executes directly)
 *   - send_chat     → direct-chat  → agent.openChat()
 *                     (text appears in Minecraft without AI)
 *   - get_commands  → get-commands → agent getCommandDocs()
 */

import { io } from 'socket.io-client';

export class MindServerBridge {
    constructor(port = 8080) {
        this.port = port;
        this.socket = null;
        this.connected = false;
        /** @type {Array<{name:string, in_game:boolean, viewerPort:number, socket_connected:boolean}>} */
        this.agents = [];
        /** @type {Record<string, Array<{timestamp:number, message:string}>>} */
        this.outputBuffer = {};
        /** @type {Record<string, object|null>} */
        this.latestStates = {};
        /** @type {Record<string, Array<{sender:string, message:string, timestamp:number}>>} */
        this.chatBuffer = {};
        /**
         * Chat rules: when an incoming chat event matches the pattern the command is auto-dispatched.
         * @type {Record<string, Record<string, {pattern:RegExp, command:string}>>}
         */
        this.chatRules = {};
        this._listeningToAgents = false;
        /** @type {Record<string, Array<(events: Array) => void>>} */
        this._chatWaiters = {};
    }

    async connect() {
        if (this.connected) return;

        this.socket = io(`http://localhost:${this.port}`, {
            reconnection: true,
            reconnectionDelay: 2000,
            reconnectionAttempts: Infinity,
        });

        // Attach all persistent handlers BEFORE awaiting the connection promise
        // so they survive a failed initial connect and fire correctly on later reconnects.
        this.socket.on('disconnect', (reason) => {
            this.connected = false;
            process.stderr.write(`[MCP Bridge] Disconnected from MindServer: ${reason}\n`);
        });

        // socket.io v4: 'connect' fires on every (re)connect, 'reconnect' fires after a disconnect.
        // Handle both so we resume properly whether starting in degraded mode or after a drop.
        this.socket.on('reconnect', () => {
            this.connected = true;
            process.stderr.write('[MCP Bridge] Reconnected to MindServer.\n');
            this._resumeListening();
        });

        this.socket.on('agents-status', (agents) => {
            this.agents = agents;
        });

        this.socket.on('bot-output', (agentName, message) => {
            const buf = this.outputBuffer[agentName] ?? [];
            buf.push({ timestamp: Date.now(), message });
            if (buf.length > 200) buf.shift();
            this.outputBuffer[agentName] = buf;
        });

        this.socket.on('state-update', (states) => {
            for (const [name, state] of Object.entries(states)) {
                this.latestStates[name] = state;
            }
        });

        this.socket.on('chat-event', (agentName, event) => {
            const buf = this.chatBuffer[agentName] ?? [];
            buf.push(event);
            if (buf.length > 200) buf.shift();
            this.chatBuffer[agentName] = buf;

            // Notify any waitForChat waiters
            const waiters = this._chatWaiters[agentName];
            if (waiters && waiters.length > 0) {
                for (const resolve of waiters) {
                    resolve([event]);
                }
                this._chatWaiters[agentName] = [];
            }

            // Evaluate registered chat rules and auto-dispatch matching commands.
            const rules = this.chatRules[agentName];
            if (rules) {
                for (const rule of Object.values(rules)) {
                    if (rule.pattern.test(event.message)) {
                        const cmd = rule.command
                            .replace(/\{sender\}/g, event.sender)
                            .replace(/\{message\}/g, event.message);
                        process.stderr.write(`[MCP Bridge] Chat rule matched: ${cmd}\n`);
                        this.sendCommand(agentName, cmd);
                    }
                }
            }
        });

        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`Timed out connecting to MindServer on port ${this.port}`));
            }, 10_000);

            this.socket.once('connect', () => {
                clearTimeout(timeout);
                resolve();
            });
            this.socket.once('connect_error', (err) => {
                clearTimeout(timeout);
                reject(new Error(`Cannot connect to MindServer: ${err.message}`));
            });
        });

        this.connected = true;
        this._startListening();
    }

    _startListening() {
        if (this._listeningToAgents) return;
        this.socket.emit('listen-to-agents');
        this._listeningToAgents = true;
    }

    _resumeListening() {
        this._listeningToAgents = false;
        this._startListening();
    }

    // ------------------------------------------------------------------ //
    // Agent lifecycle
    // ------------------------------------------------------------------ //

    async createAgent(settings) {
        return new Promise((resolve, reject) => {
            const t = setTimeout(() => reject(new Error('create-agent timed out after 30s')), 30_000);
            this.socket.emit('create-agent', settings, (result) => {
                clearTimeout(t);
                resolve(result);
            });
        });
    }

    startAgent(agentName) {
        this.socket.emit('start-agent', agentName);
    }

    stopAgent(agentName) {
        this.socket.emit('stop-agent', agentName);
    }

    destroyAgent(agentName) {
        this.socket.emit('destroy-agent', agentName);
        delete this.latestStates[agentName];
        delete this.outputBuffer[agentName];
    }

    restartAgent(agentName) {
        this.socket.emit('restart-agent', agentName);
    }

    // ------------------------------------------------------------------ //
    // Primary MCP interaction methods
    // ------------------------------------------------------------------ //

    /**
     * Send a Mindcraft command to the named agent (e.g. `!goToPlayer("Player1", 3)`).
     * Uses the existing send-message path. Because the message contains a
     * recognised `!commandName(...)` pattern, agent.handleMessage() executes
     * it DIRECTLY — no AI model call is made.
     *
     * @param {string} agentName
     * @param {string} command  - full command string, e.g. `!collectBlocks("oak_log", 5)`
     */
    sendCommand(agentName, command) {
        this.socket.emit('send-message', agentName, { from: 'mcp', message: command });
    }

    /**
     * Make the named agent say text in Minecraft chat without invoking its AI model.
     * Routes through the direct-chat socket event.
     *
     * @param {string} agentName
     * @param {string} message
     */
    directChat(agentName, message) {
        this.socket.emit('direct-chat', agentName, message);
    }

    /**
     * Forward an arbitrary message to Andy (for non-command text that should
     * go through Andy's AI pipeline if he has one configured).
     *
     * @param {string} agentName
     * @param {{from:string, message:string}} data
     */
    sendMessage(agentName, data) {
        this.socket.emit('send-message', agentName, data);
    }

    // ------------------------------------------------------------------ //
    // State / settings / commands queries
    // ------------------------------------------------------------------ //

    async getAgentSettings(agentName) {
        return new Promise((resolve, reject) => {
            const t = setTimeout(() => reject(new Error('get-settings timed out')), 5_000);
            this.socket.emit('get-settings', agentName, (response) => {
                clearTimeout(t);
                if (response.error) reject(new Error(response.error));
                else resolve(response.settings);
            });
        });
    }

    /**
     * Fetch command documentation string from the live agent.
     * @param {string} agentName
     * @returns {Promise<string>}
     */
    async getCommands(agentName) {
        return new Promise((resolve, reject) => {
            const t = setTimeout(() => reject(new Error('get-commands timed out')), 5_000);
            this.socket.emit('get-commands', agentName, (response) => {
                clearTimeout(t);
                if (response.error) reject(new Error(response.error));
                else resolve(response.docs ?? '');
            });
        });
    }

    getAgentState(agentName) {
        return this.latestStates[agentName] ?? null;
    }

    getAgents() {
        return this.agents;
    }

    // ------------------------------------------------------------------ //
    // Output buffer
    // ------------------------------------------------------------------ //

    getOutputBuffer(agentName, clear = false) {
        const buf = this.outputBuffer[agentName] ?? [];
        if (clear) this.outputBuffer[agentName] = [];
        return buf;
    }

    getChatBuffer(agentName, clear = false) {
        const buf = this.chatBuffer[agentName] ?? [];
        if (clear) this.chatBuffer[agentName] = [];
        return buf;
    }

    // ------------------------------------------------------------------ //
    // Chat rules
    // ------------------------------------------------------------------ //

    /**
     * Register a chat rule. When an incoming chat message matches `patternSource`
     * (a JS regex string), `command` is dispatched to the agent.
     * `{sender}` and `{message}` in the command string are replaced at match time.
     */
    addChatRule(agentName, id, patternSource, command) {
        if (!this.chatRules[agentName]) this.chatRules[agentName] = {};
        this.chatRules[agentName][id] = { pattern: new RegExp(patternSource, 'i'), command };
    }

    removeChatRule(agentName, id) {
        if (this.chatRules[agentName]) {
            delete this.chatRules[agentName][id];
        }
    }

    listChatRules(agentName) {
        const rules = this.chatRules[agentName] ?? {};
        return Object.entries(rules).map(([id, r]) => ({
            id,
            pattern: r.pattern.source,
            command: r.command,
        }));
    }

    clearChatRules(agentName) {
        this.chatRules[agentName] = {};
    }

    /**
     * Long-poll for new chat messages. Resolves when a message arrives or timeout.
     * @param {string} agentName
     * @param {number} timeoutMs
     * @returns {Promise<Array<{sender:string, message:string, timestamp:number}>>}
     */
    waitForChat(agentName, timeoutMs = 30000) {
        return new Promise((resolve) => {
            const timer = setTimeout(() => {
                // Remove this waiter on timeout
                const waiters = this._chatWaiters[agentName];
                if (waiters) {
                    const idx = waiters.indexOf(resolveWrapper);
                    if (idx !== -1) waiters.splice(idx, 1);
                }
                resolve([]);
            }, timeoutMs);

            const resolveWrapper = (events) => {
                clearTimeout(timer);
                resolve(events);
            };

            if (!this._chatWaiters[agentName]) this._chatWaiters[agentName] = [];
            this._chatWaiters[agentName].push(resolveWrapper);
        });
    }

    isConnected() {
        return this.connected || (this.socket?.connected ?? false);
    }
}
