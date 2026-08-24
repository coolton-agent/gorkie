import type { GitHubCredential } from '../../../db/queries/github';
import { GITHUB_INSTALL_URL } from '../../../lib/github';
import type { ToolPermission } from '../../../types';
import { presetStatus } from '../presets';
import { ids } from './ids';

export function githubBlocks({
  credentials,
  installations,
  permission,
}: {
  credentials: GitHubCredential[];
  installations: number;
  permission: ToolPermission;
}): Record<string, unknown>[] {
  const [active] = credentials;
  const login = credentials.find((c) => c.kind === 'app')?.login;
  const pat = credentials.find((c) => c.kind === 'pat');

  let status = 'Not connected';
  let detail =
    'Sign in with the app for access scoped to the repositories you pick. A classic token also reaches repositories somebody else owns.';
  if (active?.kind === 'pat') {
    status = `*${active.login}*`;
    detail = `${presetStatus(permission)}  ·  using your personal token`;
  } else if (active && installations > 0) {
    status = `*${active.login}*`;
    detail = `${presetStatus(permission)}  ·  Gorkie uses your GitHub account`;
  } else if (active) {
    status = `*${active.login}*`;
    detail = `Not installed on any repositories, so Gorkie cannot reach code  ·  <${GITHUB_INSTALL_URL}|choose repositories>`;
  }

  const connected = Boolean(active);
  const forgets = [
    login ? 'your sign-in' : undefined,
    pat ? 'your token' : undefined,
  ]
    .filter(Boolean)
    .join(' and ');
  const afterwards = [
    login
      ? "The app stays installed on your repositories until you remove it in GitHub's settings."
      : undefined,
    pat
      ? 'The token itself keeps working until you delete it on GitHub.'
      : undefined,
  ]
    .filter(Boolean)
    .join(' ');

  return [
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*GitHub*\n${status}` },
    },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: detail }],
    },
    {
      type: 'actions',
      elements: connected
        ? [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Reconnect' },
              action_id: ids.connect,
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Configure' },
              action_id: ids.configure,
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Disconnect' },
              action_id: ids.disconnect,
              style: 'danger',
              confirm: {
                title: { type: 'plain_text', text: 'Disconnect GitHub?' },
                text: {
                  type: 'mrkdwn',
                  text: `Gorkie forgets ${forgets} and stops using GitHub. ${afterwards}`,
                },
                confirm: { type: 'plain_text', text: 'Disconnect' },
                deny: { type: 'plain_text', text: 'Cancel' },
              },
            },
          ]
        : [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Connect GitHub' },
              action_id: ids.connect,
              style: 'primary',
            },
          ],
    },
    { type: 'divider' },
  ];
}
