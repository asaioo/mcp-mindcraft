import { describe, it, expect, beforeEach } from 'vitest';
import { createMockBridge } from './mock_bridge.js';
import { handleToolCall } from '../../src/mcp/tools/index.js';

describe('Lifecycle tools', () => {
    let bridge;

    beforeEach(() => {
        bridge = createMockBridge();
    });

    describe('list_agents', () => {
        it('returns all agents', async () => {
            const result = await handleToolCall('list_agents', {}, bridge);
            expect(result.isError).toBeFalsy();
            const agents = JSON.parse(result.content[0].text);
            expect(agents).toHaveLength(2);
            expect(agents[0].name).toBe('Andy');
            expect(agents[1].name).toBe('Bob');
        });
    });

    describe('create_agent', () => {
        it('creates an agent with mcp model (no key needed)', async () => {
            const result = await handleToolCall('create_agent', {
                profile: { name: 'Charlie', model: 'mcp' },
            }, bridge);
            expect(result.isError).toBeFalsy();
            expect(result.content[0].text).toContain('Charlie');
        });

        it('creates an agent with a real model', async () => {
            const result = await handleToolCall('create_agent', {
                profile: { name: 'GPTBot', model: 'gpt-4o' },
            }, bridge);
            expect(result.isError).toBeFalsy();
            expect(result.content[0].text).toContain('GPTBot');
        });

        it('reports failure from bridge', async () => {
            const failBridge = createMockBridge({
                createResult: { success: false, error: 'Agent already exists' },
            });
            const result = await handleToolCall('create_agent', {
                profile: { name: 'Andy' },
            }, failBridge);
            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain('already exists');
        });
    });

    describe('stop_agent', () => {
        it('sends stop signal', async () => {
            const result = await handleToolCall('stop_agent', {
                agent_name: 'Andy',
            }, bridge);
            expect(result.isError).toBeFalsy();
            expect(result.content[0].text).toContain('Stop signal');
        });
    });

    describe('start_agent', () => {
        it('sends start signal', async () => {
            const result = await handleToolCall('start_agent', {
                agent_name: 'Andy',
            }, bridge);
            expect(result.isError).toBeFalsy();
            expect(result.content[0].text).toContain('Start signal');
        });
    });

    describe('destroy_agent', () => {
        it('destroys an agent', async () => {
            const result = await handleToolCall('destroy_agent', {
                agent_name: 'Andy',
            }, bridge);
            expect(result.isError).toBeFalsy();
            expect(result.content[0].text).toContain('destroyed');
        });
    });
});
