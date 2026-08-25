import { z } from 'zod';

// The curated GitHub surface has nothing destructive on it, so the loosest
// preset means "never ask", not "ask before deleting" the way MCP's does.
const GITHUB_PERMISSIONS = ['all', 'write', 'never'] as const;

export type GitHubPermission = (typeof GITHUB_PERMISSIONS)[number];

export const githubPermissionSchema = z.enum(GITHUB_PERMISSIONS).catch('write');
