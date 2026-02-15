# Claude Agent SDK Session Manager

Build a full-stack application for managing Claude Agent SDK sessions. An agentic chat interface where users can create sessions, chat with Claude agents, see tool usage inline, and resume any past conversation with full history.

## Problem Statement

The Claude Agent SDK doesn't expose an API to fetch historical messages when resuming a session. Claude remembers the context internally, but you can't programmatically retrieve past messages to display in a UI.

**Solution**: Store messages in our own database while using the SDK's session_id for context resumption.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React, TypeScript, Vite, Tailwind, shadcn/ui |
| Backend | Python, FastAPI, sse-starlette |
| Database | SQLite with aiosqlite |
| Agent SDK | claude-agent-sdk |

## Agent Build Order & Communication

### Phase 1: Database Agent
1. Build schema, CRUD functions, Pydantic models
2. Send function signatures and model definitions to lead

### Phase 2: Backend Agent (after receiving DB contract)
1. Build FastAPI app, routes, SSE streaming, SDK client
2. Send complete API contract to lead

### Phase 3: Frontend Agent (after receiving API contract)
1. Build React app conforming exactly to the verified API contract

### Phase 4: Lead Validation
1. Contract diff
2. Start both servers
3. Run E2E browser tests

## Acceptance Criteria

1. **New Session**: User creates session with title + optional system prompt
2. **Chat**: User sends message, response streams in real-time, tool usage visible inline
3. **Resume**: User clicks past session, full message history loads, can continue chatting
4. **Delete**: User deletes session, session and messages removed
5. **Error Handling**: Network/SDK errors displayed gracefully
6. **Responsive**: Works on desktop and mobile
