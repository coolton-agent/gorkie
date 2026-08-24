import { env } from '@/env';

const placeholder = Buffer.from(
  "nice try, we're not leaking real creds into a sandbox",
  'utf8'
).toString('base64');

export function sandboxEnv(): Record<string, string> {
  return {
    SSL_CERT_FILE: '/usr/lib/ssl/cert.pem',
    // Without this a git command that gets a 401 blocks on a username prompt
    // until the sandbox times out, instead of failing.
    GIT_TERMINAL_PROMPT: '0',
    GIT_AUTHOR_NAME: 'gorkie-agent',
    GIT_AUTHOR_EMAIL: 'gorkie@agentmail.to',
    GIT_COMMITTER_NAME: 'gorkie-agent',
    GIT_COMMITTER_EMAIL: 'gorkie@agentmail.to',
    ...(env.AGENTMAIL_API_KEY ? { AGENTMAIL_API_KEY: placeholder } : {}),
  };
}
