import type { RequestContext } from '@mastra/core/request-context';

const BUDGET = 800;
const spent = new WeakMap<RequestContext, number>();

export function spendSlackBudget({
  cost,
  requestContext,
}: {
  cost: number;
  requestContext?: RequestContext;
}): void {
  if (!requestContext) {
    return;
  }
  const next = (spent.get(requestContext) ?? 0) + cost;
  spent.set(requestContext, next);
  if (next > BUDGET) {
    throw new Error(
      `This turn has read too much from Slack (over ${BUDGET} messages and calls) and further reads are blocked. Narrow the channels or time range and answer from what you already have.`
    );
  }
}
