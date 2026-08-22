import { CardText, Modal, TextInput } from 'chat';
import { setGitHubAccount } from '../../db/queries/settings';
import { GITHUB_TOKEN_URL, resolveGitHubLogin } from '../../lib/github';
import { chat } from '../instance';

const ids = {
  connect: 'app_home_connect_github',
  disconnect: 'app_home_disconnect_github',
  modal: 'app_home_github_modal',
};

export const githubSetupSteps = [
  `Open <${GITHUB_TOKEN_URL}|GitHub's token page>. The name and the scopes Gorkie needs are filled in already. Sign in as the account you want Gorkie to act as.`,
  'Pick an expiry date. Gorkie loses GitHub access when it passes, and you come back here to reconnect.',
  'Leave the ticked scopes alone, then click *Generate token* at the bottom.',
  'Copy the token. GitHub only shows it once.',
  'Paste it below and connect.',
];

export function githubBlocks(
  login: string | undefined
): Record<string, unknown>[] {
  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'GitHub' },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: login
          ? `Signed in as *${login}*. Gorkie works with the repos you can reach, and your name goes on anything it opens.`
          : '_Not signed in. Connect your account and Gorkie can read your repos, open issues, and raise pull requests for you._',
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: login ? 'Reconnect' : 'Sign in with GitHub',
          },
          action_id: ids.connect,
          ...(login ? {} : { style: 'primary' }),
        },
        ...(login
          ? [
              {
                type: 'button',
                text: { type: 'plain_text', text: 'Disconnect' },
                action_id: ids.disconnect,
                style: 'danger',
                confirm: {
                  title: { type: 'plain_text', text: 'Disconnect GitHub?' },
                  text: {
                    type: 'mrkdwn',
                    text: 'Gorkie forgets your token and stops using GitHub. The token still exists until you delete it on GitHub yourself.',
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

export function registerGitHub({
  publishHome,
}: {
  publishHome: (userId: string) => Promise<void>;
}): void {
  const bot = chat();

  bot.onAction(ids.connect, async (event) => {
    await event.openModal(
      Modal({
        callbackId: ids.modal,
        title: 'Sign in with GitHub',
        submitLabel: 'Connect',
        children: [
          CardText(
            'Gorkie will use your GitHub account, so it can only reach repos you can, and your name goes on anything it opens. Your token is stored encrypted, and the code Gorkie runs never sees it.'
          ),
          ...githubSetupSteps.map((step, index) =>
            CardText(`${index + 1}. ${step}`)
          ),
          TextInput({
            id: 'token',
            label: 'Personal access token',
            placeholder: 'ghp_…',
            maxLength: 2000,
          }),
        ],
      })
    );
  });

  bot.onAction(ids.disconnect, async (event) => {
    await setGitHubAccount({
      login: undefined,
      token: undefined,
      userId: event.user.userId,
    });
    await publishHome(event.user.userId);
  });

  bot.onModalSubmit(ids.modal, async (event) => {
    const token = event.values.token?.trim();
    if (!token) {
      return {
        action: 'errors' as const,
        errors: { token: 'Paste the token you copied from GitHub.' },
      };
    }
    const result = await resolveGitHubLogin(token);
    if ('error' in result) {
      return { action: 'errors' as const, errors: { token: result.error } };
    }
    await setGitHubAccount({
      login: result.login,
      token,
      userId: event.user.userId,
    });
    await publishHome(event.user.userId);
  });
}
