import { CardText, Modal } from 'chat';
import {
  getGitHubAccount,
  getGitHubPermission,
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
import { slack } from '../client';
import { chat } from '../instance';
import { decodePreset, PRESET_LABELS, presetRadio } from './presets';

// A poll outlives the modal that opened it, so a second sign-in has to cancel
// the first or the older one can land last and overwrite the newer token.
const polling = new Map<
  string,
  {
    controller: AbortController;
    device: DeviceLogin;
    viewId: string | undefined;
  }
>();

function signInModal({
  device,
  warning,
}: {
  device: DeviceLogin;
  warning?: string;
}) {
  return Modal({
    callbackId: ids.modal,
    title: 'Sign in with GitHub',
    submitLabel: 'Done',
    closeLabel: 'Cancel',
    children: [
      ...(warning ? [CardText(`:warning: ${warning}`)] : []),
      CardText(
        `*1.* <${GITHUB_INSTALL_URL}|Choose which repositories Gorkie may use>. Pick "Only select repositories" to keep it narrow.`
      ),
      CardText(
        `*2.* Open <${device.verificationUri}|${device.verificationUri}> and enter this code:`
      ),
      CardText(`\`${device.userCode}\``),
      CardText('GitHub keeps these separate, so do both.'),
      CardText(
        'This closes itself once GitHub confirms. Press Done if it does not. The code lasts 15 minutes.'
      ),
    ],
  });
}

function failedModal(reason: string) {
  const explained =
    {
      expired_token: 'The code ran out before GitHub confirmed.',
      interrupted: 'Gorkie restarted while waiting, losing track of this code.',
    }[reason] ?? `GitHub stopped the sign-in: ${reason}.`;
  return Modal({
    callbackId: ids.modal,
    title: 'Not signed in',
    submitLabel: 'Done',
    closeLabel: 'Close',
    children: [
      CardText(`:warning: ${explained}`),
      CardText('Press Sign in with GitHub for a new code.'),
    ],
  });
}

function connectedModal(login: string) {
  return Modal({
    callbackId: ids.modal,
    title: 'Signed in',
    submitLabel: 'Done',
    closeLabel: 'Close',
    children: [
      CardText(`:white_check_mark: Signed in as *${login}*.`),
      CardText(
        'The GitHub section shows what Gorkie can reach, and when it stops to ask.'
      ),
    ],
  });
}

const ids = {
  connect: 'app_home_connect_github',
  disconnect: 'app_home_disconnect_github',
  modal: 'app_home_github_modal',
  configure: 'app_home_github_configure',
  configureModal: 'app_home_github_configure_modal',
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
  let status = 'Not connected';
  let detail =
    'Sign in to let Gorkie work in your repositories, using your account.';
  if (login && installations > 0) {
    status = `*${login}*`;
    detail = `${PRESET_LABELS[permission]}  ·  Gorkie uses your GitHub account`;
  } else if (login) {
    status = `*${login}*`;
    detail = 'Not installed on any repositories, so Gorkie cannot reach code';
  }

  const connectLabel = login ? 'Reconnect' : 'Sign in with GitHub';

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
              ...(installations === 0
                ? [
                    {
                      type: 'button',
                      text: {
                        type: 'plain_text',
                        text: 'Choose repositories',
                      },
                      url: GITHUB_INSTALL_URL,
                      action_id: ids.repos,
                      style: 'primary',
                    },
                  ]
                : []),
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
                    text: "Gorkie forgets your sign-in and stops using GitHub. It stays installed on your repositories until you remove it in GitHub's settings.",
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
}): Promise<string | undefined> {
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
  return resolved.login;
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

    polling.get(userId)?.controller.abort();
    const controller = new AbortController();
    const opened = await event.openModal(signInModal({ device }));
    polling.set(userId, { controller, device, viewId: opened?.viewId });

    awaitDeviceLogin({ ...device, signal: controller.signal })
      .then(async (login) => {
        const current = polling.get(userId);
        if (current?.controller !== controller) {
          return;
        }
        const resolved = await completeLogin({ login, userId });
        polling.delete(userId);
        await publishHome(userId);
        if (!current.viewId) {
          return;
        }
        try {
          await slack.updateModal(
            current.viewId,
            resolved
              ? connectedModal(resolved)
              : failedModal('error' in login ? login.error : 'unknown')
          );
        } catch (error) {
          // The modal may already be closed, which is not worth reporting.
          logger.debug('[github] could not update the sign-in modal', {
            error,
            userId,
          });
        }
      })
      .catch((error: unknown) =>
        logger.error('[github] device login failed', { error, userId })
      );
  });

  bot.onModalSubmit(ids.modal, async (event) => {
    const { userId } = event.user;
    const account = await getGitHubAccount(userId);
    if (account) {
      polling.get(userId)?.controller.abort();
      polling.delete(userId);
      return { action: 'clear' as const };
    }
    const pending = polling.get(userId);
    if (!pending?.device) {
      return {
        action: 'update' as const,
        modal: failedModal('interrupted'),
      };
    }
    return {
      action: 'update' as const,
      modal: signInModal({
        device: pending.device,
        warning:
          'GitHub has not confirmed yet. Finish both steps, then press Done again.',
      }),
    };
  });

  bot.onAction(ids.repos, () => Promise.resolve());

  bot.onAction(ids.configure, async (event) => {
    const permission = await getGitHubPermission(event.user.userId);
    await event.openModal(
      Modal({
        callbackId: ids.configureModal,
        title: 'Configure GitHub',
        submitLabel: 'Save',
        children: [
          presetRadio({ id: 'permission', permission }),
          CardText(
            `Gorkie reaches only the repositories you chose. <${GITHUB_SETTINGS_URL}|Change which ones> on GitHub.`
          ),
        ],
      })
    );
  });

  bot.onModalSubmit(ids.configureModal, async (event) => {
    await setGitHubPermission({
      permission: decodePreset(event.values.permission).permission,
      userId: event.user.userId,
    });
    await publishHome(event.user.userId);
  });

  bot.onAction(ids.disconnect, async (event) => {
    polling.get(event.user.userId)?.controller.abort();
    await setGitHubAccount({ account: undefined, userId: event.user.userId });
    await publishHome(event.user.userId);
  });
}
