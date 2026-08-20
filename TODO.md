# Template TODO

Keep this file limited to unresolved work that belongs in the reusable template.

## Simplification

- [x] Rename the Slack code mode exports: the `sandboxAccess: true` instance is now `workspaceCodeMode`/`workspaceCodeModePrompt` and the Slack-only one is `slackCodeMode`/`slackCodeModePrompt`. "readOnly" was wrong, both variants share the same read-only Slack tool set and only workspace file access differs.
- [ ] Split `workspace/skills/taste-skill/SKILL.md` (~16.6k tokens, well over Mastra's <5k recommendation) into `references/`.

## Customization

- [x] Port the `submit_feedback` tool from the `feedback-tool` branch, recording to Mastra's observability feedback signal instead of a bespoke Postgres table.
- [x] Let people rate a gorkie reply from Slack directly: thumbs up/down now ride every streamed reply as Slack's native `context_actions` block, thumbs up records silently, thumbs down opens a details modal, and both land on `mastra.observability.addFeedback` with `feedbackType: 'thumbs'` (`chat/feedback.ts`, `processors/feedback-trace.ts`). Still unverified by a real click: the handler logs the raw `actions` payload at info level on every click so the value's location can be confirmed, and returns without throwing if the rating is somewhere unexpected. Buttons are per streamed message, not per turn, since `stream()` has no signal for which message ends a turn.
- [ ] Decide whether to enable resource-scoped Working Memory alongside the thread-scoped Observational Memory already in use, or leave it disabled.
- [ ] Add a concise plain-English response skill.

## Known issues

- [ ] Push the PR #13 hardening commit. It is committed locally on `pr-13-search-token` (worktree in the session scratchpad) but unpushed: `GH_TOKEN` in the shell is invalid, so `gh auth git-credential` rejects every push. Re-auth, then `git push pr13 pr-13-search-token:main` to update PR #13 in place (`maintainer_can_modify` is true).
- [ ] Live-test the `1.60.1-alpha.0` upgrade: reproduce a Luna rate-limit in Slack and confirm the fallback escalates silently, with a real error still surfacing once both models are exhausted.
- [ ] Move off the `1.60.1-alpha.0` prerelease pin once `1.60.1` ships stable.
- [ ] File the missing `E2BFilesystem` provider issue upstream (`mastra-ai/mastra#21875`); we carry a hand-rolled `workspace/filesystem.ts` until it lands.
- [ ] Handle changing Slack Canvas export sizes in `get_slack_file`.
- [ ] Ensure image input skips model routes that do not support vision.
- [ ] Refactor `tools/slack/call-api.ts` and the Slack code mode tool (`tools/code-mode/slack.ts`); the overlap between raw Slack Web API access and the wrapped Slack tools needs a cleaner boundary.
- [ ] Add an `assertCanPostTo`-style destination restriction to `react.ts` (currently the only Slack write tool without one).
- [x] `execute_command`'s typing status now shows a model-authored title ("is installing ffmpeg…") instead of the raw shell command. The built-in is renamed to `run_command` in `workspace/index.ts` so `tools/execute-command.ts` can own the `execute_command` name, take the built-in's own input schema plus a required `title`, strip `title`, and delegate to the renamed tool resolved per request. Code mode keeps using the raw `run_command`.
- [ ] `slack` (code mode) typing status is a flat "is working in Slack…" regardless of what the generated code actually does. Its input is `{ code: string }` (arbitrary TypeScript calling `external_*` functions), so there's no single field to show like `call_slack_api`'s `method`. Cheap fix: regex the `code` arg for `external_([a-zA-Z0-9_]+)\(` calls and list the distinct function names in the status, same non-invasive pattern already used for `grep`'s `pattern`.
- [ ] Parallel `upload_file` calls can interleave file and comment ordering across concurrent uploads (the `chat` package uploads then posts text sequentially per call, with no cross-call ordering guarantee).
- [ ] A turn can finish generating cleanly (`finishReason: 'stop'`, real usage stats) but the reply never reaches Slack. Likely the streaming/posting pipeline (`chat-channel-render` output processor or the Slack post call itself) failing silently after generation succeeds, not a model/provider issue. Needs a concrete repro thread to trace further.
- [ ] Streaming breaks on scheduled task tools. Needs a concrete repro to trace further.
- [ ] `openai/gpt-5.6-luna` occasionally streams two complete tool calls' JSON concatenated under one tool-call ID (e.g. an `execute_command` call and a `read_file` call glued together with no separator), which Mastra's `tryRepairJson` (`node_modules/@mastra/core/dist/stream-Cl4IhdUN.js`/`.cjs`, already locally patched for the media-token and fallback-escalation fixes) can't recover since it only handles single-object malformations (missing quotes, trailing commas, etc.), not multiple concatenated objects. Args come back `undefined`, the tool call fails validation, and the resulting broken message in history can trigger a `400 Bad Request` from whichever provider gets the next request. Same class of provider quirk as the upstream-documented Kimi/K2 issue (`mastra-ai/mastra#11078`). Fix: extend `tryRepairJson` with one more heuristic that detects a `}{` boundary at brace-depth 0 outside strings and keeps just the first balanced object, recovering one tool call instead of losing both.

## Ideas

- [ ] Feedback ratings are not deduplicated, so Slack re-dispatching a click records the same thumb twice and skews the aggregates. The observability store cannot answer "has this user already rated this message": `listFeedback` reads local storage, and prod exports Platform-only, so nothing is there to read. Durable dedupe would need our own Postgres table keyed on message and user.

- [ ] Skills support: let users add skills from skills.sh, plus custom skills (upload a ZIP, or import from a GitHub gist). Exploratory, not yet scoped.
- [ ] Separate consecutive replies in a thread: Slack groups same-author messages, so several distinct replies read as one block. Wanted: a separator ending each posted message, plus a completion footer on the turn's final message showing elapsed seconds, carried inside that message rather than posted as an extra one.
- [ ] `taskContext` (`lib/memory.ts`) calls `memoryThread()` on every scheduled-task and wait call, running a Postgres query to derive a thread id the tool already has: channels binds the memory thread as `context.agent.threadId` and its owner as `context.agent.resourceId`. Read those directly in `scheduled-tasks/create.ts`, `list.ts` and `wait.ts`. Keep `memoryThread()` for `chat/commands/stop.ts`, which only has an external thread id. Its `resolvedAgent` and `ctx` return fields have no readers, so the `getAgentById` and `channelContext` calls behind them are dead work too.
- [ ] Decide the fate of the working-model cache. `chat().getState()` resolves to `MastraStateAdapter`, whose `get`/`set` are an in-process `Map`, so `recallModel`/`rememberModel` survive nothing but the current process and the 30 minute TTL is bounded by process lifetime. Either move it to real storage or delete `lib/working-model.ts`, `processors/working-model.ts` and `preferLastWorking()`. Nothing native replaces it.
- [ ] Set `modelSettings.timeout: { stepMs }` on the orchestrator, research and explore agents. Native since 1.60.0, currently unused, and it is the real fix for a provider that opens a stream then stalls, since `stepMs` moves on to the next fallback model.
- [ ] Adopt `ToolSearchProcessor`'s `includeResolvedTools`. Per-user MCP tools come from the dynamic `tools` function, so today they bypass tool search entirely and sit in the prompt on every turn. Caveat: the flag is all-or-nothing over the resolved set, so `orchestratorTools` would become search-only too.
- [ ] Move wait-schedule cleanup to the schedules `onFinish` hook, removing the sweep loop in `scheduled-tasks/wait.ts` and the delete-before-fire ordering question in the `prepare` hook.
- [ ] Drop `validateCron` from `scheduled-tasks/create.ts`: `Schedules.create` validates the expression itself. Keep the minimum-interval check, which has no native equivalent.
- [ ] Delete `await mastra.startWorkers()` from `index.ts` once confirmed no non-server entry point relies on it; the Mastra server already calls it after `listen`.
- [ ] Replace the `sandboxTools` name Set in `processors/sandbox.ts` with a native tool hook (`hooks.beforeToolCall`), which covers every tool including code mode and extends the sandbox before the tool runs rather than after. Needs a Zod narrowing since the hook context is typed `unknown`.
- [ ] Consider `toModelOutput` for the truncation that `tools/slack/call-api.ts` and `tools/grep.ts` currently do inside `execute`, which fuses the model-facing preview with the real output.
- [ ] The `transform.display` summaries on ~25 tools never reach Slack under `toolDisplay: 'hidden'`; the user-visible copy is the separate `chat/status/statuses.ts`. Two parallel per-tool copy systems, only one of which is seen.
- [ ] `types/tools.ts` and `types/tools/` collide, so 31 files must import from `types/tools/index`. Folding the file into the directory removes the suffix everywhere.
- [ ] `TaskToolContext` re-declares a subset of Mastra's `ToolExecutionContext`; `Pick<ToolExecutionContext, 'agent' | 'mastra' | 'requestContext'>` gives the same surface without the hand-written shape.
- [ ] Audited and deliberately kept, do not re-open without new evidence: `tools/grep.ts` (the built-in walks the tree with 2 E2B round trips per file and there is no filesystem-level grep hook to override), `tools/search-web.ts` (native `webSearchTool` throws for the `openrouter` provider), `tools/fetch-url.ts` (native `webFetchTool` returns raw HTML, not extracted article text), `MastraStopCondition`, `processors/clear-status.ts` (no native clear and no turn-end hook), `processors/delegated-tools.ts` (the only thing surfacing sub-agent tool activity), the `adapter.ts` recipient overrides, `chat/app-home/` (channels has no App Home API), and `mcp_servers` staying custom (the `mcpClients` storage domain has no field for a bearer token).
- [ ] Local `check:spelling` cannot run: cspell 10 needs Node >=22.18.0 and the container has 22.17.0 with no version manager, while the repo already pins Node 24 (`.nvmrc`, `engines`). CI runs Node 24 so it is unaffected. Get Node 24 into the dev container.
- [ ] Mastra's `WorkspaceSkills` logs through raw `console.warn`/`console.error` instead of the configured logger, so its warnings bypass pino. Worth filing upstream; the local warning goes away once taste-skill is split.
