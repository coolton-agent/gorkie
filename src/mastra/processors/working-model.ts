import type { ProcessOutputResultArgs } from '@mastra/core/processors';
import { rememberModel } from '../lib/working-model';

// modelMetadata carries the provider that actually served the step, but it is
// absent from the published response types, so read it structurally.
function providerOf(response: unknown): string | undefined {
  if (typeof response !== 'object' || response === null) {
    return;
  }
  const { modelMetadata } = response as { modelMetadata?: unknown };
  if (typeof modelMetadata !== 'object' || modelMetadata === null) {
    return;
  }
  const { modelProvider } = modelMetadata as { modelProvider?: unknown };
  return typeof modelProvider === 'string' ? modelProvider : undefined;
}

export function workingModel(agentKey: string) {
  return {
    id: `working-model-${agentKey}`,
    name: 'Working Model',
    description:
      'Remembers the model that just answered so the next run tries it first.',
    // processOutputStep runs before the finished step is appended to `steps`,
    // so it sees only prior steps, and nothing at all on a single-step turn.
    // processOutputResult runs once at the end with every step present.
    async processOutputResult(args: ProcessOutputResultArgs) {
      if (args.result.finishReason === 'error') {
        return args.messages;
      }
      const response = args.result.steps.at(-1)?.response;
      const modelId = response?.modelId;
      if (modelId) {
        await rememberModel({
          agentKey,
          modelId,
          modelProvider: providerOf(response),
        });
      }
      return args.messages;
    },
  };
}
