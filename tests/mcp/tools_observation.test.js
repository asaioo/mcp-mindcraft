import { describe, it, expect, beforeEach } from 'vitest';
import { createMockBridge } from './mock_bridge.js';
import { handleToolCall } from '../../src/mcp/tools/index.js';

describe('Observation tools', () => {
    let bridge;

    beforeEach(() => {
        bridge = createMockBridge();
    });

    describe('get_bot_output', () => {
        it('returns buffered output lines', async () => {
            const result = await handleToolCall('get_bot_output', {
                agent_name: 'Andy',
            }, bridge);
            expect(result.isError).toBeFalsy();
            expect(result.content[0].text).toContain('Collected 5 oak_log');
        });

        it('respects limit parameter', async () => {
            const result = await handleToolCall('get_bot_output', {
                agent_name: 'Andy',
                limit: 1,
            }, bridge);
            expect(result.isError).toBeFalsy();
            // should only have the last line
            const lines = result.content[0].text.split('\n');
            expect(lines).toHaveLength(1);
        });

        it('clears buffer when clear=true', async () => {
            await handleToolCall('get_bot_output', {
                agent_name: 'Andy',
                clear: true,
            }, bridge);
            const result = await handleToolCall('get_bot_output', {
                agent_name: 'Andy',
            }, bridge);
            expect(result.content[0].text).toContain('No output buffered');
        });

        it('returns empty message for unknown agent', async () => {
            const result = await handleToolCall('get_bot_output', {
                agent_name: 'Unknown',
            }, bridge);
            expect(result.content[0].text).toContain('No output buffered');
        });
    });

    describe('get_chat_events', () => {
        it('returns buffered chat events', async () => {
            const result = await handleToolCall('get_chat_events', {
                agent_name: 'Andy',
            }, bridge);
            expect(result.isError).toBeFalsy();
            expect(result.content[0].text).toContain('Steve');
            expect(result.content[0].text).toContain('hello');
        });

        it('respects limit parameter', async () => {
            const result = await handleToolCall('get_chat_events', {
                agent_name: 'Andy',
                limit: 1,
            }, bridge);
            const lines = result.content[0].text.split('\n');
            expect(lines).toHaveLength(1);
        });

        it('clears buffer when clear=true', async () => {
            await handleToolCall('get_chat_events', {
                agent_name: 'Andy',
                clear: true,
            }, bridge);
            const result = await handleToolCall('get_chat_events', {
                agent_name: 'Andy',
            }, bridge);
            expect(result.content[0].text).toContain('No chat events');
        });
    });
});
