import { Modal, TextInput } from 'chat';
import {
  listMcpServers,
  removeMcpServer,
  upsertMcpServer,
} from '../../db/queries/mcps';
import { type McpServerConfig, mcpServerSchema } from '../../types';
import { chat } from '../instance';
import { publishHome } from './view';

const ADD_ACTION_ID = 'app_home_add_mcp_server';
const REMOVE_ACTION_ID = 'app_home_remove_mcp_server';
const MODAL_CALLBACK_ID = 'app_home_mcp_server_modal';
const MAX_SERVERS = 10;

export function mcpServersBlocks(
  servers: McpServerConfig[]
): Record<string, unknown>[] {
  const blocks: Record<string, unknown>[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'MCP Servers' },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: servers.length
          ? "Extra tools connected from these servers are only available on your own turns, and always ask for your approval before they run, since they're third parties gorkie doesn't vet."
          : '_No MCP servers connected. Add one to give gorkie extra tools, just for you._',
      },
    },
  ];

  for (const server of servers) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*${server.name}*\n${server.url}` },
      accessory: {
        type: 'button',
        text: { type: 'plain_text', text: 'Remove' },
        action_id: REMOVE_ACTION_ID,
        value: server.name,
        style: 'danger',
      },
    });
  }

  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: { type: 'plain_text', text: 'Add server' },
        action_id: ADD_ACTION_ID,
      },
    ],
  });
  blocks.push({ type: 'divider' });

  return blocks;
}

export function registerMcpServers(): void {
  const bot = chat();

  bot.onAction(ADD_ACTION_ID, async (event) => {
    const servers = await listMcpServers(event.user.userId);
    if (servers.length >= MAX_SERVERS) {
      return;
    }
    await event.openModal(
      Modal({
        callbackId: MODAL_CALLBACK_ID,
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

  bot.onAction(REMOVE_ACTION_ID, async (event) => {
    const name = event.value;
    if (!name) {
      return;
    }
    await removeMcpServer({ userId: event.user.userId, name });
    await publishHome(event.user.userId);
  });

  bot.onModalSubmit(MODAL_CALLBACK_ID, async (event) => {
    const parsed = mcpServerSchema.safeParse({
      name: event.values.name?.trim(),
      url: event.values.url?.trim(),
      token: event.values.token?.trim() || undefined,
    });
    if (!parsed.success) {
      return;
    }
    const servers = await listMcpServers(event.user.userId);
    const isNewServer = !servers.some(
      (server) => server.name === parsed.data.name
    );
    if (isNewServer && servers.length >= MAX_SERVERS) {
      return;
    }
    await upsertMcpServer({ userId: event.user.userId, server: parsed.data });
    await publishHome(event.user.userId);
  });
}
