# MCP Mindcraft

Control Minecraft bots via [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) from Claude Code or any MCP-compatible client.

Built on top of [Mindcraft](https://github.com/mindcraft-bots/mindcraft) — a framework for AI-powered Minecraft bots using Mineflayer.

## How It Works

```
Claude Code ←─ MCP stdio ─→ MCP Server ←─ Socket.io ─→ MindServer ←─ child proc ─→ Bot (Mineflayer)
```

Claude acts as the brain. Commands sent via MCP are executed directly on the bot — no API key needed on the bot side. Bots can also run with their own AI models for autonomous behavior.

## Quick Start

### 1. Start Minecraft Server

Any Minecraft Java Edition server (vanilla, Paper, Fabric, etc.) on localhost.

### 2. Configure `settings.js`

```js
"host": "localhost",
"port": 55960,       // your MC server port, or -1 for LAN auto-discover
"auth": "offline",
```

### 3. Start MindServer + Bot

```bash
npm install
node main.js
```

### 4. Configure Claude Code

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "mindcraft": {
      "command": "node",
      "args": ["/absolute/path/to/mindcraft/mcp.js"]
    }
  }
}
```

### 5. Use from Claude Code

Prefix messages with `mindcraft:` to trigger MCP tool usage:

```
mindcraft: collect 10 oak logs
mindcraft: go to Steve and give him 5 diamonds
mindcraft: build a small house
```

## Multi-Model Support

Multiple agents with different AI models can run simultaneously in the same world:

| Model | Behavior |
|-------|----------|
| `"mcp"` (default) | No AI on bot side. Claude drives it via MCP tools. No API key needed. |
| `"gpt-4o"` | Bot has its own GPT-4o brain, responds autonomously to chat. |
| `"claude-3-5-sonnet"` | Bot uses Claude Sonnet for autonomous reasoning. |
| `"gemini-2.5-flash"` | Bot uses Gemini Flash. |
| Any Mindcraft-supported model | See Mindcraft docs for full list. |

Create agents with different models via the `create_agent` MCP tool:

```
mindcraft: create a GPT-4o bot named "Builder" and an MCP bot named "Miner"
```

## MCP Tools

### Interaction
| Tool | Description |
|------|-------------|
| `send_command` | Execute `!command(args)` directly on the bot (no AI) |
| `send_chat` | Make the bot say text in Minecraft chat |
| `get_agent_state` | Get position, health, inventory, nearby entities |
| `list_commands` | List all available bot commands with docs |

### Observation
| Tool | Description |
|------|-------------|
| `get_bot_output` | Read recent console output from the bot |
| `get_chat_events` | Read recent in-game chat messages |

### Chat Forwarding
| Tool | Description |
|------|-------------|
| `wait_for_chat` | Long-poll for new in-game chat messages (blocks until message arrives or timeout) |
| `send_to_model` | Forward a message through the bot's own AI pipeline |

Use `wait_for_chat` in a loop for reactive chat handling:
1. Call `wait_for_chat` — blocks until a player speaks
2. Read the message, decide how to respond
3. Use `send_command` or `send_chat` to act
4. Call `wait_for_chat` again

Use `send_to_model` when the bot has its own AI model and you want it to handle a request autonomously.

### Chat Rules
| Tool | Description |
|------|-------------|
| `add_chat_rule` | Auto-execute a command when chat matches a regex pattern |
| `remove_chat_rule` | Remove a chat rule by ID |
| `list_chat_rules` | List all active rules |
| `clear_chat_rules` | Remove all rules |

Example: whenever someone says "help", the bot walks to them:
```
pattern: "help"
command: !goToPlayer("{sender}", 2)
```

### Agent Lifecycle
| Tool | Description |
|------|-------------|
| `list_agents` | List all agents and their status |
| `create_agent` | Spawn a new bot (any model) |
| `stop_agent` | Gracefully stop a bot |
| `start_agent` | Restart a bot |
| `destroy_agent` | Remove a bot permanently |

## MCP Resources

| URI | Description |
|-----|-------------|
| `mindcraft://agents` | All agents and their status |
| `mindcraft://agent/{name}/state` | Live game state |
| `mindcraft://agent/{name}/settings` | Agent settings (credentials redacted) |
| `mindcraft://agent/{name}/output` | Recent bot output |

## Project Structure

```
mcp.js                      # MCP server entry point (stdio transport)
src/mcp/
  server.js                 # MCP server setup, connects bridge + handlers
  bridge.js                 # Socket.io client wrapping MindServer events
  resources.js              # MCP resource definitions
  tools/
    index.js                # Aggregates all tool modules
    helpers.js              # Shared ok/err/checkAgentReady helpers
    interaction.js          # send_command, send_chat, get_agent_state, list_commands
    observation.js          # get_bot_output, get_chat_events
    chat_rules.js           # add/remove/list/clear chat rules
    chat_forward.js         # wait_for_chat, send_to_model
    lifecycle.js            # list/create/stop/start/destroy agents
src/models/mcp.js           # Dummy model class for MCP-only bots (no API calls)
```

## Development

```bash
npm test              # run tests
npm run test:watch    # run tests in watch mode
```

Tests use [Vitest](https://vitest.dev/) with mocked bridge objects — no Minecraft server needed.

## License

MIT — see [LICENSE](LICENSE).

Based on [Mindcraft](https://github.com/mindcraft-bots/mindcraft) by Kolby Nottingham (MIT).
