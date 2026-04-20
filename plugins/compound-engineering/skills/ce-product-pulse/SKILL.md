---
name: ce-product-pulse
description: "Generate a time-windowed pulse report on what users experienced and how the product performed - usage, quality, errors, signals worth investigating. Use when the user says 'run a pulse', 'show me the pulse', 'how are we doing', 'weekly recap', 'launch-day check', or passes a time window like '24h' or '7d'. Produces a single-page report saved to ~/pulse-reports/ and summarized in chat."
argument-hint: "[lookback window, e.g. '24h', '7d', '1h'; default 24h]"
---

# Product Pulse

`ce-product-pulse` queries the product's data sources for a given time window and produces a compact, single-page report covering usage, performance, errors, and followups. The report is saved to `~/pulse-reports/` and the key points are surfaced in chat.

This is a read-only skill. It reports on what happened; it does not fix anything, ship anything, or change the product.

## Interaction Method

Use the platform's blocking question tool when available (`AskUserQuestion` in Claude Code, `request_user_input` in Codex, `ask_user` in Gemini). Otherwise, present numbered options in chat and wait for the user's reply before proceeding.

Ask one question at a time. Reserve multi-select for first-run configuration only.

## Lookback Window

<lookback> #$ARGUMENTS </lookback>

Interpret the argument as a time window. Common forms:

- `24h`, `48h`, `72h` - trailing hours
- `7d`, `30d` - trailing days
- `1h` - short-window (useful during launches)

If the argument is empty, default to `24h`. If it is unparseable, ask the user to clarify.

Apply a **15-minute trailing buffer** to the window's upper bound. Many analytics and tracing tools have ingestion lag; querying right up to `now` under-reports the most recent events. For a `24h` window, query `[now - 24h - 15m, now - 15m]`.

## Core Principles

1. **Read it like a founder.** No hardcoded thresholds. Do not label things "bad" or "good" by default - present the numbers and let the reader judge.
2. **Single page.** Target 30-40 lines of terminal output. If the report is getting long, cut.
3. **No PII in saved reports.** Do not include user emails, account IDs, or message content in the report written to disk.
4. **Parallel where safe, serial where it matters.** Analytics and tracing queries run in parallel. Database queries run serially to avoid load.
5. **Memory through saved reports.** Every run writes to `~/pulse-reports/` so past pulses are browseable as a timeline.
6. **Read-only database access only.** If a database is used as a data source, the connection must be read-only. The interview refuses to accept read-write credentials. Database access is optional - many products complete the pulse with analytics and tracing alone.
7. **Strategy-seeded when available.** If `docs/strategy.md` exists, the interview reads it before asking questions and carries forward the product name and key metrics as seeds. The goal of data-source setup is to wire up whatever connections are needed to actually measure those metrics.

## Execution Flow

### Phase 0: Route by Config State

Read `docs/product-pulse.md` using the native file-read tool.

- **File does not exist** -> First run. Go to Phase 1 (interview), then Phase 2.
- **File exists** -> Skip to Phase 2.

If the argument was `setup`, `reconfigure`, or `edit config`, go to Phase 1 regardless of file state.

### Phase 1: First-Run Interview

#### 1.0 Seed from strategy (if available)

Before asking any questions, read `docs/strategy.md` using the native file-read tool. If the file exists, extract:

- The product name (from the title)
- The list of key metrics (from the `## Key metrics` section)

Open the interview by showing the user what was pulled forward: "I see you have a strategy doc on file - I'll seed the product name as `{{name}}` and carry these key metrics into the event/data setup: {{metric list}}. Say so if any of that needs to change."

If `docs/strategy.md` does not exist, note that too: "No strategy doc on file. Running the full setup from scratch. (If you want strategy to seed this later, run `/ce-strategy` first.)"

#### 1.1 Interview

Read `references/interview.md`. This load is non-optional - the pushback rules, anti-pattern examples, and metric-to-source mapping logic live there.

Run the interview in this order:

1. Product name (confirm or edit the seeded value)
2. Primary engagement event
3. Value-realization event
4. Completions or conversions (0-3)
5. Quality scoring (opt-in, AI products only)
6. Data sources - wire up connections for each agreed metric and event. Nudge toward MCP. Reject read-write database access. DB entirely optional.
7. System performance - a short recommended setup for top errors and latency. Users rarely have strong opinions here; present defaults and accept.
8. Default lookback window

