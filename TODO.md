# Template TODO

Keep this file limited to unresolved work that belongs in the reusable template.

## Setup verification

- [ ] Test a clean installation from `slack-manifest.json` and `.env.example`.
- [ ] Test the E2B template build from a new account.
- [ ] Test recurring schedules and one-shot `wait` resumes in Slack.
- [ ] Test whether a pending `wait` survives a process restart.

## Simplification

- [ ] Decide whether scheduled tasks belong in the baseline template.
- [ ] Decide whether Slack Canvas tools belong in the baseline template.
- [ ] Decide whether Context7 MCP should ship enabled by default.
- [ ] Decide whether tool call cards should render `toolDisplay: 'hidden'` (current) or Mastra's built-in `'timeline'`/`'grouped'`.
- [ ] Split `workspace/skills/taste-skill/SKILL.md` (~16.6k tokens, well over Mastra's <5k recommendation) into `references/`.
- [ ] Decide whether AgentMail and authenticated GitHub support should move to optional examples.
- [ ] Review the enabled Slack tools and OAuth scopes for the minimum useful default.
- [ ] Review whether separate research and exploration agents add enough value.

## Customization

- [ ] Replace the default identity and personality prompts with a smaller customization example.
- [ ] Document how to choose models and fallback order.
- [ ] Evaluate resource-scoped Working Memory alongside thread-scoped Observational Memory.
- [ ] Add a concise plain-English response skill.

## Known issues

- [ ] Make tool approvals durable across process reloads and failed runs.
- [ ] Handle changing Slack Canvas export sizes in `get_slack_file`.
- [ ] Ensure image input skips model routes that do not support vision.
- [ ] Replace the temporary Mastra media token-count patch when the fix ships upstream.
- [ ] Refactor `tools/slack/call-api.ts` and the Slack code mode tool (`tools/code-mode/slack.ts`); the overlap between raw Slack Web API access and the wrapped Slack tools needs a cleaner boundary.
- [ ] Add an `assertCanPostTo`-style destination restriction to `react.ts` (currently the only Slack write tool without one).
- [ ] `execute_command`'s typing status shows the raw shell command. Wrap the built-in tool (disable it in `workspace/index.ts`'s tools config, add our own `execute_command` with an extra model-authored `description` field, delegate to `createWorkspaceTools()` per call like `code-mode/slack.ts` already does) so `typing-status.ts` can show a short human title instead.
- [ ] Parallel `upload_file` calls can interleave file and comment ordering across concurrent uploads (the `chat` package uploads then posts text sequentially per call, with no cross-call ordering guarantee).

## Restore from main

- [ ] Per-user custom instructions box. Main read a `<user_instructions>` block per message and let each user's saved tone/persona/style override the default personality; borkification has no implementation of this at all (only referenced in passing in `prompts/guardrails.ts`). Ties into the in-repo App Home wayfinder plan (`.wayfinder/app-home/map.md`) for where the instructions themselves would be entered and stored.
- [ ] `mermaid` tool (renders diagrams via mermaid.ink) so the restored `mermaid-diagrams` skill is actually usable.
- [ ] `schedule_reminder` tool for one-time DM reminders, distinct from the cron-based scheduled tasks.
- [ ] `leave_channel` tool.
