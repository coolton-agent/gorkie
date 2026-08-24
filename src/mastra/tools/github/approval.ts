import type { ToolPermission } from '../../types';

type Policy = (permission: ToolPermission) => boolean;

const read: Policy = (permission) => permission === 'all';
const write: Policy = (permission) => permission !== 'delete';

// Explicit rather than inferred from tool names: a tool missing from this map
// is not registered at all, so a new one cannot inherit a permissive default.
export const POLICIES: Record<string, Policy> = {
  addAssignees: write,
  addIssueComment: write,
  addLabels: write,
  addPullRequestComment: write,
  closeIssue: write,
  compareCommits: read,
  createBranch: write,
  createIssue: write,
  createOrUpdateFile: write,
  createPullRequest: write,
  getCiFailureContext: read,
  getCommit: read,
  getFileContent: read,
  getIssueContext: read,
  getPullRequestContext: read,
  getRepository: read,
  getRepositoryTree: read,
  listBranches: read,
  listCheckRuns: read,
  listCommits: read,
  listIssueComments: read,
  listIssues: read,
  listLabels: read,
  listPullRequestFiles: read,
  listPullRequestReviews: read,
  listPullRequests: read,
  removeAssignees: write,
  removeLabel: write,
  requestReviewers: write,
  searchCode: read,
  searchIssues: read,
  searchRepositories: read,
  updateIssue: write,
  updatePullRequest: write,
};

export const checkoutPolicy = read;
export const pushPolicy = write;
