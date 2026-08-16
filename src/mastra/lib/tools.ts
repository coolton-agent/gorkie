import type { MastraStopCondition } from '../types';

export function toolCall(toolName: string): MastraStopCondition {
  return ({ steps }) =>
    steps
      .at(-1)
      ?.toolResults?.some((toolResult) => toolResult.toolName === toolName) ??
    false;
}

export function stepCountIs(stepCount: number): MastraStopCondition {
  return ({ steps }) => steps.length === stepCount;
}

// gpt-5.6-luna (via OpenCode Go) sometimes reports finishReason 'other' with
// no tool calls or results even when it's actually done; without this the
// agent loop never terminates on that model.
export function inconclusiveFinish(): MastraStopCondition {
  return ({ steps }) => {
    const lastStep = steps.at(-1);
    return (
      lastStep?.finishReason === 'other' &&
      !(lastStep.toolCalls?.length || lastStep.toolResults?.length)
    );
  };
}
