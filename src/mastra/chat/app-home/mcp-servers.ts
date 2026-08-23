import { Modal, TextInput } from 'chat';
import {
  listMCPServers,
  removeMCPServer,
  setMCPServerPermission,
  upsertMCPServer,
} from '../../db/queries/mcps';
import { GITHUB_MCP_URL, GITHUB_SERVER_NAME } from '../../lib/github';
import { findMCPUrlError } from '../../mcp/security';
import { findMCPConnectionError } from '../../mcp/user-servers';
import { type MCPServerConfig, mcpServerSchema } from '../../types';
import { chat } from '../instance';
import { decodePreset, presetSelect } from './presets';

const ids = {
  add: 'app_home_add_mcp_server',
  modal: 'app_home_mcp_server_modal',
  permission: 'app_home_mcp_server_permission',
  remove: 'app_home_remove_mcp_server',
};
const MAX_SERVERS = 10;

export function mcpServersBlocks(
  servers: (MCPServerConfig & { lastError?: string })[]
): Record<string, unknown>[] {
  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'MCP Servers' },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: servers.length
          ? 'Tools from these servers are only available on your own turns.'
          : '_No MCP servers connected. Add one to give Gorkie extra tools, just for you._',
      },
    },
    ...servers.flatMap((server) => [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: server.lastError
            ? `*${server.name}*\n${server.url}\n:warning: ${server.lastError}`
            : `*${server.name}*\n${server.url}`,
        },
        accessory: {
          type: 'button',
          text: { type: 'plain_text', text: 'Remove' },
          action_id: ids.remove,
          value: server.name,
          style: 'danger',
        },
      },
      {
        type: 'actions',
        elements: [
          presetSelect({
            actionId: ids.permission,
            permission: server.permission,
            scope: server.name,
          }),
        ],
      },
    ]),
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Add server' },
          action_id: ids.add,
        },
      ],
    },
    { type: 'divider' },
  ];
}

export function registerMCPServers({
  publishHome,
}: {
  publishHome: (userId: string) => Promise<void>;
}): void {
  const bot = chat();

  bot.onAction(ids.add, async (event) => {
    const servers = await listMCPServers(event.user.userId);
    if (servers.length >= MAX_SERVERS) {
      return;
    }
    await event.openModal(
      Modal({
        callbackId: ids.modal,
        title: 'Add MCP Server',
        submitLabel: 'Add',
        children: [
          TextInput({
            id: 'name',
            label: 'Name',
            placeholder: 'notion',
            maxLength: 60,
          }),
          TextInput({
            id: 'url',
            label: 'Server URL',
            placeholder: 'https://mcp.example.com/mcp',
            maxLength: 500,
          }),
          TextInput({
            id: 'token',
            label: 'Access token',
            optional: true,
            maxLength: 2000,
          }),
        ],
      })
    );
  });

  bot.onAction(ids.permission, async (event) => {
    const { permission, scope } = decodePreset(event.value);
    if (!scope) {
      return;
    }
    await setMCPServerPermission({
      name: scope,
      permission,
      userId: event.user.userId,
    });
    await publishHome(event.user.userId);
  });

  bot.onAction(ids.remove, async (event) => {
    const name = event.value;
    if (!name) {
      return;
    }
    await removeMCPServer({ userId: event.user.userId, name });
    await publishHome(event.user.userId);
  });

  bot.onModalSubmit(ids.modal, async (event) => {
    const parsed = mcpServerSchema.safeParse({
      name: event.values.name?.trim(),
      url: event.values.url?.trim(),
      token: event.values.token?.trim() || undefined,
    });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const [field] = issue.path;
        if (typeof field === 'string' && !errors[field]) {
          errors[field] = issue.message;
        }
      }
      return { action: 'errors' as const, errors };
    }

    const isGitHub =
      new URL(parsed.data.url).host === new URL(GITHUB_MCP_URL).host;
    if (isGitHub || parsed.data.name.toLowerCase() === GITHUB_SERVER_NAME) {
      const message =
        'GitHub has its own section above. Use Sign in with GitHub instead.';
      return {
        action: 'errors' as const,
        errors: isGitHub ? { url: message } : { name: message },
      };
    }
    const urlError = await findMCPUrlError(parsed.data.url);
    if (urlError) {
      return { action: 'errors' as const, errors: { url: urlError } };
    }
    const connectionError = await findMCPConnectionError({
      userId: event.user.userId,
      server: parsed.data,
    });
    if (connectionError) {
      return { action: 'errors' as const, errors: { url: connectionError } };
    }
    const result = await upsertMCPServer({
      userId: event.user.userId,
      server: parsed.data,
      maxServers: MAX_SERVERS,
    });
    if (result === 'limit-reached') {
      return {
        action: 'errors' as const,
        errors: { name: `You can connect at most ${MAX_SERVERS} servers.` },
      };
    }
    await publishHome(event.user.userId);
  });
}
