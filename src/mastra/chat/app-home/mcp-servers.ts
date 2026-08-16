import { Modal, TextInput } from 'chat';
import {
  listMCPServers,
  removeMCPServer,
  upsertMCPServer,
} from '../../db/queries/mcps';
import { type MCPServerConfig, mcpServerSchema } from '../../types';
import { chat } from '../instance';
import { publishHome } from './view';

const ids = {
  add: 'app_home_add_mcp_server',
  modal: 'app_home_mcp_server_modal',
  remove: 'app_home_remove_mcp_server',
};
const MAX_SERVERS = 10;

export function mcpServersBlocks(
  servers: MCPServerConfig[]
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
          : '_No MCP servers connected. Add one to give gorkie extra tools, just for you._',
      },
    },
    ...servers.map((server) => ({
      type: 'section',
      text: { type: 'mrkdwn', text: `*${server.name}*\n${server.url}` },
      accessory: {
        type: 'button',
        text: { type: 'plain_text', text: 'Remove' },
        action_id: ids.remove,
        value: server.name,
        style: 'danger',
      },
    })),
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

export function registerMCPServers(): void {
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
            label: 'Access token (if the server requires one)',
            optional: true,
            maxLength: 2000,
          }),
        ],
      })
    );
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
      return;
    }
    const servers = await listMCPServers(event.user.userId);
    const isNewServer = !servers.some(
      (server) => server.name === parsed.data.name
    );
    if (isNewServer && servers.length >= MAX_SERVERS) {
      return;
    }
    await upsertMCPServer({ userId: event.user.userId, server: parsed.data });
    await publishHome(event.user.userId);
  });
}
