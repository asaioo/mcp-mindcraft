import { describe, it, expect, beforeEach } from 'vitest';
import { createMockBridge } from './mock_bridge.js';
import { handleToolCall } from '../../src/mcp/tools/index.js';

describe('Chat forwarding tools', () => {
    let bridge;

    beforeEach(() => {
        bridge = createMockBridge();
    });

    describe('wait_for_chat', () => {
        it('returns new chat messages when they arrive', async () => {
            // Simulate a message arriving after 50ms
            setTimeout(() => {
                bridge._simulateChat('Andy', 'Steve', 'help me build a house');
            }, 50);

            const result = await handleToolCall('wait_for_chat', {
                agent_name: 'Andy',
                timeout: 2000,
            }, bridge);

            expect(result.isError).toBeFalsy();
            expect(result.content[0].text).toContain('Steve');
            expect(result.content[0].text).toContain('help me build a house');
        });

        it('returns timeout message when no chat arrives', async () => {
            const result = await handleToolCall('wait_for_chat', {
                agent_name: 'Andy',
                timeout: 100,
            }, bridge);

            expect(result.isError).toBeFalsy();
            expect(result.content[0].text).toContain('No new chat');
        });

        it('fails when agent not in game', async () => {
            const result = await handleToolCall('wait_for_chat', {
                agent_name: 'Bob',
                timeout: 100,
            }, bridge);
            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain('not in-game');
        });
    });

    describe('send_to_model', () => {
        it('forwards a message through the agent AI pipeline', async () => {
            const result = await handleToolCall('send_to_model', {
                agent_name: 'Andy',
                message: 'What should I do next?',
                sender: 'Steve',
            }, bridge);
            expect(result.isError).toBeFalsy();
            expect(result.content[0].text).toContain('forwarded');
            // Verify it used sendMessage (not sendCommand)
            expect(bridge.messagesSent).toHaveLength(1);
            expect(bridge.messagesSent[0].data.message).toBe('What should I do next?');
            expect(bridge.messagesSent[0].data.from).toBe('Steve');
        });

        it('defaults sender to "player"', async () => {
            const result = await handleToolCall('send_to_model', {
                agent_name: 'Andy',
                message: 'Go mine diamonds',
            }, bridge);
            expect(result.isError).toBeFalsy();
            expect(bridge.messagesSent[0].data.from).toBe('player');
        });

        it('fails when agent not in game', async () => {
            const result = await handleToolCall('send_to_model', {
                agent_name: 'Bob',
                message: 'hello',
            }, bridge);
            expect(result.isError).toBe(true);
        });
    });
});
