import type { ProcessOutputResultArgs } from '@mastra/core/processors';
import { rememberModel } from '../lib/working-model';

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
      const modelId = args.result.steps.at(-1)?.response?.modelId;
      if (modelId) {
        await rememberModel({ agentKey, modelId });
      }
      return args.messages;
    },
  };
}
