import { chat } from '../chat/instance';
import { workingModel } from '../config';
import { logger } from './logger';

const OPENROUTER_PREFIX = 'openrouter/';

function cacheKey(agentKey: string): string {
  return `working-model:${agentKey}`;
}

export function slugOf(modelId: string): string {
  return modelId.startsWith(OPENROUTER_PREFIX)
    ? modelId.slice(OPENROUTER_PREFIX.length)
    : modelId;
}

// Providers disagree about how much of the id they echo back: the OpenRouter
// proxy returns the qualified 'openai/gpt-5.6-luna' it was handed, while
// OpenCode answers a bare 'mimo-v2.5' for a model the provider list calls
// 'opencode-go/mimo-v2.5'. Re-attaching the provider puts a recalled id back
// into the shape the list uses, so it can match an entry again.
export function qualifiedSlug({
  modelId,
  modelProvider,
}: {
  modelId: string;
  modelProvider?: string;
}): string {
  if (!modelProvider || modelId.startsWith(`${modelProvider}/`)) {
    return slugOf(modelId);
  }
  return slugOf(`${modelProvider}/${modelId}`);
}

// Even qualified, the two sides can disagree on the provider segment, so
// treat a slug as matching when it is the other's tail. Two entries sharing a
// bare id both sort to the front, which only costs their relative order.
export function sameModel(entrySlug: string, recalled: string): boolean {
  return (
    entrySlug === recalled ||
    entrySlug.endsWith(`/${recalled}`) ||
    recalled.endsWith(`/${entrySlug}`)
  );
}

export async function recallModel(
  agentKey: string
): Promise<string | undefined> {
  try {
    return (
      (await chat().getState().get<string>(cacheKey(agentKey))) ?? undefined
    );
  } catch (err) {
    // Warn, not debug: the logger runs at info, so a debug line here left the
    // fallback ordering silently inert with nothing in the journal to show it.
    logger.warn('[working-model] failed to read', { agentKey, err });
  }
}

export async function rememberModel({
  agentKey,
  modelId,
  modelProvider,
}: {
  agentKey: string;
  modelId: string;
  modelProvider?: string;
}): Promise<void> {
  const slug = qualifiedSlug({ modelId, modelProvider });
  try {
    await chat().getState().set(cacheKey(agentKey), slug, workingModel.ttl);
  } catch (err) {
    logger.warn('[working-model] failed to persist', {
      agentKey,
      err,
      slug,
    });
  }
}
