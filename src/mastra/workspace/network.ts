import type { SandboxNetworkOpts } from 'e2b';
import { env } from '@/env';

export function network(): SandboxNetworkOpts {
  const rules: NonNullable<SandboxNetworkOpts['rules']> = {};

  if (env.AGENTMAIL_API_KEY) {
    rules['api.agentmail.to'] = [
      {
        transform: {
          headers: { Authorization: `Bearer ${env.AGENTMAIL_API_KEY}` },
        },
      },
    ];
  }

  return { rules };
}
