import type { ModalView, PlainTextOption } from '@slack/web-api';
import { CardText, Modal } from 'chat';
import { z } from 'zod';
import { setGitHubCredential } from '../../../db/queries/github';
import {
  type awaitDeviceLogin,
  type DeviceLogin,
  GITHUB_INSTALL_URL,
  resolveGitHubLogin,
} from '../../../lib/github';
import { logger } from '../../../lib/logger';
import { ids } from './ids';

export const polling = new Map<
  string,
  {
    controller: AbortController;
    device: DeviceLogin;
    method: ConnectMethod;
    viewId: string | undefined;
  }
>();

export type ConnectMethod = 'app' | 'pat';

const viewAction = z.object({ view: z.object({ id: z.string() }) });

export function viewIdOf(raw: unknown): string | undefined {
  return viewAction.safeParse(raw).data?.view.id;
}

export function connectView({
  device,
  method,
  warning,
}: {
  device: DeviceLogin | undefined;
  method: ConnectMethod;
  warning?: string;
}): ModalView {
  const text = (body: string) => ({
    type: 'section',
    text: { type: 'mrkdwn', text: body },
  });
  const app = device
    ? [
        text(
          `*1.* <${GITHUB_INSTALL_URL}|Choose which repositories Gorkie may use>. Pick "Only select repositories" to keep it narrow.`
        ),
        text(
          `*2.* Open <${device.verificationUri}|${device.verificationUri}> and enter this code:`
        ),
        text(`\`${device.userCode}\``),
        text(
          'GitHub keeps these separate, so do both. This closes itself once GitHub confirms, and the code lasts 15 minutes.'
        ),
      ]
    : [text('Press Cancel and start again to get a code.')];
  const pat = [
    text(
      'An app only reaches repositories it was installed on, so it cannot fork or open a pull request against one somebody else owns. A classic token can.'
    ),
    text(
      'Pick the scope you want: <https://github.com/settings/tokens/new?scopes=public_repo&description=Gorkie|`public_repo`> covers public repositories, including other people\u2019s. <https://github.com/settings/tokens/new?scopes=repo&description=Gorkie|`repo`> adds your private ones, and is the only way Gorkie reaches private code while a token is set.'
    ),
    {
      type: 'input',
      block_id: 'token',
      optional: true,
      label: { type: 'plain_text', text: 'Token' },
      element: {
        type: 'plain_text_input',
        action_id: 'token',
        placeholder: { type: 'plain_text', text: 'ghp_…' },
        max_length: 255,
      },
    },
  ];
  const options: PlainTextOption[] = [
    {
      text: { type: 'plain_text', text: 'GitHub App' },
      description: {
        type: 'plain_text',
        text: 'Scoped to the repositories you pick, and expires.',
      },
      value: 'app',
    },
    {
      text: { type: 'plain_text', text: 'Classic token' },
      description: {
        type: 'plain_text',
        text: 'Also reaches repositories somebody else owns.',
      },
      value: 'pat',
    },
  ];
  return {
    type: 'modal',
    callback_id: ids.modal,
    title: { type: 'plain_text', text: 'Connect GitHub' },
    submit: { type: 'plain_text', text: 'Done' },
    close: { type: 'plain_text', text: 'Cancel' },
    blocks: [
      ...(warning ? [text(`:warning: ${warning}`)] : []),
      {
        type: 'input',
        block_id: ids.method,
        dispatch_action: true,
        label: { type: 'plain_text', text: 'How to connect' },
        element: {
          type: 'static_select',
          action_id: ids.method,
          options,
          initial_option: options.find((o) => o.value === method),
        },
      },
      ...(method === 'app' ? app : pat),
    ],
  };
}

export function failedModal(reason: string) {
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
      CardText(
        'Press Reconnect for a new code, or pick Classic token there instead.'
      ),
    ],
  });
}

export function connectedModal(login: string) {
  return Modal({
    callbackId: ids.modal,
    title: 'Signed in',
    submitLabel: 'Done',
    closeLabel: 'Close',
    children: [
      CardText(`:white_check_mark: Signed in as *${login}*.`),
      CardText(
        'Gorkie now reaches the repositories you installed it on. The GitHub section shows that, and when it stops to ask.'
      ),
    ],
  });
}

export async function completeLogin({
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
  await setGitHubCredential({
    credential: { ...login, kind: 'app', login: resolved.login, scopes: [] },
    userId,
  });
  return resolved.login;
}
