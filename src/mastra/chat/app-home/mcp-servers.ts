import { Modal, TextInput } from 'chat';
import { getUserSettings, setUserSettings } from '../../lib/settings';
import { mcpServerSchema, type UserSettings } from '../../types';
import { chat } from '../instance';
import { publishHome } from './view';

const ADD_ACTION_ID = 'app_home_add_mcp_server';
const REMOVE_ACTION_ID = 'app_home_remove_mcp_server';
const MODAL_CALLBACK_ID = 'app_home_mcp_server_modal';
const MAX_SERVERS = 10;

export function mcpServersBlocks({
  mcpServers,
}: UserSettings): Record<string, unknown>[] {
  const servers = mcpServers ?? [];

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
    const { mcpServers } = await getUserSettings(event.user.userId);
    if ((mcpServers?.length ?? 0) >= MAX_SERVERS) {
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
    const { mcpServers } = await getUserSettings(event.user.userId);
    await setUserSettings({
      userId: event.user.userId,
      patch: {
        mcpServers: mcpServers?.filter((server) => server.name !== name),
      },
    });
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
    const { mcpServers } = await getUserSettings(event.user.userId);
    const withoutSameName = (mcpServers ?? []).filter(
      (server) => server.name !== parsed.data.name
    );
    await setUserSettings({
      userId: event.user.userId,
      patch: {
        mcpServers: [...withoutSameName, parsed.data].slice(-MAX_SERVERS),
      },
    });
    await publishHome(event.user.userId);
  });
}
