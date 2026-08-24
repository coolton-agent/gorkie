import { z } from 'zod';
import type { ToolPermission } from '../../types';

export const annotationCoverage = new Map<
  string,
  { annotated: number; total: number }
>();

export function approvalFor(permission: ToolPermission) {
  return ({
    annotations,
    toolName,
  }: {
    annotations?: { destructiveHint?: boolean; readOnlyHint?: boolean };
    toolName: string;
  }): boolean => {
    if (permission === 'all') {
      return true;
    }
    const deletes =
      annotations?.destructiveHint === true ||
      toolName.startsWith('delete_') ||
      toolName.startsWith('remove_');
    if (permission === 'delete') {
      return deletes;
    }
    return deletes || annotations?.readOnlyHint !== true;
  };
}

const annotatedTool = z.object({
  mcp: z
    .object({
      annotations: z
        .object({ readOnlyHint: z.boolean().optional() })
        .optional(),
    })
    .optional(),
});

export function readOnlyHintOf(tool: unknown): boolean | undefined {
  return annotatedTool.safeParse(tool).data?.mcp?.annotations?.readOnlyHint;
}
