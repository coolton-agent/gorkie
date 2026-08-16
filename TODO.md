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
- [ ] Parallel `upload_file` calls can interleave file and comment ordering across concurrent uploads (the `chat` package uploads then posts text sequentially per call, with no cross-call ordering guarantee).

## Restore from main

- [ ] Reference-image support for `generate_image` (edit an existing image, not just text-to-image). `generateImage()` already supports this natively via the object-form prompt (`{ text, images }`), no need to drop to `doGenerate()` directly. Blocked: confirmed live that `ai.hackclub.com/proxy/v1/images/edits` 404s, the proxy has no image-edit route. Needs either a provider that implements it or dropping the idea.
- [ ] `mermaid` tool (renders diagrams via mermaid.ink) so the restored `mermaid-diagrams` skill is actually usable.
- [ ] `schedule_reminder` tool for one-time DM reminders, distinct from the cron-based scheduled tasks.
- [ ] `leave_channel` tool.
