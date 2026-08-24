import { CardText, Modal } from 'chat';
import {
  listGitHubCredentials,
  removeGitHubCredential,
} from '../../../db/queries/github';
import {
  getGitHubPermission,
  setGitHubPermission,
} from '../../../db/queries/settings';
import { GITHUB_SETTINGS_URL } from '../../../lib/github';
import { chat } from '../../instance';
import { decodePreset, presetRadio } from '../presets';
import { ids } from './ids';
import { polling } from './views';

export function registerSettings({
  publishHome,
}: {
  publishHome: (userId: string) => Promise<void>;
}): void {
  const bot = chat();

  bot.onAction(ids.configure, async (event) => {
    const { userId } = event.user;
    const [permission, credentials] = await Promise.all([
      getGitHubPermission(userId),
      listGitHubCredentials(userId),
    ]);
    const pat = credentials.find((c) => c.kind === 'pat');
    await event.openModal(
      Modal({
        callbackId: ids.configureModal,
        title: 'Configure GitHub',
        submitLabel: 'Save',
        children: [
          presetRadio({ id: 'permission', permission }),
          CardText(
            pat
              ? 'Your token reaches everything its scopes allow, not a list of repositories. Disconnect to go back to the app.'
              : `Gorkie reaches only the repositories you chose. <${GITHUB_SETTINGS_URL}|Change which ones> on GitHub.`
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
    await Promise.all([
      removeGitHubCredential({ kind: 'app', userId: event.user.userId }),
      removeGitHubCredential({ kind: 'pat', userId: event.user.userId }),
    ]);
    await publishHome(event.user.userId);
  });
}