Apply the pushback rules in `references/interview.md` for each section. Treat every metric, event, and signal the user proposes against the **SMART bar** (specific, measurable, actionable, relevant, timely) spelled out in `references/interview.md` under "Overall Rules" - push back on anything vague, vanity, or unactionable.

If the user offers read-write database access, refuse and offer the alternatives documented in `references/interview.md` section 6.

Write the captured config to `docs/product-pulse.md` using the structure defined in `references/interview.md` under "Config file shape". Show the file to the user and offer one round of edits.

After the config is written, run the **scheduling recommendation** from `references/interview.md` section 9: offer to set up a recurring run (via `schedule` skill or a cron-like routine) so the user gets the pulse on a cadence instead of having to remember to run it. Accept yes/no/later. If yes, hand off to the `schedule` skill; do not schedule inline. Then proceed to Phase 2.

### Phase 2: Run the Pulse

Read `docs/product-pulse.md`.

#### 2.1 Dispatch Queries

Run these in **parallel** (different tools, no shared load):

- Product analytics query (primary event count, value-realization count, completions, conversion ratios) over the window
- Application tracing query (error counts by category, latency distribution, top error signatures) over the window
- Payments query, if configured (new customers, churn, revenue delta) over the window

Run these **serially**, after the parallel batch:

- Read-only database queries. One at a time. Tight, scoped queries only. Never full-table scans on large tables. If a DB query would be expensive, skip it and note "DB query skipped (estimated cost too high)".

#### 2.2 Optional: Sample Quality Scoring

If quality scoring is opted in (AI products only, see interview config), sample up to 10 sessions or conversations from the window and score each 1-5 on the dimension the user specified at setup.

**Scoring discipline:** Default to 4 or 5 when the session looks normal. Reserve 1-3 for sessions with a clear failure mode (product gave wrong answer, user got stuck, error surfaced). If every session is scoring 3, the bar is too strict; if every session is scoring 5, the bar is too loose.

**No PII in the score summary.** Capture a count distribution (e.g., "8x 5, 1x 4, 1x 2") and a short anonymized note on any session scored below 4. Do not include message content or user identifiers in the saved report.

#### 2.3 Assemble the Report

Read `references/report-template.md`. Fill in the template using the query results. Four sections, in order:

1. **Headlines** - 2-3 lines summarizing the window
2. **Usage** - primary engagement, value realization, completions, quality sample
3. **System performance** - latency (p50/p95/p99) and top 5 errors by count with one-line explanation each
4. **Followups** - 1-5 things worth investigating

Keep the total to 30-40 lines. If a section is thin, leave it thin; do not pad.

#### 2.4 Write the Report

Save to `~/pulse-reports/YYYY-MM-DD_HH-MM.md` using the local time of the run. Create `~/pulse-reports/` if it does not exist.

Surface the Headlines and top Followup in chat. Provide the full file path so the user can open the saved report.

### Phase 3: Routine Hook

First-run setup already offered scheduling (see Phase 1.1 end). Phase 3 is a lighter re-surface for ad-hoc runs:

- If the argument was a known schedule keyword (`daily`, `hourly`, `weekly`), note that this run is ad-hoc and suggest the `schedule` skill for recurring runs.
- If no schedule is on file (check `schedule`-skill output or the user's routine config if available) and this is the third or later pulse run the user has done, mention once that scheduling is available. Don't nag on every run.

Never schedule automatically. Handing off to the `schedule` skill requires explicit confirmation.

## What This Skill Does Not Do

- Does not report "what shipped." Shipped work lives in the issue tracker and commit history, not here. Pulse is strictly about user experience and system performance.
- Does not set thresholds or alert the user. The reader interprets.
- Does not persist PII in saved reports.
- Does not mutate the database or any external system. All queries are read-only.
- Does not replace tracing dashboards or analytics tools. It consolidates a single-page read; deep investigation still uses the native tools.

## Learn More

The "read like a founder" posture and the single-page constraint are deliberate. Dashboards with 40 metrics produce attention sprawl; one page with the right four sections forces the reader to notice what matters. The saved-reports folder is designed to be a team's working memory, not a data warehouse - past pulses are grepable, diffable, and disposable.
