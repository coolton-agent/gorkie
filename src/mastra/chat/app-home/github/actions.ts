import {
  listGitHubCredentials,
  setGitHubCredential,
} from '../../../db/queries/github';
import {
  awaitDeviceLogin,
  type DeviceLogin,
  startDeviceLogin,
  verifyGitHubPat,
} from '../../../lib/github';
import { logger } from '../../../lib/logger';
import { slack } from '../../client';
import { chat } from '../../instance';
import { ids } from './ids';
import {
  type ConnectMethod,
  completeLogin,
  connectedModal,
  connectView,
  failedModal,
  polling,
  viewIdOf,
} from './views';

export function registerConnect({
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
    const opened = await slack.webClient.views.open({
      trigger_id: event.triggerId ?? '',
      view: connectView({ device, method: 'app' }),
    });
    polling.set(userId, {
      controller,
      device,
      method: 'app',
      viewId: opened.view?.id,
    });

    awaitDeviceLogin({ ...device, signal: controller.signal })
      .then(async (login) => {
        const current = polling.get(userId);
        if (current?.controller !== controller) {
          return;
        }
        const resolved = await completeLogin({ login, userId });
        polling.delete(userId);
        await publishHome(userId);
        if (!current.viewId || current.method !== 'app') {
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

  bot.onAction(ids.method, async (event) => {
    const { userId } = event.user;
    const method: ConnectMethod = event.value === 'pat' ? 'pat' : 'app';
    const pending = polling.get(userId);
    // The view id comes off the click rather than the map: the map is in
    // memory, so a restart orphans any modal already open and switching it
    // would otherwise do nothing at all.
    const viewId = viewIdOf(event.raw) ?? pending?.viewId;
    if (!viewId) {
      logger.warn('[github] a connect modal switched with no view id', {
        userId,
      });
      return;
    }
    if (pending) {
      polling.set(userId, { ...pending, method });
    }
    try {
      await slack.webClient.views.update({
        view_id: viewId,
        view: connectView({
          device: pending?.device,
          method,
          warning: pending
            ? undefined
            : 'Gorkie restarted, so this code is stale. Press Cancel and start again, or paste a token below.',
        }),
      });
    } catch (error) {
      logger.warn('[github] could not switch the connect modal', {
        error,
        userId,
      });
    }
  });

  bot.onModalSubmit(ids.modal, async (event) => {
    const { userId } = event.user;

    const chosen = polling.get(userId)?.method ?? event.values[ids.method];
    if (`${chosen}` === 'pat') {
      const token = `${event.values.token ?? ''}`.trim();
      if (!token) {
        return {
          action: 'errors' as const,
          errors: { token: 'Paste a token.' },
        };
      }
      const verified = await verifyGitHubPat(token);
      if ('error' in verified) {
        return { action: 'errors' as const, errors: { token: verified.error } };
      }
      polling.get(userId)?.controller.abort();
      polling.delete(userId);
      await setGitHubCredential({
        credential: {
          ...verified,
          expiresAt: undefined,
          kind: 'pat',
          refreshToken: undefined,
        },
        userId,
      });
      await publishHome(userId);
      return { action: 'clear' as const };
    }

    const account = (await listGitHubCredentials(userId)).find(
      (c) => c.kind === 'app'
    );
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
    await slack.webClient.views.update({
      view_id: event.viewId,
      view: connectView({
        device: pending.device,
        method: pending.method,
        warning:
          'GitHub has not confirmed yet. Finish both steps, then press Done again.',
      }),
    });
  });
}
