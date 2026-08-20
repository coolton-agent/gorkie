# Slack feedback plan: thumbs on replies, modal for the details

Status: research only, nothing implemented. `submit_feedback` (the agent-authored
tool) is already ported and works; this doc covers the human-clickable path.

## What already landed

- `src/mastra/tools/feedback.ts`: `submit_feedback` records to Mastra's
  observability feedback signal via `mastra.observability.addFeedback`, not a DB
  table. No schema, no migration.
- It passes `correlationContext` off the live tool span. That is required, not
  cosmetic: `addFeedback` given only a `traceId` rehydrates the trace from the
  observability store and silently drops the event on a miss
  (`@mastra/observability/dist/index.js:9128`). In prod we export Platform-only,
  so nothing is in local trace storage to rehydrate.

## The finding: the Slack adapter already ships thumbs

`@chat-adapter/slack` has native feedback buttons built in. It builds Slack's
`context_actions` block with a `feedback_buttons` element and attaches it to the
streamed reply at `chat.stopStream` time
(`node_modules/@chat-adapter/slack/dist/index.js:4138`).

```ts
// src/mastra/chat/client.ts:5
export const slack = new SlackAgentAdapter({
  mode: 'socket',
  agentView: true,
  feedbackButtons: true, // or { actionId, positiveLabel, negativeLabel, positiveValue, negativeValue }
  ...
});
```

