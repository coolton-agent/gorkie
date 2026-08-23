import { CardText, Modal } from 'chat';
import {
  setGitHubAccount,
  setGitHubPermission,
} from '../../db/queries/settings';
import {
  awaitDeviceLogin,
  type DeviceLogin,
  GITHUB_INSTALL_URL,
  GITHUB_SETTINGS_URL,
  resolveGitHubLogin,
  startDeviceLogin,
} from '../../lib/github';
import { logger } from '../../lib/logger';
import type { ToolPermission } from '../../types';
import { chat } from '../instance';
import { decodePreset, presetSelect } from './presets';

const ids = {
  connect: 'app_home_connect_github',
  disconnect: 'app_home_disconnect_github',
  modal: 'app_home_github_modal',
  permission: 'app_home_github_permission',
  repos: 'app_home_github_repos',
};

export function githubBlocks({
  installations,
  login,
  permission,
}: {
  installations: number;
  login: string | undefined;
  permission: ToolPermission;
}): Record<string, unknown>[] {
  let status =
    '_Not signed in. Connect your account and Gorkie can read your repos, open issues, and raise pull requests for you._';
  if (login && installations > 0) {
    const count =
      installations === 1 ? '1 installation' : `${installations} installations`;
    status = `Signed in as *${login}*, with access to ${count}. Your name goes on anything Gorkie opens.`;
  } else if (login) {
    status = `Signed in as *${login}*, but Gorkie is not installed on any repositories yet, so it cannot reach your code.`;
  }

  const connectLabel = login ? 'Reconnect' : 'Sign in with GitHub';

  return [
    { type: 'header', text: { type: 'plain_text', text: 'GitHub' } },
    { type: 'section', text: { type: 'mrkdwn', text: status } },
    ...(login
      ? [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: 'When Gorkie should stop and ask before acting on your GitHub. Approving is a prompt, not a limit: what it can reach at all comes from the repositories you gave it and from branch protection.',
            },
            accessory: presetSelect({
              actionId: ids.permission,
              permission,
            }),
          },
        ]
      : []),
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: connectLabel,
          },
          action_id: ids.connect,
          ...(login ? {} : { style: 'primary' }),
        },
        ...(login
          ? [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text:
                    installations > 0
                      ? 'Manage repositories'
                      : 'Choose repositories',
                },
                url:
                  installations > 0 ? GITHUB_SETTINGS_URL : GITHUB_INSTALL_URL,
                action_id: ids.repos,
                ...(installations > 0 ? {} : { style: 'primary' }),
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
                    text: "Gorkie forgets your token and stops using GitHub. It stays installed on your repositories until you remove it in GitHub's settings.",
                  },
                  confirm: { type: 'plain_text', text: 'Disconnect' },
                  deny: { type: 'plain_text', text: 'Cancel' },
                },
              },
            ]
          : []),
      ],
    },
    { type: 'divider' },
  ];
}

async function completeLogin({
  login,
  userId,
}: {
  login: Awaited<ReturnType<typeof awaitDeviceLogin>>;
  userId: string;
}): Promise<void> {
  if ('error' in login) {
    logger.info('[github] device login did not complete', {
      reason: login.error,
      userId,
    });
    return;
  }
  const resolved = await resolveGitHubLogin(login.token);
  if ('error' in resolved) {
    logger.warn('[github] authorized but could not read the account', {
      error: resolved.error,
      userId,
    });
    return;
  }
  await setGitHubAccount({
    account: { ...login, login: resolved.login },
    userId,
  });
}

export function registerGitHub({
  publishHome,
}: {
  publishHome: (userId: string) => Promise<void>;
}): void {
  const bot = chat();

  bot.onAction(ids.connect, async (event) => {
    const { userId } = event.user;
    let device: DeviceLogin;
    try {
      device = await startDeviceLogin();
    } catch (error) {
      logger.error('[github] could not start device login', { error, userId });
      return;
    }

    await event.openModal(
      Modal({
        callbackId: ids.modal,
        title: 'Sign in with GitHub',
        // The adapter always renders a submit button, so it is labelled as the
        // way out rather than left saying "Submit" next to a "Cancel".
        submitLabel: 'Done',
        closeLabel: 'Cancel',
        children: [
          CardText(
            `*1.* <${GITHUB_INSTALL_URL}|Choose which repositories Gorkie may use>. Pick "Only select repositories" to keep it narrow.`
          ),
          CardText(
            `*2.* Open <${device.verificationUri}|${device.verificationUri}> and enter this code:`
          ),
          CardText(`\`${device.userCode}\``),
          CardText(
            'Step 1 decides what Gorkie can reach, step 2 proves who you are. GitHub keeps them separate, so both are needed.'
          ),
          CardText(
            'This page updates on its own once you approve. The code lasts about 15 minutes.'
          ),
        ],
      })
    );

    // Polling runs for minutes, so it cannot be awaited in a Slack handler.
    awaitDeviceLogin(device)
      .then((login) => completeLogin({ login, userId }))
      .catch((error: unknown) =>
        logger.error('[github] device login failed', { error, userId })
      )
      .finally(() => publishHome(userId));
  });

  // Nothing to save; the modal is instructions and the poll does the work.
  bot.onModalSubmit(ids.modal, () => Promise.resolve());

  // Slack opens the link itself; this exists so the interaction is acknowledged
  // rather than left unhandled.
  bot.onAction(ids.repos, () => Promise.resolve());

  bot.onAction(ids.permission, async (event) => {
    await setGitHubPermission({
      permission: decodePreset(event.value).permission,
      userId: event.user.userId,
    });
    await publishHome(event.user.userId);
  });

  bot.onAction(ids.disconnect, async (event) => {
    await setGitHubAccount({ account: undefined, userId: event.user.userId });
    await publishHome(event.user.userId);
  });
}
