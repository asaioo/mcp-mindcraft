/**
 * Mindcraft MCP Server — entry point for Claude Code integration
 *
 * Architecture
 * ────────────
 * Claude Code  ←──MCP stdio──→  this server  ←──Socket.io──→  MindServer  ←──child proc──→  Andy (Mineflayer bot)
 *
 * No keys.json needed:
 *   Claude IS the brain. Commands sent via send_command execute directly on Andy
 *   without invoking any AI model. send_chat writes to Minecraft chat without AI.
 *
 * Startup order
 * ─────────────
 *   1. Start Minecraft server
 *   2. node main.js          ← starts MindServer + spawns Andy
 *   3. (Claude Code auto-starts this process via MCP config)
 *
 * "mindcraft:" prefix convention
 * ──────────────────────────────
 *   When you prefix a message to Claude with "mindcraft:", Claude will use the
 *   MCP tools below to act in Minecraft instead of just replying in chat.
 *   Example: "mindcraft: go collect 10 oak logs"
 *   → Claude calls list_commands, then send_command("Andy", '!collectBlocks("oak_log", 10)')
 *
 * Claude Code configuration  (~/.claude/settings.json)
 * ─────────────────────────
 *   {
 *     "mcpServers": {
 *       "mindcraft": {
 *         "command": "node",
 *         "args": ["/absolute/path/to/mindcraft/mcp.js"],
 *         "env": {}
 *       }
 *     }
 *   }
 *
 *   Non-default MindServer port:
 *     "args": ["...mcp.js", "--mindserver-port", "8081"]
 *
 * Available MCP tools
 * ───────────────────
 *   send_command       Execute a !command on Andy (no AI on Andy's side)
 *   send_chat          Andy says text in Minecraft chat (no AI)
 *   get_agent_state    Andy's position, health, inventory, nearby blocks/entities
 *   list_commands      Andy's available commands with arg docs
 *   get_bot_output     Recent output lines from Andy's process
 *   list_agents        All registered agents and status
 *   create_agent       Spawn a new bot
 *   stop_agent         Gracefully stop a bot
 *   start_agent        Restart a bot
 *   destroy_agent      Remove a bot entirely
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { startMcpServer } from './src/mcp/server.js';

const args = yargs(hideBin(process.argv))
    .option('mindserver-port', {
        type: 'number',
        default: 8080,
        describe: 'Port where MindServer is listening',
    })
    .help()
    .alias('help', 'h')
    .parse();

startMcpServer({ mindserverPort: args['mindserver-port'] }).catch((err) => {
    process.stderr.write(`[mindcraft-mcp] Fatal: ${err.message}\n${err.stack}\n`);
    process.exit(1);
});
