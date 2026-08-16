export const content = {
  starters: [
    {
      title: 'Research with sources',
      message:
        'Research the latest developments in AI agents. Compare at least three reliable sources and give me a concise briefing with links.',
    },
    {
      title: 'Build a useful file',
      message:
        'Create a polished weekly planner as an HTML file, verify it in the sandbox, and upload it here.',
    },
    {
      title: 'Find Slack decisions',
      message:
        'Search Slack for decisions made in the last seven days and summarize them with links to the original messages.',
    },
    {
      title: 'Schedule a check-in',
      message:
        'Ask me for my timezone, then schedule a weekday 9 AM reminder to review my priorities.',
    },
  ],
  home: {
    type: 'home',
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: "I'm gorkie" },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: "I don't just answer questions, I actually do the work: write code, dig through Slack, build files, whatever the task needs. Message me directly, or @mention me in any channel.",
        },
      },
      { type: 'divider' },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'I can search the web and Slack, write and run code, browse the web, manage scheduled tasks, and work with canvases and files.',
        },
      },
    ],
  },
};
