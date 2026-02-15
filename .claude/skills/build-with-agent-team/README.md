# Build with Agent Team

A Claude Code skill for building projects using [Agent Teams](https://www.anthropic.com/news/claude-opus-4-6) — Anthropic's multi-agent collaboration feature where multiple Claude instances work in parallel, communicate with each other, and coordinate autonomously. Give it a plan document describing what you want to build, and it spawns a team of specialized agents in tmux split panes to build it together.

Once set up, it's as simple as:

```bash
/build-with-agent-team [plan-path] [num-agents]
```

## Prerequisites

### 1. Install tmux

**macOS:**
```bash
brew install tmux
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update && sudo apt install tmux
```

Verify installation:
```bash
tmux -V
```

### 2. Enable Agent Teams

Agent teams are experimental and disabled by default. Enable by adding to `~/.claude/settings.json`:

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

Or export in your shell profile:
```bash
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
```

## Usage

```bash
/build-with-agent-team [plan-path] [num-agents]
```

| Parameter | Required | Description |
|-----------|----------|-------------|
| `plan-path` | Yes | Path to your plan markdown file |
| `num-agents` | No | Number of agents (auto-determined if omitted) |

## Agent Teams vs Subagents

| | Subagents | Agent Teams |
|---|-----------|-------------|
| **Context** | Runs within main session | Each agent has its own session |
| **Communication** | Reports back to main agent only | Agents message each other directly |
| **Best for** | Quick, focused tasks | Complex builds requiring collaboration |
| **Token cost** | Lower | Higher |

**Use agent teams when:**
- Multiple components need to integrate (frontend + backend + database)
- Agents need to agree on interfaces and contracts
- Building something complex enough to warrant coordination overhead
