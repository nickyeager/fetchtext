---
name: build-with-agent-team
description: Build a project using Claude Code Agent Teams with tmux split panes. Takes a plan document path and optional team size. Use when you want multiple agents collaborating on a build.
argument-hint: [plan-path] [num-agents]
disable-model-invocation: true
---

# Build with Agent Team

You are coordinating a build using Claude Code Agent Teams. Read the plan document, determine the right team structure, spawn teammates, and orchestrate the build.

## Arguments

- **Plan path**: `$ARGUMENTS[0]` - Path to a markdown file describing what to build
- **Team size**: `$ARGUMENTS[1]` - Number of agents (optional)

## Step 1: Read the Plan

Read the plan document at `$ARGUMENTS[0]`. Understand:
- What are we building?
- What are the major components/layers?
- What technologies are involved?
- What are the dependencies between components?

## Step 2: Determine Team Structure

If team size is specified (`$ARGUMENTS[1]`), use that number of agents.

If NOT specified, analyze the plan and determine the optimal team size based on:
- **Number of independent components** (frontend, backend, database, infra, etc.)
- **Technology boundaries** (different languages/frameworks = different agents)
- **Parallelization potential** (what can be built simultaneously?)

**Guidelines:**
- 2 agents: Simple projects with clear frontend/backend split
- 3 agents: Full-stack apps (frontend, backend, database/infra)
- 4 agents: Complex systems with additional concerns (testing, DevOps, docs)
- 5+ agents: Large systems with many independent modules

## Step 3: Set Up Agent Team

Enable tmux split panes so each agent is visible. Before spawning, enter **Delegate Mode** (Shift+Tab) to restrict yourself to coordination only.

## Step 4: Contract-First Spawning

**CRITICAL:** Agents that build in parallel WILL diverge on interfaces unless they agree on contracts FIRST. Enforce a **contract-first, build-second** protocol.

### Spawn Order

1. **Spawn upstream agents first** (e.g., database, then backend)
2. Each upstream agent's FIRST task is: define and send their contract
3. **Lead receives and verifies the contract**
4. **Lead forwards the verified contract to downstream agents**
5. **Only then spawn or unblock downstream agents**

### Lead as Active Contract Relay

The lead must:
1. Receive the contract from the producing agent
2. **Verify it** — check for exact URLs, response shapes, status codes
3. **Forward it to consuming agents** with explicit instructions

## Step 5: Facilitate Collaboration

### Phase 1: Contracts (Sequential, Lead-Orchestrated)
### Phase 2: Implementation (Parallel where safe)
### Phase 3: Pre-Completion Contract Verification
### Phase 4: Polish (Cross-Review)

## Step 6: Validation

Two levels: **agent-level** (each validates their domain) and **lead-level** (you validate the integrated system).

### Definition of Done

1. All agents report their work is done
2. Each agent has validated their own domain
3. Integration points have been tested
4. Cross-review feedback has been addressed
5. The plan's acceptance criteria are met
6. **Lead agent has run end-to-end validation**

## Execute

1. Read and understand the plan
2. Determine team size
3. Define agent roles, ownership, and validation requirements
4. Map the contract chain
5. Enter Delegate Mode
6. Spawn upstream agents first
7. Receive and verify each contract
8. Forward verified contracts to downstream agents
9. When all agents return, run end-to-end validation
10. If validation fails, re-spawn the relevant agent
11. Confirm the build meets the plan's requirements
