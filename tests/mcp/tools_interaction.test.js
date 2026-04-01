import { describe, it, expect, beforeEach } from 'vitest';
import { createMockBridge } from './mock_bridge.js';

// These imports will point to the new modular structure
import { getToolDefinitions, handleToolCall } from '../../src/mcp/tools/index.js';

describe('Interaction tools', () => {
    let bridge;

    beforeEach(() => {
        bridge = createMockBridge();
    });

    describe('send_command', () => {
        it('sends a valid command to the agent', async () => {
            const result = await handleToolCall('send_command', {
                agent_name: 'Andy',
                command: '!collectBlocks("oak_log", 5)',
            }, bridge);
            expect(result.isError).toBeFalsy();
            expect(result.content[0].text).toContain('Command sent');
            expect(bridge.commandsSent).toHaveLength(1);
            expect(bridge.commandsSent[0].command).toBe('!collectBlocks("oak_log", 5)');
        });

        it('rejects commands without ! prefix', async () => {
            const result = await handleToolCall('send_command', {
                agent_name: 'Andy',
                command: 'collectBlocks("oak_log", 5)',
            }, bridge);
            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain('must start with "!"');
        });

        it('fails when agent is not in game', async () => {
            const result = await handleToolCall('send_command', {
                agent_name: 'Bob',
                command: '!stop()',
            }, bridge);
            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain('not in-game');
        });

        it('fails when agent does not exist', async () => {
            const result = await handleToolCall('send_command', {
                agent_name: 'Unknown',
                command: '!stop()',
            }, bridge);
            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain('not found');
        });
    });

    describe('send_chat', () => {
        it('sends chat message to agent', async () => {
            const result = await handleToolCall('send_chat', {
                agent_name: 'Andy',
                message: 'Hello everyone!',
            }, bridge);
            expect(result.isError).toBeFalsy();
            expect(bridge.chatsSent).toHaveLength(1);
            expect(bridge.chatsSent[0].message).toBe('Hello everyone!');
        });
    });

    describe('get_agent_state', () => {
        it('returns state for in-game agent', async () => {
            const result = await handleToolCall('get_agent_state', {
                agent_name: 'Andy',
            }, bridge);
            expect(result.isError).toBeFalsy();
            const state = JSON.parse(result.content[0].text);
            expect(state.health).toBe(20);
            expect(state.position.x).toBe(100);
        });

        it('returns message for unknown agent', async () => {
            const result = await handleToolCall('get_agent_state', {
                agent_name: 'Unknown',
            }, bridge);
            expect(result.isError).toBeFalsy();
            expect(result.content[0].text).toContain('No state available');
        });
    });

    describe('list_commands', () => {
        it('returns command docs for agent', async () => {
            const result = await handleToolCall('list_commands', {
                agent_name: 'Andy',
            }, bridge);
            expect(result.isError).toBeFalsy();
            expect(result.content[0].text).toContain('goToPlayer');
        });
    });
});

describe('Tool definitions', () => {
    it('returns all tool definitions', () => {
        const tools = getToolDefinitions();
        expect(tools.length).toBeGreaterThan(10);
        const names = tools.map(t => t.name);
        expect(names).toContain('send_command');
        expect(names).toContain('send_chat');
        expect(names).toContain('get_agent_state');
        expect(names).toContain('list_commands');
        expect(names).toContain('list_agents');
        expect(names).toContain('wait_for_chat');
        expect(names).toContain('send_to_model');
    });

    it('all tools have required fields', () => {
        const tools = getToolDefinitions();
        for (const tool of tools) {
            expect(tool.name).toBeDefined();
            expect(tool.description).toBeDefined();
            expect(tool.inputSchema).toBeDefined();
            expect(tool.inputSchema.type).toBe('object');
        }
    });
});

describe('Connection check', () => {
    it('returns error when bridge disconnected', async () => {
        const bridge = createMockBridge({ connected: false });
        const result = await handleToolCall('send_command', {
            agent_name: 'Andy',
            command: '!stop()',
        }, bridge);
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('not connected');
    });
});
