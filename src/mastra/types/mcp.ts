import { z } from 'zod';

const TOOL_PERMISSIONS = ['all', 'write', 'delete'] as const;

export type ToolPermission = (typeof TOOL_PERMISSIONS)[number];

export const toolPermissionSchema = z.enum(TOOL_PERMISSIONS).catch('write');

export const mcpServerSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(60)
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Letters, numbers, dashes, and underscores only.'
    ),
  url: z.url(),
  token: z.string().min(1).max(2000).optional(),
  permission: toolPermissionSchema.default('write'),
});

export type MCPServerConfig = z.infer<typeof mcpServerSchema>;
