---
description: Create implementation plan with codebase analysis
argument-hint: <feature description | path/to/prd.md>
---

# Implementation Plan Generator

**Input**: $ARGUMENTS

## Objective

Transform the input into a battle-tested implementation plan through codebase exploration and pattern extraction.

**Core Principle**: PLAN ONLY - no code written. Create a context-rich document that enables one-pass implementation.

**Order**: CODEBASE FIRST. Solutions must fit existing patterns.

---

## Phase 1: PARSE

### Determine Input Type

| Input | Action |
|-------|--------|
| `.prd.md` file | Read PRD, extract next pending phase |
| Other `.md` file | Read and extract feature description |
| Free-form text | Use directly as feature input |
| Blank | Use conversation context |

### Extract Feature Understanding

- **Problem**: What are we solving?
- **User Story**: As a [user], I want to [action], so that [benefit]
- **Type**: NEW_CAPABILITY / ENHANCEMENT / REFACTOR / BUG_FIX
- **Complexity**: LOW / MEDIUM / HIGH

---

## Phase 2: EXPLORE

### Study the Codebase

Use the Explore agent to find:

1. **Similar implementations** - analogous features with file:line references
2. **Naming conventions** - actual examples from the codebase
3. **Error handling patterns** - how errors are created and handled
4. **Type definitions** - relevant interfaces and types
5. **Test patterns** - test file structure and assertion styles

### Document Patterns

| Category | File:Lines | Pattern |
|----------|------------|---------|
| NAMING | `path/to/file.ts:10-15` | {pattern description} |
| ERRORS | `path/to/file.ts:20-30` | {pattern description} |
| TYPES | `path/to/file.ts:1-10` | {pattern description} |
| TESTS | `path/to/test.ts:1-25` | {pattern description} |

---

## Phase 3: DESIGN

### Map the Changes

- What files need to be created?
- What files need to be modified?
- What's the dependency order?

### Identify Risks

| Risk | Mitigation |
|------|------------|
| {potential issue} | {how to handle} |

---

## Phase 4: GENERATE

### Create Plan File

**Output path**: `.agents/plans/{kebab-case-name}.plan.md`

```bash
mkdir -p .agents/plans
```

The plan should include:
- Summary
- User Story
- Metadata (type, complexity, systems affected)
- Patterns to Follow (with actual code snippets from codebase)
- Files to Change (CREATE/UPDATE with purpose)
- Tasks (atomic, ordered, each with file, action, implementation, mirror reference, and validation)
- Validation commands
- Acceptance Criteria

---

## Phase 5: OUTPUT

```markdown
## Plan Created

**File**: `.agents/plans/{name}.plan.md`

**Summary**: {2-3 sentence overview}

**Scope**:
- {N} files to CREATE
- {M} files to UPDATE
- {K} total tasks

**Key Patterns**:
- {Pattern 1 with file:line}
- {Pattern 2 with file:line}

**Next Step**: Review the plan, then implement tasks in order.
```
