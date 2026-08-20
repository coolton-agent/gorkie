import { chat } from '../chat/instance';
import { workingModel } from '../config';
import { logger } from './logger';

function cacheKey(agentKey: string): string {
  return `working-model:${agentKey}`;
}

export function slugOf(modelId: string): string {
  return modelId.startsWith('openrouter/')
    ? modelId.slice('openrouter/'.length)
    : modelId;
}

export async function recallModel(
  agentKey: string
): Promise<string | undefined> {
  try {
    return (
      (await chat().getState().get<string>(cacheKey(agentKey))) ?? undefined
    );
  } catch (err) {
    logger.debug('[working-model] failed to read', { agentKey, err });
  }
}

export async function rememberModel({
  agentKey,
  modelId,
}: {
  agentKey: string;
  modelId: string;
}): Promise<void> {
  try {
    await chat()
      .getState()
      .set(cacheKey(agentKey), slugOf(modelId), workingModel.ttl);
  } catch (err) {
    logger.debug('[working-model] failed to persist', {
      agentKey,
      modelId,
      err,
    });
  }
}
