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
        this._listeningToAgents = false;
    }

    async connect() {
        if (this.connected) return;

        this.socket = io(`http://localhost:${this.port}`, {
            reconnection: true,
            reconnectionDelay: 2000,
            reconnectionAttempts: Infinity,
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

        this.socket.on('disconnect', (reason) => {
            this.connected = false;
            process.stderr.write(`[MCP Bridge] Disconnected from MindServer: ${reason}\n`);
        });

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
     * Send a Mindcraft command to Andy (e.g. `!goToPlayer("Player1", 3)`).
     * Uses the existing send-message path. Because the message contains a
     * recognised `!commandName(...)` pattern, agent.handleMessage() executes
     * it DIRECTLY — no AI model call is made.
     *
     * @param {string} agentName
     * @param {string} command  - full command string, e.g. `!collectBlocks("oak_log", 5)`
     */
    sendCommand(agentName, command) {
        this.socket.emit('send-message', agentName, { from: 'claude', message: command });
    }

    /**
     * Make Andy say text in Minecraft chat without invoking his AI model.
     * Routes through the new direct-chat socket event.
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

    isConnected() {
        return this.connected;
    }
}