Clicks dispatch through the normal action path to `bot.onAction('message_feedback', ...)`
with `value` set to `positive` / `negative`, plus `messageId` (the reply's Slack ts),
`threadId`, `user`, and `triggerId`
(`@chat-adapter/slack/dist/index.js:1864-1891`). So the whole UI is a config flag.

`buildFeedbackButtonsBlock(options)` is also exported, which matters for option B below.

## Two shapes

### A. Config flag (fastest)

Set `feedbackButtons: true`, register `bot.onAction('message_feedback', ...)` next to
the existing `bot.onAction('opt_in_accept', acceptOptIn)` in `src/mastra/chat/events.ts:35`.

Limitation: `positiveValue` / `negativeValue` are adapter-level constants, so the click
payload carries no per-message identity beyond the Slack ts. Anchoring the feedback to
the right trace then needs a lookup (see "Anchoring" below).

### B. Per-turn block through `stopBlocks` (recommended)

`src/mastra/chat/adapter.ts:60` already injects `stopBlocks` for the trailing divider,
and that is exactly where a per-turn feedback block fits:

```ts
const streamOptions = {
  ...options,
  stopBlocks: [
    ...(options?.stopBlocks ?? []),
    { type: 'divider' },
    buildFeedbackButtonsBlock({
      actionId: 'message_feedback',
      positiveValue: `up:${traceId}`,
      negativeValue: `down:${traceId}`,
    }),
  ],
};
```

Leave `feedbackButtons` unset on the config if you do this, or Slack gets two blocks
(the adapter appends its own after ours at `index.js:4140`).

The win: `event.value` carries the trace identity, so the click handler needs no lookup
and no state round-trip.

## Anchoring: where `traceId` comes from

`stream()` does not receive the run's traceId, and `StreamOptions` has no field for it.
Processors do have it: `ProcessorContext extends Partial<ObservabilityContext>`
(`@mastra/core/dist/processors/index.d.ts:51`), so `tracingContext.currentSpan.traceId`
is readable from any processor method.

Proposed handoff, ordering-safe because a run starts before its first token streams:

1. A tiny input processor reads `tracingContext?.currentSpan?.traceId` and records it
   per thread. Either `chat.getState().set('run-trace:<threadId>', traceId)`, or an
   in-memory `Map` on the adapter, the same pattern `recipients` already uses in
   `adapter.ts:16` (it only needs to survive milliseconds, not restarts).
2. `stream()` reads it and stamps it into the button values.

Fallback if that proves awkward: `stream()` returns the posted `RawMessage`
(`chat/dist/types-BtpYwkzQ.d.ts:950`), so a `ts -> traceId` map can be written after
`super.stream(...)` resolves and read at click time via `event.messageId`. More moving
parts, same result.

Cheapest possible version, worth considering first: skip `traceId` entirely and call
`addFeedback({ correlationContext: { threadId, ... } })`. Feedback is still recorded and
queryable, it just is not clickable from a trace in the Platform UI.

## The click handlers

Thumbs up, one call, no UI:

```ts
bot.onAction('message_feedback', async (event) => {
  const [direction, traceId] = (event.value ?? '').split(':');
  if (direction === 'up') {
    await getMastra().observability.addFeedback?.({
      correlationContext: { traceId },
      feedback: {
        feedbackSource: 'user',
        feedbackType: 'thumbs',
        value: 1,
        feedbackUserId: event.user.userId,
        metadata: { threadId: event.threadId, messageId: event.messageId },
      },
    });
    return;
  }
  // thumbs down: ask why
  await event.openModal(Modal({
    callbackId: 'message_feedback_modal',
    title: 'What went wrong?',
    submitLabel: 'Send',
    privateMetadata: JSON.stringify({ traceId, messageId: event.messageId }),
    children: [TextInput({ id: 'body', label: 'What happened?', multiline: true, maxLength: 2000 })],
  }));
});

bot.onModalSubmit('message_feedback_modal', async (event) => {
  const { traceId } = JSON.parse(event.privateMetadata ?? '{}');
  await getMastra().observability.addFeedback?.({
    correlationContext: { traceId },
    feedback: {
      feedbackSource: 'user',
      feedbackType: 'thumbs',
      value: -1,
      comment: event.values.body,
      feedbackUserId: event.user.userId,
    },
  });
});
```

`correlationContext` is passed through unvalidated into the emitted event
(`buildFeedbackEvent`, `@mastra/observability/dist/index.js:8620`), so a `{ traceId }`
object is enough to take the short-circuit path and skip the storage rehydrate.

`privateMetadata` is a first-class field on `Modal(...)` and comes back on
`ModalSubmitEvent.privateMetadata`, so nothing needs to be stashed server-side between
click and submit. The modal plumbing is identical to the App Home MCP flow already in
`src/mastra/chat/app-home/mcp-servers.ts:73-152`.

## Constraints worth knowing before building

- **Reactions cannot open a modal.** A 👍 emoji reaction has no `trigger_id`
  (`ReactionEvent` in `chat/dist/types-BtpYwkzQ.d.ts:1996` carries none), and Slack
  requires one for `views.open`. Reactions could still record a silent thumbs signal,
  but the "tell us more" modal has to hang off a button. Also, `reaction_added` is not
  in `slack-manifest.json` `bot_events` today, so `onReaction` would not even fire.
- **Fallback streaming drops the block.** When native streaming is unavailable the
  adapter switches to post-and-edit and skips stop blocks entirely, logging a warning
  (`index.js:4126-4131`). That is the same path the `recipientUserId` dance in
  `adapter.ts:74-98` exists to avoid, so channels without a remembered recipient lose
  the buttons. Not a blocker, just uneven coverage.
- **One block per streamed message.** A turn that streams several messages gets several
  feedback blocks. Consider attaching only when the stream is the turn's last, or accept
  the noise.
- **Payload shape needs one live check.** Slack's `feedback_buttons` element is newer
  than the generic button; the adapter reads `action.selected_option?.value ?? action.value`
  (`index.js:1865`). Verify against a real click that `value` arrives where expected
  before building logic on it.
- **Prod stores nothing locally.** Feedback lands in Mastra Platform only, since
  `MastraStorageExporter` is dev-gated in `src/mastra/index.ts:63`. If maintainers want
  to query feedback from our own Postgres, that is a separate decision (a direct
  `createFeedback` on the pg observability store, in addition to the bus emit).

## Suggested order

1. `feedbackButtons: true` plus a handler that logs the click. Confirms the block
   renders, the action fires, and what `value` actually contains. One line of config.
2. Swap to the `stopBlocks` version with the traceId stamped in, once the processor
   handoff is wired.
3. Add the modal on the negative path.
4. Reuse the same `addFeedback` shape as `submit_feedback` so agent-reported and
   human-reported feedback land in one queryable stream, separated by `feedbackType`.
