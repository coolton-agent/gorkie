import { CardText, Modal, TextInput } from 'chat';
import {
  listMCPServers,
  removeMCPServer,
  setMCPServerPermission,
  upsertMCPServer,
} from '../../db/queries/mcps';
import { GITHUB_SERVER_NAME, isGitHubUrl } from '../../lib/github';
import { findMCPUrlError } from '../../mcp/security';
import {
  annotationCoverage,
  findMCPConnectionError,
} from '../../mcp/user-servers';
import { type MCPServerConfig, mcpServerSchema } from '../../types';
import { chat } from '../instance';
import { decodePreset, PRESET_LABELS, presetRadio } from './presets';

const ids = {
  add: 'app_home_add_mcp_server',
  modal: 'app_home_mcp_server_modal',
  configure: 'app_home_mcp_configure',
  configureModal: 'app_home_mcp_configure_modal',
  remove: 'app_home_mcp_remove',
  permission: 'app_home_mcp_server_permission',
};
const MAX_SERVERS = 10;

function configureModal(server: MCPServerConfig) {
  const coverage = annotationCoverage.get(server.name);
  const unlabelled =
    coverage !== undefined && coverage.total > 0 && coverage.annotated === 0;
  return Modal({
    callbackId: ids.configureModal,
    title: `Configure ${server.name}`.slice(0, 24),
    submitLabel: 'Save',
    children: [
      presetRadio({
        id: 'permission',
        permission: server.permission,
        scope: server.name,
      }),
      ...(unlabelled
        ? [
            CardText(
              `:warning: This server does not say which of its ${coverage.total} tools only read, so Gorkie treats them all as writes. Asking before writing will stop on every call here, and asking only before deleting will let real writes through.`
            ),
          ]
        : []),
    ],
  });
}

export function mcpServersBlocks(
  servers: (MCPServerConfig & { lastError?: string })[]
): Record<string, unknown>[] {
  const header = {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*MCP Servers*${servers.length > 0 ? ` (${servers.length})` : ''}`,
    },
    accessory: {
      type: 'button',
      text: { type: 'plain_text', text: 'Add' },
      action_id: ids.add,
    },
  };

  if (servers.length === 0) {
    return [
      header,
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: 'None yet. Add one to give Gorkie extra tools, just for you.',
          },
        ],
      },
      { type: 'divider' },
    ];
  }

  return [
    header,
    ...servers.flatMap((server, index) => [
      ...(index > 0 ? [{ type: 'divider' }] : []),
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*${server.name}*` },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `${PRESET_LABELS[server.permission]}  ·  \`${server.url}\``,
          },
        ],
      },
      ...(server.lastError
        ? [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Error*\n\`\`\`${server.lastError}\`\`\``,
              },
            },
          ]
        : []),
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Configure' },
            action_id: `${ids.configure} ${server.name}`,
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Remove' },
            action_id: `${ids.remove} ${server.name}`,
            style: 'danger',
            confirm: {
              title: { type: 'plain_text', text: 'Remove server?' },
              text: {
                type: 'mrkdwn',
                text: `This removes *${server.name}* and its stored token.`,
              },
              confirm: { type: 'plain_text', text: 'Remove' },
              deny: { type: 'plain_text', text: 'Keep' },
            },
          },
        ],
      },
    ]),
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

  bot.onAction(async (event) => {
    const [action, name] = event.actionId.split(' ');
    if (!name) {
      return;
    }
    if (action === ids.remove) {
      await removeMCPServer({ name, userId: event.user.userId });
      await publishHome(event.user.userId);
      return;
    }
    if (action !== ids.configure) {
      return;
    }
    const server = (await listMCPServers(event.user.userId)).find(
      (entry) => entry.name === name
    );
    if (server) {
      await event.openModal(configureModal(server));
    }
  });

  bot.onModalSubmit(ids.configureModal, async (event) => {
    const { permission, scope } = decodePreset(event.values.permission);
    if (scope) {
      await setMCPServerPermission({
        name: scope,
        permission,
        userId: event.user.userId,
      });
    }
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

    const isGitHub = isGitHubUrl(parsed.data.url);
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
