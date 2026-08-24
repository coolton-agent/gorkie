import {
  listMCPServers,
  removeMCPServer,
  setMCPServerPermission,
  upsertMCPServer,
} from '../../../db/queries/mcps';
import { GITHUB_SERVER_NAME, isGitHubUrl } from '../../../lib/github';
import { findMCPUrlError } from '../../../mcp/security';
import { findMCPConnectionError } from '../../../mcp/user-servers';
import { mcpServerSchema } from '../../../types';
import { chat } from '../../instance';
import { decodePreset } from '../presets';
import { ids, MAX_SERVERS } from './ids';
import { addServerModal, configureModal } from './views';

export function registerMCPServers({
  publishHome,
}: {
  publishHome: (userId: string) => Promise<void>;
}): void {
  const bot = chat();

  bot.onAction(ids.add, async (event) => {
    const servers = await listMCPServers(event.user.userId);
    if (servers.length >= MAX_SERVERS) {
      return;
    }
    await event.openModal(addServerModal());
  });

  bot.onAction(async (event) => {
    const [action, name] = event.actionId.split(' ');
    if (!name) {
      return;
    }
    if (action === ids.remove) {
      await removeMCPServer({ name, userId: event.user.userId });
      await publishHome(event.user.userId);
      return;
    }
    if (action !== ids.configure) {
      return;
    }
    const server = (await listMCPServers(event.user.userId)).find(
      (entry) => entry.name === name
    );
    if (server) {
      await event.openModal(configureModal(server));
    }
  });

  bot.onModalSubmit(ids.configureModal, async (event) => {
    const { permission, scope } = decodePreset(event.values.permission);
    if (scope) {
      await setMCPServerPermission({
        name: scope,
        permission,
        userId: event.user.userId,
      });
    }
    await publishHome(event.user.userId);
  });

  bot.onModalSubmit(ids.modal, async (event) => {
    const parsed = mcpServerSchema.safeParse({
      name: event.values.name?.trim(),
      url: event.values.url?.trim(),
      token: event.values.token?.trim() || undefined,
    });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const [field] = issue.path;
        if (typeof field === 'string' && !errors[field]) {
          errors[field] = issue.message;
        }
      }
      return { action: 'errors' as const, errors };
    }

    const isGitHub = isGitHubUrl(parsed.data.url);
    if (isGitHub || parsed.data.name.toLowerCase() === GITHUB_SERVER_NAME) {
      const message =
        'GitHub has its own section above. Use Sign in with GitHub instead.';
      return {
        action: 'errors' as const,
        errors: isGitHub ? { url: message } : { name: message },
      };
    }
    const urlError = await findMCPUrlError(parsed.data.url);
    if (urlError) {
      return { action: 'errors' as const, errors: { url: urlError } };
    }
    const connectionError = await findMCPConnectionError({
      userId: event.user.userId,
      server: parsed.data,
    });
    if (connectionError) {
      return { action: 'errors' as const, errors: { url: connectionError } };
    }
    const result = await upsertMCPServer({
      userId: event.user.userId,
      server: parsed.data,
      maxServers: MAX_SERVERS,
    });
    if (result === 'limit-reached') {
      return {
        action: 'errors' as const,
        errors: { name: `You can connect at most ${MAX_SERVERS} servers.` },
      };
    }
    await publishHome(event.user.userId);
  });
}
