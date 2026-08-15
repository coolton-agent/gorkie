export const sandbox = {
  template: 'workspace:1.0',
  timeout: 8 * 60 * 1000,
  workdir: '/home/user',
};

export const agent = {
  id: 'orchestrator',
  maxTokens: { input: 200_000, output: 32_768 },
  maxSteps: 1000,
};
