---
description: Deep root cause analysis - finds the actual cause, not just symptoms
argument-hint: <issue|error|stacktrace> [quick]
---

<objective>
Find the **actual root cause** of: $ARGUMENTS

Not symptoms. Not intermediate failures. The specific code, config, or logic that, if changed, would prevent this issue.

**The Test**: "If I changed THIS, would the issue be prevented?" If the answer is "maybe" or "partially", keep digging.

**Mode**: If input ends with "quick" → surface scan (2-3 Whys). Otherwise → deep analysis (5+ Whys with git history).
</objective>

<context>
Project structure: !`ls -la`
Recent commits: !`git log --oneline -10`
Current branch: !`git branch --show-current`
</context>

<process>

## Phase 1: CLASSIFY - Parse the Input

**Determine input type:**

| Type | Description | Action |
|------|-------------|--------|
| RAW_SYMPTOM | Vague description, error message, stack trace | INVESTIGATE - form hypotheses, test them |
| PRE_DIAGNOSED | Already identifies location/problem | VALIDATE - confirm diagnosis, check for related issues |

**RESTATE** the symptom in one sentence: What is actually failing?

---

## Phase 2: HYPOTHESIZE - Generate Candidates

**Form 2-4 hypotheses** about what could cause this:

| # | Hypothesis | Would Need to Be True | Evidence to Confirm/Refute |
|---|------------|----------------------|---------------------------|
| 1 | ... | ... | ... |
| 2 | ... | ... | ... |

**RANK** by likelihood. Start with most probable.

---

## Phase 3: INVESTIGATE - The 5 Whys

Execute 5 Whys on your leading hypothesis:

```
WHY 1: Why does [symptom] occur?
→ BECAUSE: [intermediate cause A]
→ EVIDENCE: [file:line with actual code snippet]

WHY 2: Why does [cause A] happen?
→ BECAUSE: [intermediate cause B]
→ EVIDENCE: [proof - code, log, or test output]

...continue until root cause...
```

**RULES:**
- Stop when you hit code you can change
- Every "BECAUSE" MUST have evidence - no speculation
- If evidence refutes hypothesis, pivot to next one

**EVIDENCE_STANDARDS (STRICT):**
| Valid | Invalid |
|-------|---------|
| `file.ts:123` with actual code snippet | "likely includes...", "probably because..." |
| Command output you actually ran | Logical deduction without code proof |
| Test you executed proving behavior | Explaining how technology works in general |

---

## Phase 4: VALIDATE - Confirm Root Cause

Before declaring victory, verify:

| Test | Question | Pass? |
|------|----------|-------|
| CAUSATION | Does root cause logically lead to symptom through evidence chain? | |
| NECESSITY | If root cause didn't exist, would symptom still occur? | |
| SUFFICIENCY | Is root cause alone enough, or are there co-factors? | |

---

## Phase 5: GENERATE - Output Report

**Create directory**: `mkdir -p .agents/rca-reports`

**Save to**: `.agents/rca-reports/rca-report-{N}.md`

</process>

<output>
**OUTPUT_FILE**: `.agents/rca-reports/rca-report-{N}.md`

Report includes: Evidence Chain, Alternative Hypotheses Ruled Out, Git History Context (deep mode), Fix Specification, and Verification Steps.

**REPORT_TO_USER**:
```
RCA Complete.

File: .agents/rca-reports/rca-report-{N}.md

Root Cause: [one-line summary]
Confidence: [High/Medium/Low]
Severity: [Critical/High/Medium/Low]
```
</output>

<verification>
Before finalizing report:

- [ ] Root cause points to specific, changeable code (not vague concept)
- [ ] Every "BECAUSE" has concrete evidence with file:line
- [ ] No speculation words: "likely", "probably", "may", "might"
- [ ] Git history included (deep mode)
- [ ] Fix specification is actionable
- [ ] Verification steps are executable
</verification>

<success_criteria>
**CAUSE_IDENTIFIED**: Root cause points to exact code/config that needs change
**EVIDENCE_BACKED**: Every step in chain has proof (not speculation)
**ACTIONABLE_FIX**: Fix specification enables immediate implementation
**TESTABLE**: Verification steps can confirm the fix works
</success_criteria>
