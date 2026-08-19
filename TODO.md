# Template TODO

Keep this file limited to unresolved work that belongs in the reusable template.

## Simplification

- [ ] Split `workspace/skills/taste-skill/SKILL.md` (~16.6k tokens, well over Mastra's <5k recommendation) into `references/`.

## Customization

- [ ] Decide whether to enable resource-scoped Working Memory alongside the thread-scoped Observational Memory already in use, or leave it disabled.
- [ ] Add a concise plain-English response skill.

## Known issues

- [ ] Live-test the `1.60.1-alpha.0` upgrade: reproduce a Luna rate-limit in Slack and confirm the fallback escalates silently, with a real error still surfacing once both models are exhausted.
- [ ] Move off the `1.60.1-alpha.0` prerelease pin once `1.60.1` ships stable.
- [ ] File the missing `E2BFilesystem` provider issue upstream (`mastra-ai/mastra#21875`); we carry a hand-rolled `workspace/filesystem.ts` until it lands.
- [ ] Handle changing Slack Canvas export sizes in `get_slack_file`.
- [ ] Ensure image input skips model routes that do not support vision.
- [ ] Refactor `tools/slack/call-api.ts` and the Slack code mode tool (`tools/code-mode/slack.ts`); the overlap between raw Slack Web API access and the wrapped Slack tools needs a cleaner boundary.
- [ ] Add an `assertCanPostTo`-style destination restriction to `react.ts` (currently the only Slack write tool without one).
- [ ] `execute_command`'s typing status shows the raw shell command. Wrapping the built-in tool to add a model-authored title turns out to be architecturally blocked: Mastra spreads workspace-derived tools after the agent's own `tools:` config when resolving the tool list (`agent-CKAVuxKN.js`), so a same-named override in `tools:` is silently shadowed, and disabling it in `workspace/index.ts`'s tools config to work around that also blocks our own wrapper's delegation call (same shared `Workspace` instance). A second `Workspace` instance would dodge that but risks a desynced sandbox-lifecycle cache from the pause-on-turn-end hook in `processors/sandbox.ts`, which only resolves through the main `workspace`. Cheaper fallback: pattern-match common command prefixes (`agent-browser`, `curl`, `git clone`, `npm install`, etc.) directly in `typing-status.ts`'s `execute_command` entry instead, no schema change, no model authorship.
- [ ] `slack` (code mode) typing status is a flat "is working in Slack…" regardless of what the generated code actually does. Its input is `{ code: string }` (arbitrary TypeScript calling `external_*` functions), so there's no single field to show like `call_slack_api`'s `method`. Cheap fix: regex the `code` arg for `external_([a-zA-Z0-9_]+)\(` calls and list the distinct function names in the status, same non-invasive pattern already used for `execute_command`'s `command` and `grep`'s `pattern`.
- [ ] Parallel `upload_file` calls can interleave file and comment ordering across concurrent uploads (the `chat` package uploads then posts text sequentially per call, with no cross-call ordering guarantee).
- [ ] A turn can finish generating cleanly (`finishReason: 'stop'`, real usage stats) but the reply never reaches Slack. Likely the streaming/posting pipeline (`chat-channel-render` output processor or the Slack post call itself) failing silently after generation succeeds, not a model/provider issue. Needs a concrete repro thread to trace further.
- [ ] Streaming breaks on scheduled task tools. Needs a concrete repro to trace further.
- [ ] `openai/gpt-5.6-luna` occasionally streams two complete tool calls' JSON concatenated under one tool-call ID (e.g. an `execute_command` call and a `read_file` call glued together with no separator), which Mastra's `tryRepairJson` (`node_modules/@mastra/core/dist/stream-Cl4IhdUN.js`/`.cjs`, already locally patched for the media-token and fallback-escalation fixes) can't recover since it only handles single-object malformations (missing quotes, trailing commas, etc.), not multiple concatenated objects. Args come back `undefined`, the tool call fails validation, and the resulting broken message in history can trigger a `400 Bad Request` from whichever provider gets the next request. Same class of provider quirk as the upstream-documented Kimi/K2 issue (`mastra-ai/mastra#11078`). Fix: extend `tryRepairJson` with one more heuristic that detects a `}{` boundary at brace-depth 0 outside strings and keeps just the first balanced object, recovering one tool call instead of losing both.

## Ideas

- [ ] Skills support: let users add skills from skills.sh, plus custom skills (upload a ZIP, or import from a GitHub gist). Exploratory, not yet scoped.
- [ ] Separate consecutive replies in a thread: Slack groups same-author messages, so several distinct replies read as one block. Wanted: a separator ending each posted message, plus a completion footer on the turn's final message showing elapsed seconds, carried inside that message rather than posted as an extra one.
- [ ] Make the codebase Mastra-native: audit each area for hand-rolled code that current Mastra provides, and delete the glue. Confirmed so far: `moveToolImages` removed (1.60.0 carries tool-result images natively), duplicate `ProviderHistoryCompat` registration removed, `lib/shell.ts` folded into `lib/utils.ts`.
- [ ] `tools/code-mode/slack.ts` is the jankiest file in the repo: it builds `createCodeMode` twice and monkey-patches `mode.tool.execute` to rebuild the instance per request. Find a supported way to scope tools per request instead.
- [ ] Local `check:spelling` cannot run: cspell 10 needs Node >=22.18.0 and the container has 22.17.0 with no version manager, while the repo already pins Node 24 (`.nvmrc`, `engines`). CI runs Node 24 so it is unaffected. Get Node 24 into the dev container.
- [ ] Mastra's `WorkspaceSkills` logs through raw `console.warn`/`console.error` instead of the configured logger, so its warnings bypass pino. Worth filing upstream; the local warning goes away once taste-skill is split.
