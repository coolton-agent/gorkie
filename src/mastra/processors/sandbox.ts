import type { ProcessOutputStepArgs } from '@mastra/core/processors';
import { sandbox as sandboxConfig } from '../config';
import { logger } from '../lib/logger';
import { getSandbox } from '../workspace';

const sandboxTools = new Set([
  'slack',
  'execute_command',
  'get_process_output',
  'kill_process',
  'get_slack_file',
  'upload_file',
  'read_file',
  'write_file',
  'edit_file',
  'list_files',
  'delete_file',
  'file_stat',
  'mkdir',
  'grep',
  'ast_edit',
]);

export const sandbox = {
  id: 'sandbox',
  name: 'Sandbox Lifecycle',
  description: 'Extends sandbox lifetime during active tool use.',
  async processOutputStep(args: ProcessOutputStepArgs) {
    const { toolCalls, requestContext, messages } = args;
    if (
      requestContext &&
      toolCalls?.some(
        (t) =>
          t.toolName.startsWith('mastra_workspace_') ||
          sandboxTools.has(t.toolName)
      )
    ) {
      try {
        const sandbox = await getSandbox(requestContext);
        await sandbox?.retryOnDead(() =>
          sandbox.e2b.setTimeout(sandboxConfig.timeout)
        );
      } catch (error) {
        logger.warn('[sandbox] failed to extend lifetime', { error });
        return messages;
      }
    }
    return messages;
  },
};
