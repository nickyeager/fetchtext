---
description: Meta command creator - generates slash commands following established patterns
argument-hint: <command-name> <purpose description>
---

<objective>
Create a new slash command: `$ARGUMENTS`

You are Claude Code creating a command for Claude Code. The agent executing the generated command has your exact capabilities:
- Task tool with subagents (Explore, Plan, code-reviewer, etc.)
- Read, Write, Edit, Glob, Grep tools
- Bash execution with !`command` syntax in prompts
- WebSearch and WebFetch for research
- Extended thinking for complex analysis
- Parallel agent coordination via multiple Task calls

**Meta Principle**: Write instructions you would want to receive. Specificity drives results - concrete prompts outperform vague ones.

**Simplicity Principle**: Not everything needs to be a command. A well-crafted CLAUDE.md entry often beats a complex slash command. Only create commands for repeatable, multi-step workflows.
</objective>

<context>
Existing commands: !`ls -la .claude/commands/`
Command patterns: @.claude/commands/plan.md
Simple command example: @.claude/commands/create-pr.md
Project conventions: @CLAUDE.md
</context>

<process>

## Phase 0: GATE - Should This Be a Command?

**STOP and ask**: Is a slash command the right solution?

| Signal | Recommendation |
|--------|----------------|
| One-time task | Just do it directly, no command needed |
| Simple preference | Add to CLAUDE.md instead |
| Vague/exploratory | Use Task tool with Explore agent directly |
| Repeatable multi-step workflow | YES - create a command |
| Team-shared process | YES - create a command |

**Anti-patterns to avoid:**
- Commands that are just wrappers around single tool calls
- Over-engineered commands for simple tasks
- Commands that duplicate CLAUDE.md guidance

**GATE_CHECK**: If the answer is "add to CLAUDE.md" or "just do it directly" → STOP and recommend that instead.

---

## Phase 1: CLASSIFY - Determine Command Type

**Two fundamental types** (from community patterns):

### TOOL Commands (Simple, Focused)
- Single-purpose utility
- Immediate result
- No multi-agent coordination
- Short, often < 50 lines

### WORKFLOW Commands (Complex, Orchestrated)
- Multi-phase execution
- Produces artifacts (files, reports)
- May use subagents or parallel coordination
- Phase checkpoints for self-validation
- Often 100-300 lines

**CLASSIFY the request:**
- [ ] TOOL - simple, focused → Keep it short
- [ ] WORKFLOW - complex, multi-phase → Full structure

---

## Phase 2: EXPLORE - Study Existing Patterns

**For TOOL commands**: Read 2-3 simple commands for patterns

**For WORKFLOW commands**: Use Explore agent to find workflow patterns

**PHASE_2_CHECKPOINT:**
- [ ] Read commands of matching type
- [ ] Identified patterns to mirror
- [ ] Have actual snippets as reference

---

## Phase 3: DESIGN - Structure Decisions

### For TOOL Commands
Keep it minimal: 1-3 steps max, no phases needed, direct instructions, immediate result.

### For WORKFLOW Commands
**Phase structure options:**

| Pattern | When to Use |
|---------|-------------|
| LINEAR | Steps must happen in order |
| PARALLEL | Independent work can happen simultaneously |
| WAVE-BASED | Complex work in batches (3-5 agents per wave) |

---

## Phase 4: GENERATE - Write the Command

Write the command file following established patterns.

**Writing Guidelines:**
- Specificity wins over vagueness
- Include agent hints when relevant
- Use information-dense keywords for phases

**PHASE_4_CHECKPOINT:**
- [ ] Frontmatter complete with description
- [ ] Structure matches command type (simple vs workflow)
- [ ] Instructions are specific, not vague
- [ ] Agent capabilities referenced where helpful

---

## Phase 5: VALIDATE - Quality Review

**Apply the "Would I want to receive this?" test:**

| Check | Question |
|-------|----------|
| CLARITY | Is every step unambiguous? |
| SPECIFICITY | Are instructions concrete, not vague? |
| RIGHT_SIZE | Is complexity appropriate? |
| CAPABILITY_MATCH | Does it only ask for available tools? |
| PATTERN_MATCH | Does it follow established conventions? |

</process>

<output>
**OUTPUT_FILE**: `.claude/commands/{command-name}.md`

**REPORT_TO_USER**:

```markdown
## Command Created

**File**: `.claude/commands/{command-name}.md`
**Usage**: `/{command-name} {arguments if any}`
**Type**: {TOOL/WORKFLOW}

**Test it**: Run `/{command-name}` to verify it works as expected.
```
</output>

<success_criteria>
**EXECUTABLE**: Agent can run command without confusion or clarification
**SPECIFIC**: Instructions are concrete with examples/commands, not vague
**RIGHT_SIZED**: Complexity matches the task
**PATTERN_FAITHFUL**: Matches established project conventions
**COMPOSABLE**: Can work with other commands or be extended
</success_criteria>
