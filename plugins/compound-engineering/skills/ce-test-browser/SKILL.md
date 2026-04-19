---
name: ce-test-browser
description: Run browser tests on pages affected by current PR or branch
argument-hint: "[PR number, branch name, 'current', or --port PORT]"
---

# Browser Test Skill

Run end-to-end browser tests on pages affected by a PR or branch changes using the `agent-browser` CLI.

## Use `agent-browser` Only For Browser Automation

This workflow uses the `agent-browser` CLI exclusively. Do not use any alternative browser automation system, browser MCP integration, or built-in browser-control tool. If the platform offers multiple ways to control a browser, always choose `agent-browser`.

Use `agent-browser` for: opening pages, clicking elements, filling forms, taking screenshots, and scraping rendered content.

Platform-specific hints:
- In Claude Code, do not use Chrome MCP tools (`mcp__claude-in-chrome__*`).
- In Codex, do not substitute unrelated browsing tools.

## Prerequisites

- `agent-browser` CLI installed (see Setup below)
- Git repository with changes to test

The skill auto-starts the local dev server if it isn't already running (see Step 6). You no longer need to start `bin/dev` / `rails server` / `npm run dev` manually before invoking — the skill detects the dev command, launches it in the background, and waits for readiness before proceeding.

## Setup

Check whether `agent-browser` is installed:

```bash
command -v agent-browser >/dev/null 2>&1 && echo "Installed" || echo "NOT INSTALLED"
```

If not installed, inform the user: "`agent-browser` is not installed. Run `/ce-setup` to install required dependencies." Then stop — this skill cannot function without agent-browser.

## Workflow

### 1. Verify Installation

Before starting, verify `agent-browser` is available:

```bash
command -v agent-browser >/dev/null 2>&1 && echo "Ready" || echo "NOT INSTALLED"
```

If not installed, inform the user: "`agent-browser` is not installed. Run `/ce-setup` to install required dependencies." Then stop.

### 2. Ask Browser Mode

