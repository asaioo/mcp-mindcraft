# Changes Made

## Goal
Enable Claude to control Andy in Minecraft via MCP tools — no keys.json required on Andy's side.

---

## New Files

### `mcp.js`
Entry point for the MCP server. Parses `--mindserver-port` arg (default 8080) and starts the server. Documents the `mindcraft:` prefix convention for Claude Code.

### `src/mcp/server.js`
MCP server using `@modelcontextprotocol/sdk` stdio transport. Registers tool and resource handlers, connects to MindServer via the bridge. Starts in degraded mode if MindServer is not yet reachable.

### `src/mcp/bridge.js`
Socket.io client wrapping MindServer events as async Promise-based calls. Key methods:
- `sendCommand(agentName, command)` — sends `!command(args)` directly (no AI call on Andy's side)
- `directChat(agentName, message)` — makes Andy say text via `openChat()`
- `getCommands(agentName)` — fetches live command docs from agent
- `getAgentState(agentName)` — returns cached state from `state-update` stream
- `getOutputBuffer(agentName)` — returns buffered bot output lines

### `src/mcp/tools.js`
Ten MCP tools exposed to Claude:
| Tool | Purpose |
|---|---|
| `send_command` | Send `!commandName(args)` to Andy (executes without AI) |
| `send_chat` | Make Andy say text in Minecraft |
| `get_agent_state` | Get Andy's current game state (position, health, inventory) |
| `list_commands` | Fetch all available `!command` docs from the agent |
| `get_bot_output` | Read recent bot output lines |
| `list_agents` | List all agents and their status |
| `create_agent` | Spawn a new agent from a profile |
| `stop_agent` | Stop a running agent |
| `start_agent` | Restart a stopped agent |
| `destroy_agent` | Permanently remove an agent |

### `src/mcp/resources.js`
MCP resources exposing agent info as readable URIs:
- `mindcraft://agents` — list of all agents
- `mindcraft://agent/{name}/state` — live agent state
- `mindcraft://agent/{name}/settings` — agent profile (credentials stripped)
- `mindcraft://agent/{name}/output` — recent bot output

### `src/models/mcp.js`
Dummy model class satisfying the Prompter interface with no API calls. Used when Andy is controlled entirely via MCP — no API key needed. Implements `sendRequest`, `sendVisionRequest`, and `embed` as no-ops.

---

## Modified Files

### `package.json`
Added dependency: `"@modelcontextprotocol/sdk": "^1.28.0"`

### `src/mindcraft/mindserver.js`
Added two new socket event handlers:
- `direct-chat` — forwards text to the agent's `openChat()` bypassing the AI pipeline
- `get-commands` — RPC that returns command docs from the agent process

### `src/agent/mindserver_proxy.js`
- Added top-level import: `import { getCommandDocs } from './commands/index.js'`
- Added `direct-chat` handler: calls `this.agent.openChat(message)`
- Added `get-commands` handler: calls `getCommandDocs(this.agent)` and returns via callback

### `andy.json`
Changed `"model"` from `"gemini-2.5-flash-lite"` to `"mcp"` so Andy boots without a Gemini API key.

### `~/.claude/settings.json`
Added MCP server config so Claude Code auto-starts the Mindcraft MCP server:
```json
{
  "mcpServers": {
    "mindcraft": {
      "command": "node",
      "args": ["/home/siyukang/mindcraft/mcp.js"]
    }
  }
}
```

---

## How It Works

1. `node main.js` starts MindServer (port 8080) and spawns Andy with the `mcp` dummy model
2. Claude Code auto-starts `mcp.js` on session open, which connects to MindServer via Socket.io
3. Claude uses `send_command` to run `!commands` — Andy executes them directly without any AI model
4. Claude uses `send_chat` to make Andy say text in Minecraft chat
5. Prefixing input with `mindcraft:` signals Claude to use MCP tools instead of responding in chat

---

## Known Requirement
A Minecraft server must be reachable at the host/port in `settings.js` for Andy to join the world. Set `"port": -1` to auto-discover a LAN world, or set the correct port for your server.
