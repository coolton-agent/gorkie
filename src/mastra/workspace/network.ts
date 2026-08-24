import type { SandboxNetworkOpts } from 'e2b';
import { env } from '@/env';

type Rules = NonNullable<SandboxNetworkOpts['rules']>;

/**
 * The sandbox's standing egress rules. Exported because `updateNetwork`
 * replaces egress configuration atomically and clears whatever it is not told
 * about, so anything adding a rule has to resend these alongside it.
 */
export function baseRules(): Rules {
  const rules: Rules = {};

  if (env.AGENTMAIL_API_KEY) {
    rules['api.agentmail.to'] = [
      {
        transform: {
          headers: { Authorization: `Bearer ${env.AGENTMAIL_API_KEY}` },
        },
      },
    ];
  }

  return rules;
}

export function network(): SandboxNetworkOpts {
  return { rules: baseRules() };
}