Ask the user whether to run headed or headless (using the platform's question tool — e.g., `AskUserQuestion` in Claude Code, `request_user_input` in Codex, `ask_user` in Gemini — or present options and wait for a reply):

```
Do you want to watch the browser tests run?

1. Headed (watch) - Opens visible browser window so you can see tests run
2. Headless (faster) - Runs in background, faster but invisible
```

Store the choice and use the `--headed` flag when the user selects option 1.

### 3. Determine Test Scope

**If PR number provided:**
```bash
gh pr view [number] --json files -q '.files[].path'
```

**If 'current' or empty:**
```bash
git diff --name-only main...HEAD
```

**If branch name provided:**
```bash
git diff --name-only main...[branch]
```

### 4. Map Files to Routes

Map changed files to testable routes:

| File Pattern | Route(s) |
|-------------|----------|
| `app/views/users/*` | `/users`, `/users/:id`, `/users/new` |
| `app/controllers/settings_controller.rb` | `/settings` |
| `app/javascript/controllers/*_controller.js` | Pages using that Stimulus controller |
| `app/components/*_component.rb` | Pages rendering that component |
| `app/views/layouts/*` | All pages (test homepage at minimum) |
| `app/assets/stylesheets/*` | Visual regression on key pages |
| `app/helpers/*_helper.rb` | Pages using that helper |
| `src/app/*` (Next.js) | Corresponding routes |
| `src/components/*` | Pages using those components |

Build a list of URLs to test based on the mapping.

### 5. Detect Dev Server Port

Determine the dev server port using this priority:

1. **Explicit argument** — if the user passed `--port 5000`, use that directly
2. **Project instructions** — check `AGENTS.md`, `CLAUDE.md`, or other instruction files for port references
3. **package.json** — check dev/start scripts for `--port` flags
4. **Environment files** — check `.env`, `.env.local`, `.env.development` for `PORT=`
5. **Default** — fall back to `3000`

```bash
PORT="${EXPLICIT_PORT:-}"
if [ -z "$PORT" ]; then
  PORT=$(grep -Eio '(port\s*[:=]\s*|localhost:)([0-9]{4,5})' AGENTS.md 2>/dev/null | grep -Eo '[0-9]{4,5}' | head -1)
  if [ -z "$PORT" ]; then
    PORT=$(grep -Eio '(port\s*[:=]\s*|localhost:)([0-9]{4,5})' CLAUDE.md 2>/dev/null | grep -Eo '[0-9]{4,5}' | head -1)
  fi
fi
if [ -z "$PORT" ]; then
  PORT=$(grep -Eo '\-\-port[= ]+[0-9]{4,5}' package.json 2>/dev/null | grep -Eo '[0-9]{4,5}' | head -1)
fi
if [ -z "$PORT" ]; then
  PORT=$(grep -h '^PORT=' .env .env.local .env.development 2>/dev/null | tail -1 | cut -d= -f2)
fi
PORT="${PORT:-3000}"
echo "Using dev server port: $PORT"
```

### 6. Verify Server is Running (auto-start if not)

Browser verification is the whole point of this skill — do not skip it because the server isn't up. If the port is dead, start the dev server in the background and wait for it to come up before proceeding. Only abort if startup actually fails.

**6a. Probe the port:**

```bash
if curl -sf -o /dev/null -m 2 "http://localhost:${PORT}/" \
  || curl -sf -o /dev/null -m 2 "http://localhost:${PORT}/up" \
  || curl -s -o /dev/null -m 2 -w '%{http_code}' "http://localhost:${PORT}/" | grep -qE '^(2|3|4)'; then
  echo "Server already running on :${PORT}"
  SERVER_UP=1
else
  SERVER_UP=0
fi
```

If `SERVER_UP=1`, skip to Step 7.

**6b. Detect the dev command.** Priority order:

1. **Overmind session already live** — if the project has a `Procfile.dev` and `.overmind.sock` is a responsive socket (`overmind ps` succeeds), the web process is probably crashed rather than absent. Use `overmind restart web` instead of starting a second stack.
2. **Stale overmind socket** — if `.overmind.sock` or `tmp/overmind.sock` exists but `overmind ps` errors with "connection refused", clean it up (`rm -f .overmind.sock tmp/overmind.sock` and `pkill -f 'overmind start'`) before starting fresh.
3. **Procfile.dev present** — use `bin/dev` (Rails + Overmind convention).
4. **`bin/dev` exists** — use `bin/dev`.
5. **`package.json` has a `dev` script** — use `npm run dev` (or `yarn dev` / `pnpm dev` based on lockfile: `yarn.lock` → yarn, `pnpm-lock.yaml` → pnpm, else npm).
6. **Rails app without Procfile** — use `bin/rails server -p ${PORT}`.
7. **Explicit project override** — if `AGENTS.md` / `CLAUDE.md` documents a different dev command, honor that.

If none of these match, stop and tell the user: "Could not auto-detect a dev command. Start your server manually and re-run, or document the command in AGENTS.md."

**6c. Start in the background with a log file:**

```bash
DEV_LOG="/tmp/ce-test-browser-dev-${PORT}.log"
echo "Starting dev server with: ${DEV_CMD}"
echo "Log: ${DEV_LOG}"
nohup bash -c "${DEV_CMD}" > "${DEV_LOG}" 2>&1 &
DEV_PID=$!
echo "Dev server PID: ${DEV_PID}"
```

**6d. Poll for readiness with a bounded timeout (60s):**

```bash
for i in $(seq 1 60); do
  if curl -sf -o /dev/null -m 2 "http://localhost:${PORT}/" \
    || curl -sf -o /dev/null -m 2 "http://localhost:${PORT}/up" \
    || curl -s -o /dev/null -m 2 -w '%{http_code}' "http://localhost:${PORT}/" | grep -qE '^(2|3|4)'; then
    echo "Server ready on :${PORT} after ${i}s"
    SERVER_UP=1
    break
  fi
  sleep 1
done
```

**6e. If startup failed, fail loudly with the log tail:**

```bash
if [ "${SERVER_UP}" != "1" ]; then
  echo "Dev server did not come up on :${PORT} within 60s."
  echo "Last 40 lines of ${DEV_LOG}:"
  tail -n 40 "${DEV_LOG}"
  echo "Fix the underlying issue and re-run, or start the server manually."
  exit 1
fi
```

**6f. Verify with agent-browser:**

```bash
agent-browser open "http://localhost:${PORT}"
agent-browser snapshot -i
```

If this still fails after a successful HTTP probe, the server is up but not serving the app — surface the failure with the log tail and stop.

**Tell the user you started the server.** Something like: "Dev server wasn't running on :${PORT} — started it in the background (PID ${DEV_PID}, log: ${DEV_LOG}). Continuing with tests." The user needs to know a long-lived process is now running under their shell.

### 7. Test Each Affected Page

For each affected route:

**Navigate and capture snapshot:**
```bash
agent-browser open "http://localhost:${PORT}/[route]"
agent-browser snapshot -i
```

**For headed mode:**
```bash
agent-browser --headed open "http://localhost:${PORT}/[route]"
agent-browser --headed snapshot -i
```

**Verify key elements:**
- Use `agent-browser snapshot -i` to get interactive elements with refs
- Page title/heading present
- Primary content rendered
- No error messages visible
- Forms have expected fields

**Test critical interactions:**
```bash
agent-browser click @e1
agent-browser snapshot -i
```

**Take screenshots:**
```bash
agent-browser screenshot page-name.png
agent-browser screenshot --full page-name-full.png
```

### 8. Human Verification (When Required)

Pause for human input when testing touches flows that require external interaction:

| Flow Type | What to Ask |
|-----------|-------------|
| OAuth | "Please sign in with [provider] and confirm it works" |
| Email | "Check your inbox for the test email and confirm receipt" |
| Payments | "Complete a test purchase in sandbox mode" |
| SMS | "Verify you received the SMS code" |
| External APIs | "Confirm the [service] integration is working" |

Ask the user (using the platform's question tool, or present numbered options and wait):

```
Human Verification Needed

This test touches [flow type]. Please:
1. [Action to take]
2. [What to verify]

Did it work correctly?
1. Yes - continue testing
2. No - describe the issue
```

### 9. Handle Failures

When a test fails:

1. **Document the failure:**
   - Screenshot the error state: `agent-browser screenshot error.png`
   - Note the exact reproduction steps

2. **Ask the user how to proceed:**

   ```
   Test Failed: [route]

   Issue: [description]
   Console errors: [if any]

   How to proceed?
   1. Fix now - I'll help debug and fix
   2. Create todo - Add a todo for later (using the todo-create skill)
   3. Skip - Continue testing other pages
   ```

3. **If "Fix now":** investigate, propose a fix, apply, re-run the failing test
4. **If "Create todo":** load the `ce-todo-create` skill and create a todo with priority p1 and description `browser-test-{description}`, continue
5. **If "Skip":** log as skipped, continue

### 10. Test Summary

After all tests complete, present a summary:

```markdown
## Browser Test Results

**Test Scope:** PR #[number] / [branch name]
**Server:** http://localhost:${PORT}

### Pages Tested: [count]

| Route | Status | Notes |
|-------|--------|-------|
| `/users` | Pass | |
| `/settings` | Pass | |
| `/dashboard` | Fail | Console error: [msg] |
| `/checkout` | Skip | Requires payment credentials |

### Console Errors: [count]
- [List any errors found]

### Human Verifications: [count]
- OAuth flow: Confirmed
- Email delivery: Confirmed

### Failures: [count]
- `/dashboard` - [issue description]

### Created Todos: [count]
- `005-pending-p1-browser-test-dashboard-error.md`

### Result: [PASS / FAIL / PARTIAL]
```

## Quick Usage Examples

```bash
# Test current branch changes (auto-detects port)
/ce-test-browser

# Test specific PR
/ce-test-browser 847

# Test specific branch
/ce-test-browser feature/new-dashboard

# Test on a specific port
/ce-test-browser --port 5000
```

## agent-browser CLI Reference

Run `agent-browser --help` for all commands.

Key commands:

```bash
# Navigation
agent-browser open <url>           # Navigate to URL
agent-browser back                 # Go back
agent-browser close                # Close browser

# Snapshots (get element refs)
agent-browser snapshot -i          # Interactive elements with refs (@e1, @e2, etc.)
agent-browser snapshot -i --json   # JSON output

# Interactions (use refs from snapshot)
agent-browser click @e1            # Click element
agent-browser fill @e1 "text"      # Fill input
agent-browser type @e1 "text"      # Type without clearing
agent-browser press Enter          # Press key

# Screenshots
agent-browser screenshot out.png       # Viewport screenshot
agent-browser screenshot --full out.png # Full page screenshot

# Headed mode (visible browser)
agent-browser --headed open <url>      # Open with visible browser
agent-browser --headed click @e1       # Click in visible browser

# Wait
agent-browser wait @e1             # Wait for element
agent-browser wait 2000            # Wait milliseconds
```
