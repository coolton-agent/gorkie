import { focus as config } from '../config';
import type { FocusSession } from '../types';

const sessions = new Map<string, FocusSession>();

// A turn that dies without reaching the turn-end processor would otherwise
// hold the thread shut against everyone else forever, so an entry that outlives
// any plausible turn is treated as gone.
function live(threadId: string): FocusSession | undefined {
  const session = sessions.get(threadId);
  if (!session) {
    return;
  }
  if (Date.now() - session.since > config.maxDuration) {
    sessions.delete(threadId);
    return;
  }
  return session;
}

export function focusHolder(threadId: string): FocusSession | undefined {
  return live(threadId);
}

export function enterFocus({
  reason,
  threadId,
  userId,
}: {
  reason: string;
  threadId: string;
  userId: string;
}): boolean {
  if (live(threadId)) {
    return false;
  }
  sessions.set(threadId, { reason, since: Date.now(), userId });
  return true;
}

export function exitFocus(threadId: string): void {
  sessions.delete(threadId);
}
