import type { RequestContext } from '@mastra/core/request-context';

// Reads used to be charged per message because the adapter resolved the author
// of every message separately. SlackAgentAdapter now deduplicates those
// lookups, so a page costs about one call plus its first-seen authors, and what
// is worth counting is calls. This is a runaway-loop backstop: a program that
// pages the whole workspace stops, one that reads a few thousand messages does
// not.
const BUDGET = 200;
const spent = new WeakMap<RequestContext, number>();

export function spendSlackCall(requestContext?: RequestContext): void {
  if (!requestContext) {
    return;
  }
  const next = (spent.get(requestContext) ?? 0) + 1;
  spent.set(requestContext, next);
  if (next > BUDGET) {
    throw new Error(
      `This turn has made over ${BUDGET} Slack calls and further reads are blocked. Narrow the channels or time range, and answer from what you already have.`
    );
  }
}
