import { describe, it, expect, beforeEach } from 'vitest';
import { createMockBridge } from './mock_bridge.js';
import { handleToolCall } from '../../src/mcp/tools/index.js';

describe('Chat rule tools', () => {
    let bridge;

    beforeEach(() => {
        bridge = createMockBridge();
    });

    describe('add_chat_rule', () => {
        it('adds a valid chat rule', async () => {
            const result = await handleToolCall('add_chat_rule', {
                agent_name: 'Andy',
                id: 'greet',
                pattern: 'hello',
                command: '!goToPlayer("{sender}", 2)',
            }, bridge);
            expect(result.isError).toBeFalsy();
            expect(result.content[0].text).toContain('greet');
            expect(bridge.listChatRules('Andy')).toHaveLength(1);
        });

        it('rejects invalid regex', async () => {
            const result = await handleToolCall('add_chat_rule', {
                agent_name: 'Andy',
                id: 'bad',
                pattern: '[invalid',
                command: '!stop()',
            }, bridge);
            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain('Invalid regex');
        });

        it('rejects commands without ! prefix', async () => {
            const result = await handleToolCall('add_chat_rule', {
                agent_name: 'Andy',
                id: 'bad',
                pattern: 'hello',
                command: 'goToPlayer("{sender}", 2)',
            }, bridge);
            expect(result.isError).toBe(true);
        });
    });

    describe('remove_chat_rule', () => {
        it('removes an existing rule', async () => {
            bridge.addChatRule('Andy', 'greet', 'hello', '!stop()');
            const result = await handleToolCall('remove_chat_rule', {
                agent_name: 'Andy',
                id: 'greet',
            }, bridge);
            expect(result.isError).toBeFalsy();
            expect(bridge.listChatRules('Andy')).toHaveLength(0);
        });
    });

    describe('list_chat_rules', () => {
        it('lists all rules', async () => {
            bridge.addChatRule('Andy', 'greet', 'hello', '!stop()');
            bridge.addChatRule('Andy', 'help', 'help', '!goToPlayer("{sender}", 2)');
            const result = await handleToolCall('list_chat_rules', {
                agent_name: 'Andy',
            }, bridge);
            expect(result.isError).toBeFalsy();
            const rules = JSON.parse(result.content[0].text);
            expect(rules).toHaveLength(2);
        });

        it('returns message when no rules', async () => {
            const result = await handleToolCall('list_chat_rules', {
                agent_name: 'Andy',
            }, bridge);
            expect(result.content[0].text).toContain('No chat rules');
        });
    });

    describe('clear_chat_rules', () => {
        it('removes all rules', async () => {
            bridge.addChatRule('Andy', 'greet', 'hello', '!stop()');
            bridge.addChatRule('Andy', 'help', 'help', '!stop()');
            const result = await handleToolCall('clear_chat_rules', {
                agent_name: 'Andy',
            }, bridge);
            expect(result.isError).toBeFalsy();
            expect(bridge.listChatRules('Andy')).toHaveLength(0);
        });
    });
});
