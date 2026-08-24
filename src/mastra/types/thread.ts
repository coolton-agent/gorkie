export interface ThreadState {
  respondOnThreadMessages?: boolean;
  searchToken?: string;
}

export interface FocusSession {
  reason: string;
  since: number;
  userId: string;
}
