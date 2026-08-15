# Configure Models

All model choices live in `src/mastra/providers.ts`.

## Model roles

| Export | Purpose |
|---|---|
| `orchestrator` | Main Slack agent |
| `summarizer` | Memory and summaries |
| `scout` | Research subagent |
| `explorer` | Code exploration subagent |

## Change a text model

Change the OpenRouter slug:

```ts
export const orchestrator: ModelWithRetries[] = [
  {
    model: openrouter('anthropic/claude-sonnet-4.6'),
    maxRetries: 3,
  },
];
```

Add another entry to the array for fallback:

```ts
export const orchestrator: ModelWithRetries[] = [
  { model: openrouter('anthropic/claude-sonnet-4.6'), maxRetries: 2 },
  { model: openrouter('openai/gpt-5.4-mini'), maxRetries: 2 },
];
```

Check model ids in the [OpenRouter catalog](https://openrouter.ai/models).
Choose models that support tool calling.

## Use another provider

Mastra accepts `provider/model` ids. Add the provider key to `src/env.ts` and
`.env.example`, then use its model id in `providers.ts`.

See the [Mastra model catalog](https://mastra.ai/models) for supported
providers.

After changing models, run `bun run typecheck` and `bun run build`.
