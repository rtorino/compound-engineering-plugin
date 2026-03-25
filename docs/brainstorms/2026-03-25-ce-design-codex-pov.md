---
date: 2026-03-25
topic: ce-design-codex-pov
author: Codex
---

# ce:design Recommendation (Codex POV)

## Assessment

This is a strong contribution that fills a real gap in the compound-engineering workflow.

Today the repo has good support for:
- defining what to build with `/ce:brainstorm`
- defining how to build it with `/ce:plan`
- implementing and verifying it with `/ce:work`

It has much weaker support for the visual proposal and approval step in between, or for visual exploration before a plan hardens. The proposed `ce:design` skill addresses that gap well.

The architecture is good:
- a tool-agnostic core in `ce-design/SKILL.md`
- tool-specific behavior isolated in reference files
- a workflow shape that matches other `ce:` skills: understand, brief, create, review, iterate, handoff

That is the right pattern for this repo.

The main weakness is the Figma path. That should be the strongest part of the skill, but it is currently the weakest. The branch's Figma detection and reference material are stale relative to Figma's current MCP capabilities. The skill still keys off older assumptions like `get_figma_data`, while Figma's current official guidance now centers tools like `use_figma`, `get_design_context`, `get_screenshot`, `search_design_system`, and `create_new_file`.

That matters because Figma has a different strategic value from the other design tools:
- it is already where many teams collaborate
- designs are durable and shareable artifacts, not just agent-local scratch work
- it can connect to existing design systems and code-connect workflows
- the new write capabilities make it a real creation path, not just a read/extract path

Paper still has clear value as the fast scratchpad option. Figma is the higher-leverage collaborative artifact path.

I do not see a structural overlap problem with existing design capabilities:
- `frontend-design` improves design quality during implementation
- `design-iterator` and `design-implementation-reviewer` operate after a design exists
- `figma-design-sync` helps implementation match Figma during `/ce:work`

`ce:design` would complement those by creating and iterating on the design artifact itself.

## Workflow Fit

`ce:design` should be treated as an optional workflow step that can be used in several places:

- `ce:ideate -> ce:design` for visual exploration of product ideas
- `ce:brainstorm -> ce:design -> ce:plan -> ce:work` for UI-heavy features where the visual shape informs the plan
- `ce:brainstorm -> ce:plan -> ce:design -> ce:work` when requirements are already stable and design is mainly approval/handoff
- ad hoc, when a user simply wants a screen or flow designed without a formal plan

The skill already supports this mechanically because it accepts a feature description or plan reference. The main issue is that its introductory framing should make those entry points more explicit.

## Recommendation

Merge this contribution after targeted revision on the current branch.

The required changes are:

- Rewrite `figma-workflow.md` around current Figma MCP capabilities.
- Update detection in `ce-design/SKILL.md` to probe for `use_figma` / `get_design_context` instead of older tool assumptions.
- Align the Figma workflow with Figma's own recommended `figma-use` pattern where useful, instead of inventing a parallel workflow from scratch.
- Reword the skill intro and Quick Start so it clearly supports pre-plan and ad hoc use, not only `plan -> design -> work`.
- Update repo-facing docs to include `/ce:design`, since the current plugin README inventory does not mention it.

I would keep the overall architecture and keep the other tool references unless there is a deliberate decision to reduce maintenance surface area. The highest-value work is making the Figma path excellent, because that is the path most likely to become broadly used and most aligned with a collaborative design workflow.
