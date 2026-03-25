# ce:design Skill Assessment

**Author:** Claude (Opus 4.6)
**Date:** 2025-03-25
**Context:** Evaluating PR #287 contribution and iterating on `feat/iterate-ce-design-skill` branch
**Status:** Recommendation for iteration, not merge-as-is

---

## The Gap

The compound-engineering workflow has a real gap between planning and implementation for UI-heavy features. You can brainstorm requirements, plan the technical approach, and execute -- but there's no visual proposal/approval step. The existing design agents (`design-implementation-reviewer`, `figma-design-sync`, `design-iterator`) all operate *after* designs exist. Nothing creates them.

## The Contribution

PR #287 adds a `ce:design` skill with a clean architecture: a tool-agnostic core workflow in SKILL.md, with tool-specific logic isolated in reference files for Paper, Pencil, Figma, Sketch, and Penpot. The phased approach (understand -> brief -> create -> review -> iterate -> handoff) mirrors the disciplined, checkpoint-driven philosophy of other ce: skills. It follows plugin conventions well and modifies zero existing files.

## What Works

- **Architecture is right.** Tool-agnostic core + pluggable references is the correct pattern. Adding or updating a tool means touching one reference file, not the core workflow.
- **The workflow phases are sound.** Design brief approval before any visual work, mandatory self-review checkpoints every 2-3 modifications, structured approval/iteration loop, plan file handoff -- all good.
- **Downstream integration is correct.** Referencing existing design agents for implementation-fidelity verification during `/ce:work` is the right boundary.
- **Paper and Pencil references are detailed** with specific tool calls, self-review patterns, and export guidance.

## What Needs Work

### 1. The Figma reference is stale and thin -- and it should be the strongest

Figma is by far the most commonly used design tool, and it's the only one where designs live in the tool the whole team already uses (shareable, commentable, connected to existing design systems). The current reference:
- Probes for `get_figma_data`, a tool that doesn't exist in the Figma MCP
- Treats Figma as primarily a read/extract tool with a vague "Code-to-Canvas" description
- Is 62 lines of hand-wavy descriptions vs Paper's 76 lines of concrete tool calls

The Figma MCP now provides a full write-to-canvas workflow. The reference should be rewritten around:

| Tool | Role in ce:design |
|------|-------------------|
| `create_new_file` | Canvas setup (Phase 3.1) |
| `search_design_system` | Find existing components/tokens before creating new ones (Phase 3.2) |
| `use_figma` | Create/edit any object -- frames, components, text, auto-layout, variants (Phase 3.2) |
| `get_screenshot` | Visual verification for self-review checkpoints (Phase 3.3) |
| `get_design_context` | Extract structured design data for handoff (Phase 6) |
| `get_variable_defs` | Read design tokens to inform the design brief (Phase 2) |

Figma also provides a `figma-use` skill/prompt designed to guide agents through the `use_figma` workflow. The reference should align with Figma's recommended flow rather than inventing a parallel one. Figma's guidance is split between their public docs (https://developers.figma.com/docs/figma-mcp-server/tools-and-prompts/) and the `figma/mcp-server-guide` repo (https://github.com/figma/mcp-server-guide) -- both should be consulted.

Note: `use_figma` is in beta and will become paid/usage-based. The reference should mention this.

### 2. Detection logic is wrong

Phase 0.2 probes for `get_figma_data` which won't match. Should probe for `use_figma` or `get_design_context`.

### 3. Workflow positioning is too narrow

The Quick Start says "between /ce:plan and /ce:work" as the primary framing. This is one valid path, but not the only one:

- **plan -> design -> work** -- the described path, for stable requirements
- **brainstorm -> design -> plan -> work** -- for UI-heavy work where "what does this look like?" should inform the technical plan, not follow it
- **ad-hoc** -- "design me a dashboard layout" with no plan file at all
- **ideate -> design** -- quickly visualize a generated improvement idea before committing to it

The skill already *supports* these paths (it accepts a feature description, not just a plan file), but doesn't *advertise* them. The Quick Start and description should make all entry points equally visible.

### 4. Plugin README is not updated

`plugins/compound-engineering/README.md` doesn't list ce:design in its skill inventory, which is required by AGENTS.md when plugin behavior/inventory changes.

## Tool Surface

Keep all five tool references. Figma is the priority for quality, but Paper, Pencil, Sketch, and Penpot references are isolated files that don't add complexity to the core skill. If someone has Penpot MCP installed, the skill works for them at zero additional cost. The architecture handles this cleanly.

The useful mental model for tool selection guidance:
- **Figma** -- collaborative, durable design artifacts in the tool the team already uses
- **Paper** -- fast agent-native scratchpad with live HTML canvas
- **Pencil/Sketch/Penpot** -- supported when available, lower priority for quality investment

## Recommendation

Iterate on this branch with four changes, in priority order:

1. **Rewrite `figma-workflow.md`** against actual Figma MCP tools and aligned with Figma's own `figma-use` skill guidance. Verify against both the public docs and the `figma/mcp-server-guide` repo.
2. **Fix detection logic** in SKILL.md Phase 0.2 -- probe for `use_figma`/`get_design_context`, not `get_figma_data`.
3. **Broaden the Quick Start and description** to make ad-hoc, pre-plan, and post-plan entry points equally visible.
4. **Update the plugin README** to include ce:design in the skill inventory.

The architecture is sound. The gap is real. The fix is focused.
