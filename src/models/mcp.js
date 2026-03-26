/**
 * Dummy model for MCP-controlled agents.
 *
 * When Andy is driven entirely by Claude via MCP tools (send_command /
 * send_chat), no local AI model is needed. This stub satisfies the Prompter
 * interface so the agent boots normally without any API key.
 *
 * sendRequest returns an empty string — the agent won't respond to plain chat,
 * but !commands sent via MCP's send_command tool still execute directly through
 * agent.handleMessage() without ever reaching this model.
 */

export class MCP {
    static prefix = 'mcp';

    constructor() {}

    async sendRequest(_turns, _systemMessage) {
        return '';
    }

    async sendVisionRequest(_turns, _systemMessage, _imageBuffer) {
        return '';
    }

    async embed(_text) {
        return [];
    }
}
